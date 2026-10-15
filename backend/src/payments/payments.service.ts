import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, CreateCreditDto } from './dto/create-payment.dto';
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMode,
  CreditType,
  PaymentType,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import { generateUpiIntentQr } from '../common/utils/upi.util';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentDto, userId?: string) {
    let partyId = data.partyId;
    if (data.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: data.invoiceId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      partyId = invoice.partyId;
    }

    const paymentType =
      data.type || (data.invoiceId ? PaymentType.INFLOW : PaymentType.INFLOW);

    if (data.autoConfirm) {
      return this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            invoiceId: data.invoiceId || null,
            partyId: partyId || null,
            mode: data.mode,
            type: paymentType,
            amount: new Prisma.Decimal(data.amount.toFixed(2)),
            upiTxnRef: data.upiTxnRef,
            upiUtr: data.upiUtr,
            notes: data.notes,
            status: PaymentStatus.CONFIRMED,
            paidAt: new Date(),
            confirmedById: userId || null,
          },
          include: {
            invoice: { include: { party: true } },
            party: true,
            confirmedBy: { select: { id: true, name: true } },
          },
        });

        // 1. If tied to an invoice, recalculate invoice status & update credit ledger
        if (data.invoiceId) {
          const allConfirmed = await tx.payment.findMany({
            where: {
              invoiceId: data.invoiceId,
              status: PaymentStatus.CONFIRMED,
            },
          });
          const totalPaid = allConfirmed.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
          const inv = await tx.invoice.findUnique({
            where: { id: data.invoiceId },
          });
          if (inv) {
            const invoiceTotal = Number(inv.total);
            let newInvoiceStatus: InvoiceStatus = InvoiceStatus.CREATED;
            if (totalPaid >= invoiceTotal) {
              newInvoiceStatus = InvoiceStatus.PAID;
            } else if (totalPaid > 0) {
              newInvoiceStatus = InvoiceStatus.PARTIAL;
            }
            await tx.invoice.update({
              where: { id: data.invoiceId },
              data: { status: newInvoiceStatus },
            });
          }

          // Update linked creditLedger if exists
          const creditEntry = await tx.creditLedger.findFirst({
            where: { invoiceId: data.invoiceId },
          });
          if (creditEntry) {
            const remainingDue = Math.max(
              0,
              Number(creditEntry.amountDue) - Number(data.amount),
            );
            await tx.creditLedger.update({
              where: { id: creditEntry.id },
              data: {
                amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
                status: remainingDue === 0 ? 'SETTLED' : 'PARTIAL',
              },
            });
          }

          // Auto-sync any active deliveries for this invoice with the newly reduced remaining balance
          const remainingInvoiceBalance = Math.max(
            0,
            Number(inv?.total || 0) - totalPaid,
          );
          await tx.delivery.updateMany({
            where: {
              invoiceId: data.invoiceId,
              status: {
                in: [
                  DeliveryStatus.PENDING,
                  DeliveryStatus.ASSIGNED,
                  DeliveryStatus.OUT_FOR_PICKUP,
                  DeliveryStatus.PICKED_UP,
                  DeliveryStatus.OUT_FOR_DELIVERY,
                ],
              },
            },
            data: {
              amountToCollect: new Prisma.Decimal(
                remainingInvoiceBalance.toFixed(2),
              ),
            },
          });
        } else if (partyId) {
          // If payment is OUTFLOW (store paying party to settle store payable debt):
          // deduct from party's oldest unsettled PAYABLE credit ledger!
          // If payment is INFLOW (store receiving money from customer):
          // deduct from party's oldest unsettled RECEIVABLE credit ledger!
          const targetCreditType =
            paymentType === PaymentType.OUTFLOW
              ? CreditType.PAYABLE
              : CreditType.RECEIVABLE;
          let remainingPayment = Number(data.amount);
          const creditEntries = await tx.creditLedger.findMany({
            where: {
              partyId,
              type: targetCreditType,
              status: { not: 'SETTLED' },
            },
            orderBy: { createdAt: 'asc' },
          });
          for (const creditEntry of creditEntries) {
            if (remainingPayment <= 0.001) break;
            const currentDue = Number(creditEntry.amountDue);
            const deduct = Math.min(currentDue, remainingPayment);
            const remainingDue = Math.max(0, currentDue - deduct);
            await tx.creditLedger.update({
              where: { id: creditEntry.id },
              data: {
                amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
                status: remainingDue === 0 ? 'SETTLED' : 'PARTIAL',
              },
            });
            remainingPayment -= deduct;
          }
        }

        return payment;
      });
    }

    return this.prisma.payment.create({
      data: {
        invoiceId: data.invoiceId || null,
        partyId: partyId || null,
        mode: data.mode,
        type: paymentType,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        upiTxnRef: data.upiTxnRef,
        upiUtr: data.upiUtr,
        notes: data.notes,
        status: PaymentStatus.PENDING,
      },
      include: {
        invoice: { include: { party: true } },
        party: true,
        confirmedBy: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(pagination?: PaginationParams): Promise<any> {
    const includeRelations = {
      invoice: { include: { party: true } },
      party: true,
      confirmedBy: { select: { id: true, name: true } },
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.payment.findMany({
          include: includeRelations,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.payment.count(),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.prisma.payment.findMany({
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: { include: { party: true } },
        party: true,
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async confirmPayment(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          invoice: { include: { party: true } },
          party: true,
          confirmedBy: { select: { id: true, name: true } },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${id} not found`);
      }

      if (payment.status === PaymentStatus.CONFIRMED) {
        throw new BadRequestException('Payment is already confirmed');
      }

      // 1. Confirm Payment
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedById: userId,
          paidAt: new Date(),
        },
        include: {
          invoice: { include: { party: true } },
          party: true,
          confirmedBy: { select: { id: true, name: true } },
        },
      });

      // 2. Compute total confirmed payments for invoice if linked
      if (payment.invoiceId && payment.invoice) {
        const allConfirmed = await tx.payment.findMany({
          where: {
            invoiceId: payment.invoiceId,
            status: PaymentStatus.CONFIRMED,
          },
        });

        const totalPaid = allConfirmed.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const invoiceTotal = Number(payment.invoice.total);

        // 3. Update Invoice status
        let newInvoiceStatus: InvoiceStatus = InvoiceStatus.CREATED;
        if (totalPaid >= invoiceTotal) {
          newInvoiceStatus = InvoiceStatus.PAID;
        } else if (totalPaid > 0) {
          newInvoiceStatus = InvoiceStatus.PARTIAL;
        }

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: newInvoiceStatus },
        });

        // 4. Update Credit Ledger if credit entry exists
        const creditEntry = await tx.creditLedger.findFirst({
          where: { invoiceId: payment.invoiceId },
        });
        if (creditEntry) {
          const remainingDue = Math.max(
            0,
            Number(creditEntry.amountDue) - Number(payment.amount),
          );
          await tx.creditLedger.update({
            where: { id: creditEntry.id },
            data: {
              amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
              status: remainingDue === 0 ? 'SETTLED' : 'PARTIAL',
            },
          });
        }
      } else if (payment.partyId) {
        const targetCreditType =
          payment.type === PaymentType.OUTFLOW
            ? CreditType.PAYABLE
            : CreditType.RECEIVABLE;
        let remainingPayment = Number(payment.amount);
        const creditEntries = await tx.creditLedger.findMany({
          where: {
            partyId: payment.partyId,
            type: targetCreditType,
            status: { not: 'SETTLED' },
          },
          orderBy: { createdAt: 'asc' },
        });
        for (const creditEntry of creditEntries) {
          if (remainingPayment <= 0.001) break;
          const currentDue = Number(creditEntry.amountDue);
          const deduct = Math.min(currentDue, remainingPayment);
          const remainingDue = Math.max(0, currentDue - deduct);
          await tx.creditLedger.update({
            where: { id: creditEntry.id },
            data: {
              amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
              status: remainingDue === 0 ? 'SETTLED' : 'PARTIAL',
            },
          });
          remainingPayment -= deduct;
        }
      }

      return updatedPayment;
    });
  }

  async previewUpiQr(
    amount: number,
    note?: string,
    customVpa?: string,
    customMerchant?: string,
  ) {
    let vpa: string;
    let merchantName: string;
    let isConfigured: boolean;

    if (customVpa && customVpa.trim().length > 0) {
      vpa = customVpa.trim();
      merchantName = customMerchant?.trim() || 'Shree Om Tiles';
      isConfigured = true;
    } else {
      const setting = await this.prisma.companySetting.findUnique({
        where: { id: 'default' },
      });
      vpa = setting?.upiId || process.env.UPI_VPA || 'shreeom@bank';
      merchantName =
        setting?.merchantName ||
        process.env.UPI_MERCHANT_NAME ||
        'Shree Om Tiles';
      isConfigured = Boolean(setting?.upiId || process.env.UPI_VPA);
    }

    const ref = `SHREEOM-${Date.now().toString().slice(-6)}`;
    const qrResult = await generateUpiIntentQr({
      vpa,
      merchantName,
      amount,
      transactionRef: ref,
      transactionNote: note || 'Shree Om Tiles Payment',
    });

    return {
      amount: qrResult.amount,
      vpa,
      upiUri: qrResult.upiUri,
      qrDataUrl: qrResult.qrDataUrl,
      isConfigured,
    };
  }

  async recordCredit(data: CreateCreditDto) {
    const party = await this.prisma.party.findUnique({
      where: { id: data.partyId },
    });
    if (!party) throw new NotFoundException('Party not found');

    return this.prisma.creditLedger.create({
      data: {
        partyId: data.partyId,
        amountDue: new Prisma.Decimal(data.amount.toFixed(2)),
        type: data.type || CreditType.RECEIVABLE,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        status: 'UNPAID',
      },
      include: { party: true },
    });
  }

  async findAllCreditLedgers() {
    return this.prisma.creditLedger.findMany({
      include: {
        party: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [
      invoiceAgg,
      inflowAgg,
      outflowAgg,
      cashAgg,
      upiAgg,
      receivablesAgg,
      payablesAgg,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({ _sum: { total: true } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CONFIRMED, type: PaymentType.INFLOW },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CONFIRMED, type: PaymentType.OUTFLOW },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.CASH,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.UPI,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.creditLedger.aggregate({
        where: { status: { not: 'SETTLED' }, type: CreditType.RECEIVABLE },
        _sum: { amountDue: true },
      }),
      this.prisma.creditLedger.aggregate({
        where: { status: { not: 'SETTLED' }, type: CreditType.PAYABLE },
        _sum: { amountDue: true },
      }),
    ]);

    return {
      totalSales: Number(invoiceAgg._sum.total || 0),
      totalCollected: Number(inflowAgg._sum.amount || 0),
      totalPaidOut: Number(outflowAgg._sum.amount || 0),
      cashCollected: Number(cashAgg._sum.amount || 0),
      upiCollected: Number(upiAgg._sum.amount || 0),
      pendingReceivables: Number(receivablesAgg._sum.amountDue || 0),
      creditsOwed: Number(payablesAgg._sum.amountDue || 0),
    };
  }

  async getPendingItems() {
    // 1. Invoices that are CREATED or PARTIAL
    const pendingInvoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.CREATED, InvoiceStatus.PARTIAL] },
      },
      include: {
        party: true,
        payments: { where: { status: PaymentStatus.CONFIRMED } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Unsettled credit ledgers: all store payables (PAYABLE) or standalone customer debts (RECEIVABLE)
    const pendingLedgers = await this.prisma.creditLedger.findMany({
      where: {
        status: { not: 'SETTLED' },
        OR: [{ type: CreditType.PAYABLE }, { invoiceId: null }],
      },
      include: {
        party: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invoices: pendingInvoices
        .map((inv) => {
          const paid = inv.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
          const remainingDue = Math.max(0, Number(inv.total) - paid);
          return {
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            partyId: inv.partyId,
            partyName: inv.party?.name || 'Walk-in Customer',
            partyPhone: inv.party?.phone || '',
            total: Number(inv.total),
            paid,
            remainingDue,
            createdAt: inv.createdAt,
            status: inv.status,
          };
        })
        .filter((inv) => inv.remainingDue > 0.01),
      ledgers: pendingLedgers
        .filter((cl) => Number(cl.amountDue) > 0.01)
        .map((cl) => ({
          id: cl.id,
          partyId: cl.partyId,
          partyName: cl.party?.name || 'Party',
          partyPhone: cl.party?.phone || '',
          invoiceId: cl.invoiceId,
          invoiceNo: cl.invoice?.invoiceNo,
          amountDue: Number(cl.amountDue),
          type: cl.type,
          dueDate: cl.dueDate,
          status: cl.status,
          notes: cl.notes,
          createdAt: cl.createdAt,
        })),
    };
  }
}
