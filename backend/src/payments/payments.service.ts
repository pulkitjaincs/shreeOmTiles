import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentDto,
  CreateCreditDto,
  UpdatePaymentDto,
} from './dto/create-payment.dto';
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMode,
  CreditType,
  PaymentType,
  DeliveryStatus,
  Role,
  Prisma,
} from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import { generateUpiIntentQr } from '../common/utils/upi.util';
import { NotificationsService } from '../notifications/notifications.service';

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    invoice: { include: { party: true } };
    party: true;
    confirmedBy: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async updateReceivedPayment(
    id: string,
    data: UpdatePaymentDto,
    actorId: string,
    actorRole?: Role,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundException(`Payment ${id} not found`);
      if (payment.type === PaymentType.OUTFLOW) {
        throw new BadRequestException('Only received payments can be edited');
      }

      if (actorRole === Role.SALESMAN) {
        const isAllowed =
          (payment.invoice && payment.invoice.salesmanId === actorId) ||
          payment.confirmedById === actorId;
        if (!isAllowed) {
          throw new ForbiddenException(
            'Salesmen can only edit payments collected by them or for their invoices',
          );
        }
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          mode: data.mode ?? payment.mode,
          amount:
            data.amount !== undefined
              ? new Prisma.Decimal(Number(data.amount).toFixed(2))
              : undefined,
          upiTxnRef: data.upiTxnRef,
          upiUtr: data.upiUtr,
          notes: data.notes,
        },
        include: {
          invoice: { include: { party: true } },
          party: true,
          confirmedBy: { select: { id: true, name: true } },
        },
      });

      if (payment.invoiceId && payment.invoice) {
        const confirmed = await tx.payment.findMany({
          where: {
            invoiceId: payment.invoiceId,
            status: PaymentStatus.CONFIRMED,
          },
        });
        const totalPaid = Math.max(
          0,
          confirmed.reduce(
            (sum, item) =>
              item.type === PaymentType.OUTFLOW
                ? sum - Number(item.amount)
                : sum + Number(item.amount),
            0,
          ),
        );
        const total = Number(payment.invoice.total);
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status:
              totalPaid >= total
                ? InvoiceStatus.PAID
                : totalPaid > 0
                  ? InvoiceStatus.PARTIAL
                  : InvoiceStatus.CREATED,
          },
        });
        const ledger = await tx.creditLedger.findFirst({
          where: { invoiceId: payment.invoiceId, type: CreditType.RECEIVABLE },
        });
        if (ledger) {
          const due = Math.max(0, total - totalPaid);
          await tx.creditLedger.update({
            where: { id: ledger.id },
            data: {
              amountDue: new Prisma.Decimal(due.toFixed(2)),
              status:
                due === 0 ? 'SETTLED' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID',
            },
          });
        }
        await tx.delivery.updateMany({
          where: {
            invoiceId: payment.invoiceId,
            status: { not: DeliveryStatus.DELIVERED },
          },
          data: {
            amountToCollect: new Prisma.Decimal(
              Math.max(0, total - totalPaid).toFixed(2),
            ),
          },
        });
      } else if (payment.partyId) {
        throw new BadRequestException(
          'Standalone received payments cannot be edited yet',
        );
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EDIT_PAYMENT',
          entity: 'Payment',
          entityId: id,
          diff: {
            oldAmount: Number(payment.amount),
            newAmount: Number(updated.amount),
            oldMode: payment.mode,
            newMode: updated.mode,
          },
        },
      });
      return updated;
    });
  }

  async create(
    data: CreatePaymentDto,
    user?: { id: string; role: Role; name?: string } | string,
  ) {
    const userId = typeof user === 'string' ? user : user?.id;
    const actorRole = typeof user === 'object' ? user?.role : undefined;

    let partyId = data.partyId;
    if (data.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: data.invoiceId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (actorRole === Role.SALESMAN && invoice.salesmanId !== userId) {
        throw new ForbiddenException(
          'Salesmen can only collect payments for their own invoices',
        );
      }
      partyId = invoice.partyId;
    } else if (actorRole === Role.SALESMAN) {
      throw new ForbiddenException(
        'Salesmen can only collect payments linked to an invoice',
      );
    }

    const paymentType =
      data.type || (data.invoiceId ? PaymentType.INFLOW : PaymentType.INFLOW);

    // Normalize splits from either data.splits or legacy single payment
    let splits: Array<{
      mode: PaymentMode;
      amount: number;
      upiTxnRef?: string;
      upiUtr?: string;
      notes?: string;
    }> = [];

    if (data.splits && data.splits.length > 0) {
      splits = data.splits
        .filter((s) => Number(s.amount) > 0)
        .map((s) => ({
          mode: s.mode,
          amount: Number(s.amount),
          upiTxnRef: s.upiTxnRef || data.upiTxnRef,
          upiUtr: s.upiUtr || data.upiUtr,
          notes: s.notes || data.notes,
        }));
    } else if (data.mode && data.amount && Number(data.amount) > 0) {
      splits = [
        {
          mode: data.mode,
          amount: Number(data.amount),
          upiTxnRef: data.upiTxnRef,
          upiUtr: data.upiUtr,
          notes: data.notes,
        },
      ];
    }

    if (splits.length === 0) {
      throw new BadRequestException(
        'At least one payment split with a positive amount is required',
      );
    }

    const totalSplitAmount =
      Math.round(splits.reduce((sum, s) => sum + Number(s.amount), 0) * 100) /
      100;

    if (data.autoConfirm) {
      const createdPayments = await this.prisma.$transaction(async (tx) => {
        const txPayments: PaymentWithRelations[] = [];
        for (const split of splits) {
          const p = await tx.payment.create({
            data: {
              invoiceId: data.invoiceId || null,
              partyId: partyId || null,
              mode: split.mode,
              type: paymentType,
              amount: new Prisma.Decimal(split.amount.toFixed(2)),
              upiTxnRef: split.upiTxnRef,
              upiUtr: split.upiUtr,
              notes: split.notes,
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
          txPayments.push(p);
        }

        const primaryPayment = txPayments[0];

        // 1. If tied to an invoice, recalculate invoice status & update credit ledger
        if (data.invoiceId) {
          const allConfirmed = await tx.payment.findMany({
            where: {
              invoiceId: data.invoiceId,
              status: PaymentStatus.CONFIRMED,
            },
          });
          const totalPaid = Math.max(
            0,
            allConfirmed.reduce(
              (sum, p) =>
                p.type === PaymentType.OUTFLOW
                  ? sum - Number(p.amount)
                  : sum + Number(p.amount),
              0,
            ),
          );
          const inv = await tx.invoice.findUnique({
            where: { id: data.invoiceId },
          });
          const invoiceTotal = Number(inv?.total || 0);
          if (inv) {
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
            const remainingDue = Math.max(0, invoiceTotal - totalPaid);
            await tx.creditLedger.update({
              where: { id: creditEntry.id },
              data: {
                amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
                status:
                  remainingDue === 0
                    ? 'SETTLED'
                    : totalPaid > 0
                      ? 'PARTIAL'
                      : 'UNPAID',
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
          let remainingPayment = totalSplitAmount;
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

          if (remainingPayment > 0.01 && paymentType === PaymentType.INFLOW) {
            await tx.creditLedger.create({
              data: {
                partyId,
                amountDue: new Prisma.Decimal(remainingPayment.toFixed(2)),
                type: CreditType.PAYABLE,
                status: 'UNPAID',
                notes: `Advance customer overpayment from Payment #${primaryPayment?.id ? primaryPayment.id.slice(0, 8) : ''}`,
              },
            });
          }
        }

        return txPayments;
      });

      // Notify Owner & Admin about payment / settlement
      const primary = createdPayments[0];
      const partyName: string =
        primary?.party?.name || primary?.invoice?.party?.name || 'Party';
      const formattedAmount =
        Math.round(totalSplitAmount).toLocaleString('en-IN');
      const isOutflow = paymentType === PaymentType.OUTFLOW;

      void this.notifications.notifyAdmins(
        isOutflow ? 'Store Payable Settled' : 'Payment Received!',
        isOutflow
          ? `₹${formattedAmount} paid to ${partyName}.`
          : `₹${formattedAmount} received from ${partyName}.`,
        {
          type: 'PAYMENT_RECEIVED',
          paymentId: primary?.id,
          invoiceId: primary?.invoiceId || undefined,
          partyId: partyId || undefined,
        },
      );

      return createdPayments.length === 1
        ? createdPayments[0]
        : createdPayments;
    }

    const pendingPayments: PaymentWithRelations[] = await Promise.all(
      splits.map((split) =>
        this.prisma.payment.create({
          data: {
            invoiceId: data.invoiceId || null,
            partyId: partyId || null,
            mode: split.mode,
            type: paymentType,
            amount: new Prisma.Decimal(split.amount.toFixed(2)),
            upiTxnRef: split.upiTxnRef,
            upiUtr: split.upiUtr,
            notes: split.notes,
            status: PaymentStatus.PENDING,
          },
          include: {
            invoice: { include: { party: true } },
            party: true,
            confirmedBy: { select: { id: true, name: true } },
          },
        }),
      ),
    );

    return pendingPayments.length === 1 ? pendingPayments[0] : pendingPayments;
  }

  async findAll(
    pagination?: PaginationParams,
    user?: { id: string; role: Role },
  ): Promise<any> {
    const where: Prisma.PaymentWhereInput =
      user?.role === Role.SALESMAN ? { invoice: { salesmanId: user.id } } : {};

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
          where,
          include: includeRelations,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
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
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, user?: { id: string; role: Role }) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: { include: { party: true } },
        party: true,
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    if (
      user?.role === Role.SALESMAN &&
      payment.invoice?.salesmanId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this payment',
      );
    }
    return payment;
  }

  async confirmPayment(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
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
          (sum, p) =>
            p.type === PaymentType.OUTFLOW
              ? sum - Number(p.amount)
              : sum + Number(p.amount),
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
        const remainingDue = Math.max(0, invoiceTotal - totalPaid);
        const creditEntry = await tx.creditLedger.findFirst({
          where: { invoiceId: payment.invoiceId },
        });
        if (creditEntry) {
          await tx.creditLedger.update({
            where: { id: creditEntry.id },
            data: {
              amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
              status:
                remainingDue === 0
                  ? 'SETTLED'
                  : totalPaid > 0
                    ? 'PARTIAL'
                    : 'UNPAID',
            },
          });
        }

        // 5. Sync linked active deliveries amountToCollect
        await tx.delivery.updateMany({
          where: {
            invoiceId: payment.invoiceId,
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
            amountToCollect: new Prisma.Decimal(remainingDue.toFixed(2)),
          },
        });
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

        if (remainingPayment > 0.01 && payment.type === PaymentType.INFLOW) {
          await tx.creditLedger.create({
            data: {
              partyId: payment.partyId,
              amountDue: new Prisma.Decimal(remainingPayment.toFixed(2)),
              type: CreditType.PAYABLE,
              status: 'UNPAID',
              notes: `Advance customer overpayment from confirmed Payment #${payment.id.slice(0, 8)}`,
            },
          });
        }
      }

      return updatedPayment;
    });

    // Notify Owner & Admin about confirmed payment
    const partyName =
      result.party?.name || result.invoice?.party?.name || 'Party';
    const formattedAmount = Math.round(Number(result.amount)).toLocaleString(
      'en-IN',
    );
    const modeText = result.mode ? `via ${result.mode}` : '';

    void this.notifications.notifyAdmins(
      'Payment Confirmed',
      `Payment of ₹${formattedAmount} for ${partyName} confirmed ${modeText}.`,
      {
        type: 'PAYMENT_RECEIVED',
        paymentId: result.id,
        invoiceId: result.invoiceId,
        partyId: result.partyId,
      },
    );

    return result;
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

  async findAllCreditLedgers(user?: { id: string; role: Role }) {
    const where: Prisma.CreditLedgerWhereInput =
      user?.role === Role.SALESMAN ? { invoice: { salesmanId: user.id } } : {};

    return this.prisma.creditLedger.findMany({
      where,
      include: {
        party: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(user?: { id: string; role: Role }) {
    const isSalesman = user?.role === Role.SALESMAN;
    const invoiceFilter = isSalesman ? { salesmanId: user.id } : {};
    const paymentInvoiceFilter = isSalesman
      ? { invoice: { salesmanId: user.id } }
      : {};
    const creditInvoiceFilter = isSalesman
      ? { invoice: { salesmanId: user.id } }
      : {};

    const [
      invoiceAgg,
      inflowAgg,
      outflowAgg,
      cashAgg,
      upiAgg,
      bankAgg,
      cardAgg,
      receivablesAgg,
      payablesAgg,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          ...invoiceFilter,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
        },
        _sum: { total: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentInvoiceFilter,
          status: PaymentStatus.CONFIRMED,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      isSalesman
        ? Promise.resolve({ _sum: { amount: null } })
        : this.prisma.payment.aggregate({
            where: {
              status: PaymentStatus.CONFIRMED,
              type: PaymentType.OUTFLOW,
            },
            _sum: { amount: true },
          }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentInvoiceFilter,
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.CASH,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentInvoiceFilter,
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.UPI,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentInvoiceFilter,
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.BANK_TRANSFER,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...paymentInvoiceFilter,
          status: PaymentStatus.CONFIRMED,
          mode: PaymentMode.CARD,
          type: PaymentType.INFLOW,
        },
        _sum: { amount: true },
      }),
      this.prisma.creditLedger.aggregate({
        where: {
          ...creditInvoiceFilter,
          status: { not: 'SETTLED' },
          type: CreditType.RECEIVABLE,
        },
        _sum: { amountDue: true },
      }),
      isSalesman
        ? Promise.resolve({ _sum: { amountDue: null } })
        : this.prisma.creditLedger.aggregate({
            where: { status: { not: 'SETTLED' }, type: CreditType.PAYABLE },
            _sum: { amountDue: true },
          }),
    ]);

    const totalCollected = Math.max(
      0,
      Number(inflowAgg._sum.amount || 0) - Number(outflowAgg._sum.amount || 0),
    );

    return {
      totalSales: Number(invoiceAgg._sum.total || 0),
      totalCollected,
      totalPaidOut: Number(outflowAgg._sum.amount || 0),
      cashCollected: Number(cashAgg._sum.amount || 0),
      upiCollected: Number(upiAgg._sum.amount || 0),
      bankCollected: Number(bankAgg._sum.amount || 0),
      cardCollected: Number(cardAgg._sum.amount || 0),
      pendingReceivables: Number(receivablesAgg._sum.amountDue || 0),
      creditsOwed: Number(payablesAgg._sum.amountDue || 0),
    };
  }

  async getPendingItems(user?: { id: string; role: Role }) {
    const isSalesman = user?.role === Role.SALESMAN;

    // 1. Invoices that are CREATED or PARTIAL
    const pendingInvoices = await this.prisma.invoice.findMany({
      where: {
        ...(isSalesman ? { salesmanId: user.id } : {}),
        status: { in: [InvoiceStatus.CREATED, InvoiceStatus.PARTIAL] },
      },
      include: {
        party: true,
        payments: { where: { status: PaymentStatus.CONFIRMED } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Unsettled credit ledgers:
    // If salesman: only receivables linked to their invoices!
    // If owner/admin/accountant: all store payables or standalone customer debts
    const pendingLedgers = await this.prisma.creditLedger.findMany({
      where: isSalesman
        ? {
            status: { not: 'SETTLED' },
            type: CreditType.RECEIVABLE,
            invoice: { salesmanId: user.id },
          }
        : {
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
            (sum, p) =>
              p.type === PaymentType.OUTFLOW
                ? sum - Number(p.amount)
                : sum + Number(p.amount),
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

  async deletePayment(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { invoice: true, purchase: true, refundInvoice: true },
      });
      if (!payment) throw new NotFoundException(`Payment ${id} not found`);

      await tx.payment.delete({ where: { id } });

      if (payment.invoiceId && payment.invoice) {
        const confirmed = await tx.payment.findMany({
          where: {
            invoiceId: payment.invoiceId,
            status: PaymentStatus.CONFIRMED,
          },
        });
        const totalPaid = Math.max(
          0,
          confirmed.reduce(
            (sum, item) =>
              item.type === PaymentType.OUTFLOW
                ? sum - Number(item.amount)
                : sum + Number(item.amount),
            0,
          ),
        );
        const total = Number(payment.invoice.total);
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status:
              totalPaid >= total
                ? InvoiceStatus.PAID
                : totalPaid > 0
                  ? InvoiceStatus.PARTIAL
                  : InvoiceStatus.CREATED,
          },
        });
        const ledger = await tx.creditLedger.findFirst({
          where: { invoiceId: payment.invoiceId, type: CreditType.RECEIVABLE },
        });
        if (ledger) {
          const due = Math.max(0, total - totalPaid);
          await tx.creditLedger.update({
            where: { id: ledger.id },
            data: {
              amountDue: new Prisma.Decimal(due.toFixed(2)),
              status:
                due === 0 ? 'SETTLED' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID',
            },
          });
        }
        await tx.delivery.updateMany({
          where: {
            invoiceId: payment.invoiceId,
            status: { not: DeliveryStatus.DELIVERED },
          },
          data: {
            amountToCollect: new Prisma.Decimal(
              Math.max(0, total - totalPaid).toFixed(2),
            ),
          },
        });
      }

      if (payment.purchaseId && payment.purchase) {
        const purchasePayments = await tx.payment.findMany({
          where: {
            purchaseId: payment.purchaseId,
            status: PaymentStatus.CONFIRMED,
          },
        });
        const paid = purchasePayments.reduce((s, p) => s + Number(p.amount), 0);
        const total = Number(payment.purchase.total);
        const ledger = await tx.creditLedger.findFirst({
          where: { purchaseId: payment.purchaseId, type: CreditType.PAYABLE },
        });
        if (ledger) {
          const due = Math.max(0, total - paid);
          await tx.creditLedger.update({
            where: { id: ledger.id },
            data: {
              amountDue: new Prisma.Decimal(due.toFixed(2)),
              status: due === 0 ? 'SETTLED' : paid > 0 ? 'PARTIAL' : 'UNPAID',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_PAYMENT',
          entity: 'Payment',
          entityId: id,
          diff: {
            amount: Number(payment.amount),
            type: payment.type,
            mode: payment.mode,
            invoiceId: payment.invoiceId,
            purchaseId: payment.purchaseId,
          },
        },
      });

      return { success: true, message: 'Payment deleted successfully' };
    });
  }
}
