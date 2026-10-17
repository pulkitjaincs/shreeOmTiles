import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CreditStatus } from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import {
  generatePartyStatementPdf,
  LedgerEntry,
} from './pdf/party-statement-pdf.generator';

function getCreditLedgerOriginalAmount(cl: {
  amountDue: any;
  notes?: string | null;
}): number {
  if (cl.notes) {
    const match = cl.notes.match(
      /Opening balance (?:due from customer|payable to vendor): ₹([0-9.]+)/i,
    );
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return Number(cl.amountDue || 0);
}

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePartyDto) {
    return this.prisma.party.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
        category: data.category,
      },
    });
  }

  async findAll(
    search?: string,
    includeUnsaved: boolean = false,
    pagination?: PaginationParams,
  ): Promise<any> {
    const andConditions: Prisma.PartyWhereInput[] = [];

    if (!includeUnsaved) {
      // Show permanent saved directory parties OR any walk-in / unregistered debtor who owes unsettled dues
      andConditions.push({
        OR: [
          { isSaved: true },
          {
            creditLedgers: {
              some: {
                status: { not: CreditStatus.SETTLED },
              },
            },
          },
        ],
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { gstin: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PartyWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // Performance optimization: Only fetch un-settled credit ledgers and selective fields
    // Full chronological ledger history is retrieved on-demand via findOne(:id)
    const includeRelations = {
      creditLedgers: {
        where: {
          status: { not: CreditStatus.SETTLED },
        },
        select: {
          id: true,
          amountDue: true,
          type: true,
          status: true,
          dueDate: true,
        },
      },
      _count: {
        select: { invoices: true },
      },
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 500);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.party.findMany({
          where,
          include: includeRelations,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.party.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    // Return all matching parties with no artificial 200-party cut-off
    return this.prisma.party.findMany({
      where,
      include: includeRelations,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
            deliveries: true,
            salesman: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        creditLedgers: {
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                total: true,
                createdAt: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    return party;
  }

  async update(id: string, data: UpdatePartyDto) {
    await this.findOne(id);
    return this.prisma.party.update({ where: { id }, data });
  }

  async remove(id: string) {
    // 1. Fetch party with credit ledgers, purchases, and invoices to check dues
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        creditLedgers: true,
        purchases: true,
        invoices: {
          include: {
            payments: true,
            refundInvoices: true,
          },
        },
      },
    });

    if (!party) throw new NotFoundException(`Party ${id} not found`);

    // 2. Check pending dues:
    // Dues customer owes the shop (RECEIVABLE)
    const receivableDue = (party.creditLedgers || [])
      .filter((cl) => cl.type === 'RECEIVABLE' && cl.status !== 'SETTLED')
      .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

    // Dues shop owes the customer (PAYABLE - e.g. refunds or credit notes)
    const payableDue = (party.creditLedgers || [])
      .filter((cl) => cl.type === 'PAYABLE' && cl.status !== 'SETTLED')
      .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

    // Unpaid invoices that don't already have a credit ledger
    let unpaidInvoiceDue = 0;
    for (const inv of party.invoices || []) {
      if (
        inv.status !== 'PAID' &&
        inv.status !== 'CANCELLED' &&
        inv.status !== 'DRAFT'
      ) {
        const hasCreditLedger = (party.creditLedgers || []).some(
          (cl) => cl.invoiceId === inv.id && cl.status !== 'SETTLED',
        );
        if (!hasCreditLedger) {
          const total = Number(inv.total || 0);
          const totalRefunded = (inv.refundInvoices || []).reduce(
            (s, r) => s + Number(r.total || 0),
            0,
          );
          const confirmedInflows = (inv.payments || [])
            .filter((p) => p.status === 'CONFIRMED' && p.type === 'INFLOW')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const confirmedOutflows = (inv.payments || [])
            .filter((p) => p.status === 'CONFIRMED' && p.type === 'OUTFLOW')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const netPaid = Math.max(0, confirmedInflows - confirmedOutflows);
          const diff = Math.max(0, total - totalRefunded - netPaid);
          if (diff > 0.01) {
            unpaidInvoiceDue += diff;
          }
        }
      }
    }

    const totalCustomerDebt = receivableDue + unpaidInvoiceDue;
    if (totalCustomerDebt > 0.01) {
      throw new BadRequestException(
        `Cannot delete customer '${party.name}': Customer has outstanding dues of ₹${totalCustomerDebt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pending payment. Please collect payment first.`,
      );
    }
    if (payableDue > 0.01) {
      throw new BadRequestException(
        `Cannot delete customer '${party.name}': Shop owes ₹${payableDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} in store credit/refunds to this customer. Please settle or refund first.`,
      );
    }

    // 3. Zero dues confirmed.
    // If historical invoices or purchases exist, soft-delete (isSaved: false) to protect past tax records and foreign keys.
    if (
      (party.invoices && party.invoices.length > 0) ||
      (party.purchases && party.purchases.length > 0)
    ) {
      await this.prisma.party.update({
        where: { id },
        data: { isSaved: false },
      });
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }

    // If no historical invoices exist, attempt hard-delete; fall back to soft delete if relations exist
    try {
      await this.prisma.party.delete({ where: { id } });
      return {
        success: true,
        message: `Customer '${party.name}' permanently deleted.`,
      };
    } catch {
      await this.prisma.party.update({
        where: { id },
        data: { isSaved: false },
      });
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }
  }

  async generateStatementPdf(id: string, startDate?: string, endDate?: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        invoices: {
          include: { items: { include: { product: true } }, payments: true },
          orderBy: { createdAt: 'asc' },
        },
        refundInvoices: {
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
        },
        creditLedgers: {
          where: {
            invoiceId: null,
            purchaseId: null,
            refundInvoiceId: null,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!party) throw new NotFoundException(`Party ${id} not found`);

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    // Opening Balance prior to start
    let runningBal = 0;
    for (const inv of party.invoices) {
      if (new Date(inv.createdAt) < start) {
        runningBal += Number(inv.total);
      }
    }
    for (const p of party.payments) {
      if (p.status === 'CONFIRMED' && new Date(p.createdAt) < start) {
        if (p.type === 'INFLOW') {
          runningBal -= Number(p.amount);
        } else {
          runningBal += Number(p.amount);
        }
      }
    }
    for (const r of party.refundInvoices) {
      if (new Date(r.createdAt) < start) {
        runningBal -= Number(r.total);
      }
    }
    for (const cl of party.creditLedgers || []) {
      if (new Date(cl.createdAt) < start) {
        const amt = getCreditLedgerOriginalAmount(cl);
        if (cl.type === 'RECEIVABLE') {
          runningBal += amt;
        } else {
          runningBal -= amt;
        }
      }
    }

    const openingBalance = runningBal;
    const entries: LedgerEntry[] = [];

    if (startDate) {
      entries.push({
        date: start,
        voucherType: 'Opening Balance',
        refNo: 'B/F',
        particulars: 'Balance Brought Forward',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
      });
    }

    // Collect transactions between start and end
    interface RawTx {
      date: Date;
      type:
        | 'INVOICE'
        | 'PAYMENT'
        | 'PAYOUT'
        | 'REFUND'
        | 'OPENING_DUE'
        | 'OPENING_PAYABLE';
      refNo: string;
      particulars: string;
      amount: number;
    }
    const rawTxs: RawTx[] = [];

    for (const cl of party.creditLedgers || []) {
      const d = new Date(cl.createdAt);
      if (d >= start && d <= end) {
        const amt = getCreditLedgerOriginalAmount(cl);
        rawTxs.push({
          date: d,
          type: cl.type === 'RECEIVABLE' ? 'OPENING_DUE' : 'OPENING_PAYABLE',
          refNo: `OB-${cl.id.slice(0, 6).toUpperCase()}`,
          particulars:
            cl.notes ||
            (cl.type === 'RECEIVABLE'
              ? 'Opening Balance Due'
              : 'Opening Balance Payable'),
          amount: amt,
        });
      }
    }

    for (const inv of party.invoices) {
      const d = new Date(inv.createdAt);
      if (d >= start && d <= end) {
        const itemNames =
          inv.items
            .map((i) => i.product?.name)
            .filter(Boolean)
            .join(', ') || 'Goods sale';
        rawTxs.push({
          date: d,
          type: 'INVOICE',
          refNo: inv.invoiceNo,
          particulars: itemNames.slice(0, 30),
          amount: Number(inv.total),
        });
      }
    }

    for (const p of party.payments) {
      const d = new Date(p.createdAt);
      if (p.status === 'CONFIRMED' && d >= start && d <= end) {
        if (p.type === 'INFLOW') {
          rawTxs.push({
            date: d,
            type: 'PAYMENT',
            refNo: p.upiTxnRef || `PAY-${p.id.slice(0, 6)}`,
            particulars: `Payment (${p.mode})`,
            amount: Number(p.amount),
          });
        } else {
          rawTxs.push({
            date: d,
            type: 'PAYOUT',
            refNo: p.upiTxnRef || `OUT-${p.id.slice(0, 6)}`,
            particulars: p.refundInvoiceId
              ? `Refund Payout (${p.mode})`
              : `Payout / Settlement (${p.mode})`,
            amount: Number(p.amount),
          });
        }
      }
    }

    for (const r of party.refundInvoices) {
      const d = new Date(r.createdAt);
      if (d >= start && d <= end) {
        rawTxs.push({
          date: d,
          type: 'REFUND',
          refNo: r.refundNo,
          particulars: r.reason || 'Goods Return',
          amount: Number(r.total),
        });
      }
    }

    rawTxs.sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalReturns = 0;

    for (const tx of rawTxs) {
      if (tx.type === 'INVOICE') {
        runningBal += tx.amount;
        totalBilled += tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Tax Invoice',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: tx.amount,
          credit: 0,
          balance: runningBal,
        });
      } else if (tx.type === 'PAYMENT') {
        runningBal -= tx.amount;
        totalPaid += tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Payment Received',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: 0,
          credit: tx.amount,
          balance: runningBal,
        });
      } else if (tx.type === 'PAYOUT') {
        runningBal += tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Payment Paid Out',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: tx.amount,
          credit: 0,
          balance: runningBal,
        });
      } else if (tx.type === 'REFUND') {
        runningBal -= tx.amount;
        totalReturns += tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Credit Note',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: 0,
          credit: tx.amount,
          balance: runningBal,
        });
      } else if (tx.type === 'OPENING_DUE') {
        runningBal += tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Opening Balance',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: tx.amount,
          credit: 0,
          balance: runningBal,
        });
      } else if (tx.type === 'OPENING_PAYABLE') {
        runningBal -= tx.amount;
        entries.push({
          date: tx.date,
          voucherType: 'Opening Balance',
          refNo: tx.refNo,
          particulars: tx.particulars,
          debit: 0,
          credit: tx.amount,
          balance: runningBal,
        });
      }
    }

    return generatePartyStatementPdf({
      party,
      startDate,
      endDate,
      openingBalance,
      totalBilled,
      totalPaid,
      totalReturns,
      closingBalance: runningBal,
      entries,
    });
  }
}
