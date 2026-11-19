import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import {
  Prisma,
  CreditStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentType,
} from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import {
  generatePartyStatementPdf,
  StatementEntry,
  StatementItem,
} from './pdf/party-statement-pdf.generator';
import { parseOpeningBalanceAmount } from '../payments/payments.service';

export interface PartyFinancialSummary {
  openingBalance: number;
  totalSales: number;
  totalReturns: number;
  totalPaid: number;
  totalRefundPayouts: number;
  netBalance: number;
  outstandingDue: number;
  storePayable: number;
}

export function computePartyFinancialSummary(party: {
  creditLedgers?: any[];
  invoices?: any[];
  refundInvoices?: any[];
  payments?: any[];
}): PartyFinancialSummary {
  let openingBalance = 0;
  for (const cl of party.creditLedgers || []) {
    if (!cl.invoiceId && !cl.purchaseId && !cl.refundInvoiceId) {
      if (cl.notes?.toLowerCase().includes('opening balance')) {
        const amt = parseOpeningBalanceAmount(cl);
        if (cl.type === 'RECEIVABLE') {
          openingBalance += amt;
        } else if (cl.type === 'PAYABLE') {
          openingBalance -= amt;
        }
      }
    }
  }

  const totalSales = (party.invoices || [])
    .filter(
      (inv) =>
        inv.status !== InvoiceStatus.CANCELLED &&
        inv.status !== InvoiceStatus.DRAFT,
    )
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  const totalReturns = (party.refundInvoices || []).reduce(
    (sum, r) => sum + Number(r.total || r.totalRefundAmount || 0),
    0,
  );

  let totalPaid = 0;
  let totalRefundPayouts = 0;
  for (const p of party.payments || []) {
    if (p.status !== PaymentStatus.CONFIRMED) continue;
    const isInternalCredit =
      p.mode === 'CREDIT' ||
      p.notes?.toLowerCase().includes('store credit') ||
      p.notes?.toLowerCase().includes('offset');
    if (isInternalCredit) continue;

    if (p.type === PaymentType.INFLOW) {
      totalPaid += Number(p.amount || 0);
    } else if (p.type === PaymentType.OUTFLOW) {
      totalRefundPayouts += Number(p.amount || 0);
    }
  }

  const netBalance =
    Math.round(
      (openingBalance +
        totalSales -
        totalReturns -
        totalPaid +
        totalRefundPayouts) *
        100,
    ) / 100;

  const outstandingDue = netBalance > 0.01 ? netBalance : 0;
  const storePayable = netBalance < -0.01 ? Math.abs(netBalance) : 0;

  return {
    openingBalance,
    totalSales,
    totalReturns,
    totalPaid,
    totalRefundPayouts,
    netBalance,
    outstandingDue,
    storePayable,
  };
}

function getCreditLedgerOriginalAmount(cl: {
  amountDue: any;
  notes?: string | null;
}): number {
  if (cl.notes) {
    const match = cl.notes.match(
      /Opening balance (?:due from customer|payable to vendor):? ?(?:₹|Rs\.?)? ?([0-9.]+)/i,
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

function getStatementDateRange(
  startDate?: string,
  endDate?: string,
): {
  start: Date;
  end: Date;
  startFormatted: string;
  endFormatted: string;
} {
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDDMMYYYY = (d: Date) =>
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      startFormatted: startDate ? formatDDMMYYYY(start) : 'All Time',
      endFormatted: formatDDMMYYYY(end),
    };
  }

  // Default to active Indian Financial Year (April 1 to March 31)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  const start = new Date(startYear, 3, 1, 0, 0, 0, 0);
  const end = new Date(endYear, 2, 31, 23, 59, 59, 999);

  return {
    start,
    end,
    startFormatted: formatDDMMYYYY(start),
    endFormatted: formatDDMMYYYY(end),
  };
}

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreatePartyDto) {
    const res = await this.prisma.party.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
        category: data.category,
      },
    });
    this.cacheService.invalidatePrefix('parties:');
    return {
      ...res,
      netBalance: 0,
      outstandingDue: 0,
      storePayable: 0,
      totalReceivable: 0,
      totalPayable: 0,
    };
  }

  async findAll(
    search?: string,
    includeUnsaved: boolean = false,
    pagination?: PaginationParams,
  ): Promise<any> {
    const cacheKey = `parties:${includeUnsaved}:${search || ''}:${JSON.stringify(pagination || {})}`;
    // Parties cache: 60 seconds (1 minute)
    return this.cacheService.wrap(cacheKey, 60, async () => {
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
            invoiceId: true,
            purchaseId: true,
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

        const enriched = data.map((p) => {
          let due = 0;
          let payable = 0;
          for (const cl of p.creditLedgers || []) {
            const amt = Number(cl.amountDue || 0);
            if (cl.type === 'RECEIVABLE') due += amt;
            else if (cl.type === 'PAYABLE') payable += amt;
          }
          const net = Math.round((due - payable) * 100) / 100;
          return {
            ...p,
            netBalance: net,
            totalReceivable: Math.round(due * 100) / 100,
            totalPayable: Math.round(payable * 100) / 100,
            outstandingDue: net > 0.01 ? net : 0,
            storePayable: net < -0.01 ? Math.abs(net) : 0,
          };
        });

        return {
          data: enriched,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      // Return all matching parties with no artificial 200-party cut-off
      const data = await this.prisma.party.findMany({
        where,
        include: includeRelations,
        orderBy: { name: 'asc' },
      });

      return data.map((p) => {
        let due = 0;
        let payable = 0;
        for (const cl of p.creditLedgers || []) {
          const amt = Number(cl.amountDue || 0);
          if (cl.type === 'RECEIVABLE') due += amt;
          else if (cl.type === 'PAYABLE') payable += amt;
        }
        const net = Math.round((due - payable) * 100) / 100;
        return {
          ...p,
          netBalance: net,
          totalReceivable: Math.round(due * 100) / 100,
          totalPayable: Math.round(payable * 100) / 100,
          outstandingDue: net > 0.01 ? net : 0,
          storePayable: net < -0.01 ? Math.abs(net) : 0,
        };
      });
    });
  }

  async findOne(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
            deliveries: true,
            refundInvoices: true,
            creditLedgers: true,
            salesman: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        purchases: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
            createdBy: {
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
            purchase: {
              select: {
                id: true,
                purchaseNo: true,
                vendorBillNo: true,
                total: true,
                createdAt: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                total: true,
              },
            },
            purchase: {
              select: {
                id: true,
                purchaseNo: true,
                vendorBillNo: true,
                total: true,
              },
            },
          },
        },
        refundInvoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    const summary = computePartyFinancialSummary(party);
    return {
      ...party,
      financialSummary: summary,
      netBalance: summary.netBalance,
      outstandingDue: summary.outstandingDue,
      storePayable: summary.storePayable,
    };
  }

  async getPartyBalance(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        creditLedgers: {
          where: {
            status: { not: CreditStatus.SETTLED },
          },
          select: {
            id: true,
            amountDue: true,
            type: true,
            status: true,
          },
        },
      },
    });
    if (!party) throw new NotFoundException(`Party ${id} not found`);

    let due = 0;
    let payable = 0;
    for (const cl of party.creditLedgers || []) {
      const amt = Math.max(0, Number(cl.amountDue || 0));
      if (cl.type === 'RECEIVABLE') due += amt;
      else if (cl.type === 'PAYABLE') payable += amt;
    }
    const net = Math.round((due - payable) * 100) / 100;
    return {
      partyId: party.id,
      name: party.name,
      phone: party.phone,
      netBalance: net,
      totalReceivable: Math.round(due * 100) / 100,
      totalPayable: Math.round(payable * 100) / 100,
      outstandingDue: net > 0.01 ? net : 0,
      storePayable: net < -0.01 ? Math.abs(net) : 0,
      unsettledCount: (party.creditLedgers || []).length,
    };
  }

  async update(id: string, data: UpdatePartyDto) {
    await this.findOne(id);
    const res = await this.prisma.party.update({ where: { id }, data });
    this.cacheService.invalidatePrefix('parties:');
    return res;
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
          (cl) => cl.invoiceId === inv.id,
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
      this.cacheService.invalidatePrefix('parties:');
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }

    // If no historical invoices exist, attempt hard-delete; fall back to soft delete if relations exist
    try {
      await this.prisma.party.delete({ where: { id } });
      this.cacheService.invalidatePrefix('parties:');
      return {
        success: true,
        message: `Customer '${party.name}' permanently deleted.`,
      };
    } catch {
      await this.prisma.party.update({
        where: { id },
        data: { isSaved: false },
      });
      this.cacheService.invalidatePrefix('parties:');
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }
  }

  async generateStatementPdf(id: string, startDate?: string, endDate?: string) {
    const { start, end, startFormatted, endFormatted } = getStatementDateRange(
      startDate,
      endDate,
    );

    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        invoices: {
          where: {
            status: { not: InvoiceStatus.DRAFT },
          },
          include: {
            items: { include: { product: true } },
            payments: {
              where: { status: PaymentStatus.CONFIRMED },
              orderBy: { paidAt: 'asc' },
            },
            refundInvoices: true,
          },
          orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
        },
        purchases: {
          where: {
            status: { not: 'CANCELLED' },
          },
          include: {
            items: { include: { product: true } },
            payments: {
              where: { status: PaymentStatus.CONFIRMED },
              orderBy: { paidAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        refundInvoices: {
          include: {
            items: { include: { product: true } },
            payments: { where: { status: PaymentStatus.CONFIRMED } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          include: {
            invoice: { select: { id: true, invoiceNo: true, status: true } },
            purchase: { select: { id: true, purchaseNo: true } },
          },
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
        debitNotes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!party) throw new NotFoundException(`Party ${id} not found`);

    const standaloneCreditLedgers = party.creditLedgers || [];

    // 1. Calculate Opening Balance strictly before start date
    let runningBal = 0;

    for (const inv of party.invoices) {
      if (
        inv.status === InvoiceStatus.CANCELLED &&
        inv.payments.length === 0 &&
        (!inv.refundInvoices || inv.refundInvoices.length === 0)
      ) {
        continue;
      }
      if (new Date(inv.invoiceDate || inv.createdAt) < start) {
        runningBal += Number(inv.total);
      }
    }

    for (const pur of party.purchases || []) {
      if (new Date(pur.createdAt) < start) {
        runningBal -= Number(pur.total);
      }
    }

    for (const p of party.payments) {
      const isInternalCredit =
        p.mode === 'CREDIT' ||
        p.notes?.toLowerCase().includes('store credit') ||
        p.notes?.toLowerCase().includes('offset');
      if (isInternalCredit) {
        continue;
      }
      const pDate = new Date(p.paidAt || p.createdAt);
      if (pDate < start) {
        if (p.type === PaymentType.INFLOW) {
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

    for (const dn of party.debitNotes || []) {
      if (new Date(dn.createdAt) < start) {
        runningBal += Number(dn.amount);
      }
    }

    for (const cl of standaloneCreditLedgers) {
      // If payment was made to record an advance overpayment, skip here because the payment
      // itself is already accounted for in party.payments. Adding it again double-deducts.
      if (
        cl.notes?.toLowerCase().includes('overpayment') ||
        cl.notes?.toLowerCase().includes('advance customer')
      ) {
        continue;
      }
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

    // 2. Identify in-period transactions
    interface RawTx {
      date: Date;
      txnType: string;
      refNo: string;
      status: string;
      totalAmount: number;
      receivedAmount: number;
      txnBalance: number;
      paymentType?: string | null;
      items?: StatementItem[];
      subtotal?: number;
      shipping?: number;
      discount?: number;
      tax?: number;
      roundOff?: number;
    }

    const rawTxs: RawTx[] = [];
    const upfrontPaymentIds = new Set<string>();

    for (const inv of party.invoices) {
      if (
        inv.status === InvoiceStatus.CANCELLED &&
        inv.payments.length === 0 &&
        (!inv.refundInvoices || inv.refundInvoices.length === 0)
      ) {
        continue;
      }
      const d = new Date(inv.invoiceDate || inv.createdAt);
      if (d >= start && d <= end) {
        // Collect real money upfront payments made at invoice creation time
        // Internal credit offsets (PaymentMode.CREDIT / Store Credit) are ledger offsets, not cash inflows,
        // and must not zero out the invoice debit in a running balance statement.
        const upfrontSplits = inv.payments.filter(
          (p) =>
            p.mode !== 'CREDIT' &&
            !p.notes?.toLowerCase().includes('store credit') &&
            !p.notes?.toLowerCase().includes('offset') &&
            (p.notes?.toLowerCase().includes('upfront') ||
              p.notes?.toLowerCase().includes('invoice creation')),
        );

        for (const p of upfrontSplits) {
          upfrontPaymentIds.add(p.id);
        }

        const totalUpfrontPaid = upfrontSplits.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const invTotal = Number(inv.total);
        const receivedAmount = totalUpfrontPaid;
        const txnBalance = Math.max(
          0,
          invTotal - Math.min(invTotal, totalUpfrontPaid),
        );

        const allConfirmedPaid = inv.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        let status = 'Unpaid';
        if (inv.status === InvoiceStatus.CANCELLED) {
          status = 'Cancelled';
        } else if (invTotal - allConfirmedPaid <= 0.01) {
          status = 'Paid';
        } else if (allConfirmedPaid > 0) {
          status = 'Partial';
        }

        const upfrontModes = upfrontSplits.map((p) => p.mode).filter(Boolean);
        const paymentTypeStr =
          upfrontModes.length > 0
            ? upfrontModes.join(', ')
            : inv.paymentMode || null;

        const items: StatementItem[] = inv.items.map((it) => ({
          name: it.product?.name || 'Item',
          quantity: Number(it.qty || 1),
          unit: it.product?.unit || 'Box',
          price: Number(it.unitPrice || 0),
          total: Number(it.total || 0),
        }));

        const taxBreakup = (inv as any).taxBreakup as {
          cgst?: number;
          sgst?: number;
          igst?: number;
        } | null;
        const totalTax = taxBreakup
          ? (Number(taxBreakup.cgst) || 0) +
            (Number(taxBreakup.sgst) || 0) +
            (Number(taxBreakup.igst) || 0)
          : 0;

        rawTxs.push({
          date: d,
          txnType: 'Sale',
          refNo: inv.invoiceNo,
          status,
          totalAmount: invTotal,
          receivedAmount,
          txnBalance,
          paymentType: paymentTypeStr,
          items,
          subtotal: Number(inv.subtotal || 0),
          shipping: Number(inv.transportCost || 0),
          discount: Number(inv.discountAmount || 0),
          tax: totalTax > 0 ? totalTax : undefined,
          roundOff: Number(inv.roundOffAmount || 0),
        });
      }
    }

    for (const pur of party.purchases || []) {
      const d = new Date(pur.createdAt);
      if (d >= start && d <= end) {
        const upfrontSplits = pur.payments.filter(
          (p) =>
            p.notes?.toLowerCase().includes('upfront') ||
            p.notes?.toLowerCase().includes('purchase creation'),
        );

        for (const p of upfrontSplits) {
          upfrontPaymentIds.add(p.id);
        }

        const totalUpfrontPaid = upfrontSplits.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const purTotal = Number(pur.total);
        const receivedAmount = totalUpfrontPaid;
        const txnBalance = Math.max(
          0,
          purTotal - Math.min(purTotal, totalUpfrontPaid),
        );

        const allConfirmedPaid = pur.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        let status = 'Unpaid';
        if (purTotal - allConfirmedPaid <= 0.01) {
          status = 'Paid';
        } else if (allConfirmedPaid > 0) {
          status = 'Partial';
        }

        const items: StatementItem[] = pur.items.map((it) => ({
          name: it.product?.name || 'Item',
          quantity: Number(it.qty || 1),
          unit: it.product?.unit || 'Box',
          price: Number(it.unitPrice || 0),
          total: Number(it.total || 0),
        }));

        rawTxs.push({
          date: d,
          txnType: 'Purchase',
          refNo: pur.purchaseNo,
          status,
          totalAmount: purTotal,
          receivedAmount,
          txnBalance,
          paymentType: pur.paymentMode || null,
          items,
          subtotal: Number(pur.subtotal || 0),
        });
      }
    }

    for (const p of party.payments) {
      const d = new Date(p.paidAt || p.createdAt);
      if (d >= start && d <= end) {
        if (upfrontPaymentIds.has(p.id)) {
          continue; // Already accounted for in Sale row
        }
        const isInternalCredit =
          p.mode === 'CREDIT' ||
          p.notes?.toLowerCase().includes('store credit') ||
          p.notes?.toLowerCase().includes('offset');
        if (isInternalCredit) {
          continue; // Skip standalone Payment-in emission for internal credit notes
        }

        const amt = Number(p.amount);
        const isInflow = p.type === PaymentType.INFLOW;
        rawTxs.push({
          date: d,
          txnType: isInflow ? 'Payment-in' : 'Payment-out',
          refNo:
            p.upiTxnRef || p.upiUtr || p.invoice?.invoiceNo || p.id.slice(0, 6),
          status: 'Used',
          totalAmount: amt,
          receivedAmount: amt,
          txnBalance: 0,
          paymentType: p.mode || 'Cash',
        });
      }
    }

    for (const r of party.refundInvoices) {
      const d = new Date(r.createdAt);
      if (d >= start && d <= end) {
        const rTotal = Number(r.total);
        const items: StatementItem[] = r.items.map((it) => ({
          name: it.product?.name || it.customItemName || 'Returned Goods',
          quantity: Number(it.qty || 1),
          unit: it.product?.unit || 'Box',
          price: Number(it.unitPrice || 0),
          total: Number(it.total || 0),
        }));

        rawTxs.push({
          date: d,
          txnType: 'Credit Note',
          refNo: r.refundNo,
          status: 'Paid',
          totalAmount: rTotal,
          receivedAmount: 0,
          txnBalance: rTotal,
          paymentType: r.refundMode || null,
          items,
          subtotal: Number(r.subtotal || 0),
        });
      }
    }

    for (const dn of party.debitNotes || []) {
      const d = new Date(dn.createdAt);
      if (d >= start && d <= end) {
        const dnTotal = Number(dn.amount);
        rawTxs.push({
          date: d,
          txnType: 'Debit Note',
          refNo: dn.debitNoteNo,
          status: 'Applied',
          totalAmount: dnTotal,
          receivedAmount: 0,
          txnBalance: dnTotal,
          paymentType: dn.reason || null,
        });
      }
    }

    for (const cl of standaloneCreditLedgers) {
      // Skip overpayment ledgers created from payments already included in party.payments
      if (
        cl.notes?.toLowerCase().includes('overpayment') ||
        cl.notes?.toLowerCase().includes('advance customer')
      ) {
        continue;
      }
      const d = new Date(cl.createdAt);
      if (d >= start && d <= end) {
        const amt = getCreditLedgerOriginalAmount(cl);
        rawTxs.push({
          date: d,
          txnType: cl.type === 'RECEIVABLE' ? 'Direct Due' : 'Store Payable',
          refNo: cl.id.slice(0, 6).toUpperCase(),
          status: cl.status,
          totalAmount: amt,
          receivedAmount: 0,
          txnBalance: amt,
          paymentType: cl.notes || null,
        });
      }
    }

    rawTxs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 3. Construct chronological statement entries with running Receivable & Payable balances
    const entries: StatementEntry[] = [];
    let currentBal = openingBalance;

    // Row 1: Beginning Balance
    if (startDate || openingBalance !== 0) {
      entries.push({
        date: start,
        txnType:
          currentBal < 0
            ? 'Payable Beginning Balance'
            : 'Receivable Beginning Balance',
        refNo: '—',
        status: '—',
        totalAmount: 0,
        receivedAmount: 0,
        txnBalance: 0,
        receivableBalance: currentBal >= 0 ? currentBal : null,
        payableBalance: currentBal < 0 ? Math.abs(currentBal) : null,
      });
    }

    for (const tx of rawTxs) {
      if (tx.txnType === 'Sale') {
        currentBal += tx.txnBalance;
      } else if (tx.txnType === 'Purchase') {
        currentBal -= tx.txnBalance;
      } else if (tx.txnType === 'Payment-in') {
        currentBal -= tx.receivedAmount;
      } else if (tx.txnType === 'Payment-out') {
        currentBal += tx.receivedAmount;
      } else if (tx.txnType === 'Credit Note') {
        currentBal -= tx.totalAmount;
      } else if (tx.txnType === 'Debit Note') {
        currentBal += tx.totalAmount;
      } else if (tx.txnType === 'Direct Due') {
        currentBal += tx.totalAmount;
      } else if (tx.txnType === 'Store Payable') {
        currentBal -= tx.totalAmount;
      }

      entries.push({
        date: tx.date,
        txnType: tx.txnType,
        refNo: tx.refNo,
        status: tx.status,
        totalAmount: tx.totalAmount,
        receivedAmount: tx.receivedAmount,
        txnBalance: tx.txnBalance,
        receivableBalance: currentBal >= 0 ? currentBal : null,
        payableBalance: currentBal < 0 ? Math.abs(currentBal) : null,
        paymentType: tx.paymentType,
        items: tx.items,
        subtotal: tx.subtotal,
        shipping: tx.shipping,
        discount: tx.discount,
        tax: tx.tax,
        roundOff: tx.roundOff,
      });
    }

    return generatePartyStatementPdf({
      party,
      startDate: startFormatted,
      endDate: endFormatted,
      openingBalance,
      closingBalance: currentBal,
      entries,
    });
  }
}
