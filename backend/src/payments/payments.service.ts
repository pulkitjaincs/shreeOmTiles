import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
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
  CreditStatus,
  PaymentType,
  DeliveryStatus,
  Role,
  Prisma,
} from '@prisma/client';
import { PaginationParams, DateRangeFilter, buildDateRange } from '../common/interfaces/pagination.interface';
import { generateUpiIntentQr } from '../common/utils/upi.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../common/cache.service';

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    invoice: { include: { party: true } };
    party: true;
    confirmedBy: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class PaymentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Auto-heal historical records: synchronize Invoice & Purchase statuses
    // and clean up any orphaned or out-of-sync party overpayment ledgers
    try {
      // 1. Delete orphaned advance overpayment ledgers referencing payments that no longer exist
      const advanceLedgers = await this.prisma.creditLedger.findMany({
        where: {
          notes: { contains: 'Advance customer overpayment from Payment #' },
        },
      });
      const partyIdsToReconcile = new Set<string>();
      for (const cl of advanceLedgers) {
        const match = cl.notes?.match(/Payment #([a-f0-9]+)/i);
        if (match) {
          const shortId = match[1];
          const exists = await this.prisma.payment.findFirst({
            where: { id: { startsWith: shortId } },
            select: { id: true },
          });
          if (!exists) {
            await this.prisma.creditLedger.delete({ where: { id: cl.id } });
            if (cl.partyId) partyIdsToReconcile.add(cl.partyId);
          }
        }
      }

      for (const pid of partyIdsToReconcile) {
        await this.reconcilePartyFinancials(pid);
      }

      await this.prisma.$executeRawUnsafe(`
        UPDATE "Invoice"
        SET status = 'PAID', "updatedAt" = NOW()
        WHERE status IN ('CREATED', 'PARTIAL')
          AND id IN (
            SELECT "invoiceId"
            FROM "CreditLedger"
            WHERE "invoiceId" IS NOT NULL
            GROUP BY "invoiceId"
            HAVING BOOL_AND(status = 'SETTLED' OR "amountDue" <= 0.005)
          );
      `);

      await this.prisma.$executeRawUnsafe(`
        UPDATE "Purchase"
        SET status = 'PAID', "updatedAt" = NOW()
        WHERE status IN ('CREATED', 'PARTIAL')
          AND id IN (
            SELECT "purchaseId"
            FROM "CreditLedger"
            WHERE "purchaseId" IS NOT NULL
            GROUP BY "purchaseId"
            HAVING BOOL_AND(status = 'SETTLED' OR "amountDue" <= 0.005)
          );
      `);
      this.invalidatePaymentCaches();
    } catch {
      // Non-fatal if DB migration/schema not yet initialized
    }
  }

  async reconcilePartyFinancials(
    partyId: string,
    existingTx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      // 1. Delete orphaned overpayment ledgers for this party
      const partyOverpaymentLedgers = await tx.creditLedger.findMany({
        where: {
          partyId,
          notes: { contains: 'Advance customer overpayment from Payment #' },
        },
      });
      for (const cl of partyOverpaymentLedgers) {
        const match = cl.notes?.match(/Payment #([a-f0-9]+)/i);
        if (match) {
          const shortId = match[1];
          const exists = await tx.payment.findFirst({
            where: { id: { startsWith: shortId } },
            select: { id: true },
          });
          if (!exists) {
            await tx.creditLedger.delete({ where: { id: cl.id } });
          }
        }
      }

      const party = await tx.party.findUnique({
        where: { id: partyId },
        include: {
          invoices: {
            where: { status: { not: InvoiceStatus.CANCELLED } },
            include: { creditLedgers: true },
            orderBy: { createdAt: 'asc' },
          },
          payments: {
            where: { status: PaymentStatus.CONFIRMED },
            orderBy: { createdAt: 'asc' },
          },
          creditLedgers: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!party) return;

      // 2. Identify opening receivable and payable
      const openingReceivableLedger = party.creditLedgers.find(
        (cl) =>
          cl.type === CreditType.RECEIVABLE &&
          !cl.invoiceId &&
          !cl.purchaseId &&
          cl.notes?.toLowerCase().includes('opening balance'),
      );
      const openingReceivableAmt = openingReceivableLedger
        ? Number(openingReceivableLedger.notes?.match(/([0-9.]+)/)?.[1]) ||
          Number(openingReceivableLedger.amountDue) ||
          0
        : 0;

      const openingPayableLedger = party.creditLedgers.find(
        (cl) =>
          cl.type === CreditType.PAYABLE &&
          !cl.invoiceId &&
          !cl.purchaseId &&
          cl.notes?.toLowerCase().includes('opening balance'),
      );
      const openingPayableAmt = openingPayableLedger
        ? Number(openingPayableLedger.notes?.match(/([0-9.]+)/)?.[1]) ||
          Number(openingPayableLedger.amountDue) ||
          0
        : 0;

      // 3. Compute net inflows
      const totalInflows = party.payments
        .filter((p) => p.type === PaymentType.INFLOW)
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalOutflows = party.payments
        .filter((p) => p.type === PaymentType.OUTFLOW)
        .reduce((s, p) => s + Number(p.amount), 0);
      let remainingPayment = Math.max(0, totalInflows - totalOutflows);

      // Consume opening payable against invoice debt if applicable
      const totalInvoiced = party.invoices.reduce((s, inv) => s + Number(inv.total), 0);
      if (openingPayableLedger && openingPayableAmt > 0 && totalInvoiced > 0) {
        const payableUsed = Math.min(openingPayableAmt, totalInvoiced);
        const remOpeningPayable = Math.max(0, openingPayableAmt - payableUsed);
        remainingPayment += payableUsed;
        await tx.creditLedger.update({
          where: { id: openingPayableLedger.id },
          data: {
            amountDue: new Prisma.Decimal(remOpeningPayable.toFixed(2)),
            status:
              remOpeningPayable <= 0.01
                ? CreditStatus.SETTLED
                : CreditStatus.PARTIAL,
          },
        });
      }

      // 4. Settle opening balance
      if (openingReceivableLedger) {
        const deduct = Math.min(openingReceivableAmt, remainingPayment);
        const remainingOpening = Math.max(0, openingReceivableAmt - deduct);
        remainingPayment -= deduct;
        await tx.creditLedger.update({
          where: { id: openingReceivableLedger.id },
          data: {
            amountDue: new Prisma.Decimal(remainingOpening.toFixed(2)),
            status: remainingOpening <= 0.01 ? CreditStatus.SETTLED : CreditStatus.PARTIAL,
          },
        });
      }

      // 5. Settle invoices in FIFO order
      for (const inv of party.invoices) {
        const invTotal = Number(inv.total);
        const deduct = Math.min(invTotal, remainingPayment);
        const remainingDue = Math.max(0, invTotal - deduct);
        remainingPayment -= deduct;

        const newStatus =
          remainingDue <= 0.01
            ? InvoiceStatus.PAID
            : deduct > 0.01
              ? InvoiceStatus.PARTIAL
              : InvoiceStatus.CREATED;

        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: newStatus },
        });

        await tx.delivery.updateMany({
          where: {
            invoiceId: inv.id,
            status: { not: DeliveryStatus.DELIVERED },
          },
          data: {
            amountToCollect: new Prisma.Decimal(remainingDue.toFixed(2)),
          },
        });

        const invLedger = inv.creditLedgers.find(
          (cl) => cl.type === CreditType.RECEIVABLE,
        );
        if (invLedger) {
          await tx.creditLedger.update({
            where: { id: invLedger.id },
            data: {
              amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
              status:
                remainingDue <= 0.01
                  ? CreditStatus.SETTLED
                  : deduct > 0.01
                    ? CreditStatus.PARTIAL
                    : CreditStatus.UNPAID,
            },
          });
        } else if (remainingDue > 0.01) {
          await tx.creditLedger.create({
            data: {
              partyId: party.id,
              invoiceId: inv.id,
              amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
              type: CreditType.RECEIVABLE,
              status: deduct > 0.01 ? CreditStatus.PARTIAL : CreditStatus.UNPAID,
              notes: `Balance receivable for Invoice #${inv.invoiceNo}`,
            },
          });
        }
      }

      // 6. Settle or consolidate overpayment ledgers (Store Payables)
      const remainingPayableLedgers = await tx.creditLedger.findMany({
        where: {
          partyId,
          type: CreditType.PAYABLE,
          invoiceId: null,
          purchaseId: null,
          refundInvoiceId: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      const advanceOverpaymentLedgers = remainingPayableLedgers.filter(
        (cl) =>
          cl.notes?.includes('Advance customer overpayment') ||
          cl.notes?.includes('Advance customer balance'),
      );

      if (remainingPayment > 0.01) {
        const primaryOverpayment = advanceOverpaymentLedgers[0];
        if (primaryOverpayment) {
          await tx.creditLedger.update({
            where: { id: primaryOverpayment.id },
            data: {
              amountDue: new Prisma.Decimal(remainingPayment.toFixed(2)),
              status: CreditStatus.UNPAID,
              notes: `Advance customer balance (₹${remainingPayment.toFixed(2)})`,
            },
          });
          for (let i = 1; i < advanceOverpaymentLedgers.length; i++) {
            await tx.creditLedger.delete({
              where: { id: advanceOverpaymentLedgers[i].id },
            });
          }
        } else {
          await tx.creditLedger.create({
            data: {
              partyId,
              amountDue: new Prisma.Decimal(remainingPayment.toFixed(2)),
              type: CreditType.PAYABLE,
              status: CreditStatus.UNPAID,
              notes: `Advance customer balance (₹${remainingPayment.toFixed(2)})`,
            },
          });
        }
      } else {
        for (const cl of advanceOverpaymentLedgers) {
          await tx.creditLedger.delete({ where: { id: cl.id } });
        }
      }
    };

    if (existingTx) {
      await run(existingTx);
    } else {
      await this.prisma.$transaction(run);
      this.invalidatePaymentCaches();
    }
  }

  private invalidatePaymentCaches(): void {
    this.cacheService.invalidatePrefix('payments:');
    this.cacheService.invalidatePrefix('analytics:');
    this.cacheService.invalidatePrefix('parties:');
    this.cacheService.invalidatePrefix('invoices:');
    this.cacheService.invalidatePrefix('purchases:');
  }

  async updateReceivedPayment(
    id: string,
    data: UpdatePaymentDto,
    actorId: string,
    actorRole?: Role,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
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
    this.invalidatePaymentCaches();
    return updated;
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

            // If this credit ledger is linked to an invoice, synchronize invoice status & active deliveries
            if (creditEntry.invoiceId) {
              await tx.invoice.update({
                where: { id: creditEntry.invoiceId },
                data: {
                  status:
                    remainingDue <= 0.005
                      ? InvoiceStatus.PAID
                      : InvoiceStatus.PARTIAL,
                },
              });
              await tx.delivery.updateMany({
                where: {
                  invoiceId: creditEntry.invoiceId,
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
            }

            // If this credit ledger is linked to a purchase, synchronize purchase status
            if (creditEntry.purchaseId) {
              await tx.purchase.update({
                where: { id: creditEntry.purchaseId },
                data: {
                  status:
                    remainingDue <= 0.005
                      ? InvoiceStatus.PAID
                      : InvoiceStatus.PARTIAL,
                },
              });
            }

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
          } else if (
            remainingPayment > 0.01 &&
            paymentType === PaymentType.OUTFLOW
          ) {
            await tx.creditLedger.create({
              data: {
                partyId,
                amountDue: new Prisma.Decimal(remainingPayment.toFixed(2)),
                type: CreditType.RECEIVABLE,
                status: 'UNPAID',
                notes: `Advance store overpayment to vendor from Payment #${primaryPayment?.id ? primaryPayment.id.slice(0, 8) : ''}`,
              },
            });
          }
        }

        const targetPartyId =
          partyId ||
          (data.invoiceId
            ? (
                await tx.invoice.findUnique({
                  where: { id: data.invoiceId },
                  select: { partyId: true },
                })
              )?.partyId
            : null);
        if (targetPartyId) {
          await this.reconcilePartyFinancials(targetPartyId, tx);
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

      this.invalidatePaymentCaches();
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

    this.invalidatePaymentCaches();
    return pendingPayments.length === 1 ? pendingPayments[0] : pendingPayments;
  }

  async findAll(
    pagination?: PaginationParams & { dateFilter?: DateRangeFilter; search?: string },
    user?: { id: string; role: Role },
  ): Promise<any> {
    const cacheKey = `payments:list:${user?.role || 'ALL'}:${user?.id || 'ALL'}:${pagination?.page || 1}:${pagination?.limit || 'all'}:${pagination?.dateFilter?.preset || ''}:${pagination?.dateFilter?.from || ''}:${pagination?.dateFilter?.to || ''}:${pagination?.search || ''}`;
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const where: Prisma.PaymentWhereInput =
        user?.role === Role.SALESMAN
          ? { invoice: { salesmanId: user.id } }
          : {};

      const dateRange = buildDateRange(pagination?.dateFilter);
      if (dateRange) {
        where.createdAt = dateRange;
      }
      if (pagination?.search) {
        where.OR = [
          { invoice: { invoiceNo: { contains: pagination.search, mode: 'insensitive' } } },
          { party: { name: { contains: pagination.search, mode: 'insensitive' } } },
          { mode: { equals: pagination.search.toUpperCase() as any } },
        ] as any;
      }

      const includeRelations = {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            total: true,
            status: true,
            isCashSale: true,
            salesmanId: true,
            party: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        party: true,
        confirmedBy: { select: { id: true, name: true } },
      };

      if (pagination?.page !== undefined || pagination?.limit !== undefined) {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(Math.max(1, pagination?.limit || 40), 500);
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
        ...(dateRange || pagination?.search ? {} : { take: 2000 }),
      });
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

    this.invalidatePaymentCaches();
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

    const credit = await this.prisma.creditLedger.create({
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
    this.invalidatePaymentCaches();
    return credit;
  }

  async findAllCreditLedgers(
    user?: { id: string; role: Role },
    dateFilter?: DateRangeFilter,
  ) {
    const cacheKey = `payments:credits:${user?.role || 'ALL'}:${user?.id || 'ALL'}:${dateFilter?.preset || ''}:${dateFilter?.from || ''}:${dateFilter?.to || ''}`;
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const where: Prisma.CreditLedgerWhereInput =
        user?.role === Role.SALESMAN
          ? { invoice: { salesmanId: user.id } }
          : {};

      const dateRange = buildDateRange(dateFilter);
      if (dateRange) {
        where.createdAt = dateRange;
      }

      return this.prisma.creditLedger.findMany({
        where,
        include: {
          party: true,
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async getStats(
    user?: { id: string; role: Role },
    dateFilter?: DateRangeFilter,
  ) {
    const cacheKey = `payments:stats:${user?.role || 'ALL'}:${user?.id || 'ALL'}:${dateFilter?.preset || ''}:${dateFilter?.from || ''}:${dateFilter?.to || ''}`;
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const isSalesman = user?.role === Role.SALESMAN;
      const invoiceFilter = isSalesman ? { salesmanId: user.id } : {};
      const paymentInvoiceFilter = isSalesman
        ? { invoice: { salesmanId: user.id } }
        : {};
      const creditInvoiceFilter = isSalesman
        ? { invoice: { salesmanId: user.id } }
        : {};

      const dateRange = buildDateRange(dateFilter);
      const invoiceDateFilter = dateRange ? { createdAt: dateRange } : {};
      const paymentDateFilter = dateRange ? { createdAt: dateRange } : {};
      const creditDateFilter = dateRange ? { createdAt: dateRange } : {};

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
            ...invoiceDateFilter,
            status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
          },
          _sum: { total: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            ...paymentInvoiceFilter,
            ...paymentDateFilter,
            status: PaymentStatus.CONFIRMED,
            type: PaymentType.INFLOW,
          },
          _sum: { amount: true },
        }),
        isSalesman
          ? Promise.resolve({ _sum: { amount: null } })
          : this.prisma.payment.aggregate({
              where: {
                ...paymentDateFilter,
                status: PaymentStatus.CONFIRMED,
                type: PaymentType.OUTFLOW,
              },
              _sum: { amount: true },
            }),
        this.prisma.payment.aggregate({
          where: {
            ...paymentInvoiceFilter,
            ...paymentDateFilter,
            status: PaymentStatus.CONFIRMED,
            mode: PaymentMode.CASH,
            type: PaymentType.INFLOW,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            ...paymentInvoiceFilter,
            ...paymentDateFilter,
            status: PaymentStatus.CONFIRMED,
            mode: PaymentMode.UPI,
            type: PaymentType.INFLOW,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            ...paymentInvoiceFilter,
            ...paymentDateFilter,
            status: PaymentStatus.CONFIRMED,
            mode: PaymentMode.BANK_TRANSFER,
            type: PaymentType.INFLOW,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            ...paymentInvoiceFilter,
            ...paymentDateFilter,
            status: PaymentStatus.CONFIRMED,
            mode: PaymentMode.CARD,
            type: PaymentType.INFLOW,
          },
          _sum: { amount: true },
        }),
        this.prisma.creditLedger.aggregate({
          where: {
            ...creditInvoiceFilter,
            ...creditDateFilter,
            status: { not: 'SETTLED' },
            type: CreditType.RECEIVABLE,
          },
          _sum: { amountDue: true },
        }),
        isSalesman
          ? Promise.resolve({ _sum: { amountDue: null } })
          : this.prisma.creditLedger.aggregate({
              where: {
                ...creditDateFilter,
                status: { not: 'SETTLED' },
                type: CreditType.PAYABLE,
              },
              _sum: { amountDue: true },
            }),
      ]);

      const totalCollected = Math.max(
        0,
        Number(inflowAgg._sum.amount || 0) -
          Number(outflowAgg._sum.amount || 0),
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
    });
  }

  async getPendingItems(
    user?: { id: string; role: Role },
    dateFilter?: DateRangeFilter,
  ) {
    const cacheKey = `payments:pending:${user?.role || 'ALL'}:${user?.id || 'ALL'}:${dateFilter?.preset || ''}:${dateFilter?.from || ''}:${dateFilter?.to || ''}`;
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const isSalesman = user?.role === Role.SALESMAN;
      const dateRange = buildDateRange(dateFilter);
      const invoiceDateFilter = dateRange ? { createdAt: dateRange } : {};
      const ledgerDateFilter = dateRange ? { createdAt: dateRange } : {};

      // 1. Invoices that are not CANCELLED or DRAFT
      const pendingInvoices = await this.prisma.invoice.findMany({
        where: {
          ...(isSalesman ? { salesmanId: user.id } : {}),
          ...invoiceDateFilter,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
        },
        include: {
          party: true,
          payments: { where: { status: PaymentStatus.CONFIRMED } },
          creditLedgers: {
            where: { type: CreditType.RECEIVABLE },
            select: { amountDue: true, status: true },
          },
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
              ...ledgerDateFilter,
            }
          : {
              status: { not: 'SETTLED' },
              ...ledgerDateFilter,
              OR: [{ type: CreditType.PAYABLE }, { invoiceId: null }],
            },
        include: {
          party: true,
          invoice: true,
          purchase: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        invoices: pendingInvoices
          .filter((inv) => inv.status !== InvoiceStatus.PAID)
          .map((inv) => {
            const paid = inv.payments.reduce(
              (sum, p) =>
                p.type === PaymentType.OUTFLOW
                  ? sum - Number(p.amount)
                  : sum + Number(p.amount),
              0,
            );
            const receivableLedger = inv.creditLedgers[0];
            const remainingDue = receivableLedger
              ? Number(receivableLedger.amountDue || 0)
              : Math.max(0, Number(inv.total) - paid);

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
            invoiceNo:
              cl.invoice?.invoiceNo ||
              cl.purchase?.vendorBillNo ||
              cl.purchase?.purchaseNo,
            purchaseId: cl.purchaseId,
            purchaseNo: cl.purchase?.purchaseNo,
            vendorBillNo: cl.purchase?.vendorBillNo,
            amountDue: Number(cl.amountDue),
            type: cl.type,
            dueDate: cl.dueDate,
            status: cl.status,
            notes: cl.notes,
            createdAt: cl.createdAt,
          })),
      };
    });
  }

  async deletePayment(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { invoice: true, purchase: true, refundInvoice: true },
      });
      if (!payment) throw new NotFoundException(`Payment ${id} not found`);

      await tx.payment.delete({ where: { id } });

      // Clean up any overpayment ledger that was generated from this payment
      const shortId = id.slice(0, 8);
      await tx.creditLedger.deleteMany({
        where: {
          notes: { contains: `Payment #${shortId}` },
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

      const targetPartyId =
        payment.partyId ||
        payment.invoice?.partyId ||
        payment.purchase?.partyId;
      if (targetPartyId) {
        await this.reconcilePartyFinancials(targetPartyId, tx);
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
    this.invalidatePaymentCaches();
    return result;
  }
}
