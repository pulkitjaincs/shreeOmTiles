import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import {
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
  PaymentType,
  Prisma,
  Role,
  Party,
  Product,
  Warehouse,
  StockLedger,
  DeliveryStatus,
  CreditType,
  CreditStatus,
} from '@prisma/client';
import {
  ProcessReturnDto,
  ProcessStandaloneReturnDto,
} from './dto/process-return.dto';
import { PaginationParams, DateRangeFilter, buildDateRange } from '../common/interfaces/pagination.interface';
import { generateUpiIntentQr } from '../common/utils/upi.util';
import { GeneratedPdfResult, TaxBreakupData } from './pdf/pdf-utils';
import { generateInvoicePdf } from './pdf/invoice-pdf.generator';
import { generateRefundInvoicePdf } from './pdf/refund-pdf.generator';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../common/cache.service';

interface ExtendedInvoice {
  id: string;
  invoiceNo: string;
  partyId: string;
  salesmanId: string;
  status: InvoiceStatus;
  taxBreakup: Prisma.JsonValue;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  transportCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  transportGstRate: Prisma.Decimal;
  transportTax: Prisma.Decimal;
  itemsTax: Prisma.Decimal;
  total: Prisma.Decimal;
  roundOffEnabled: boolean;
  roundOffAmount: Prisma.Decimal;
  paymentMode: PaymentMode | null;
  notes: string | null;
  address?: string | null;
  previousBalance?: Prisma.Decimal;
  isCashSale?: boolean;
  quotationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  party?: Party;
}

type ExtendedRefundInvoiceItemInput =
  Prisma.RefundInvoiceItemUncheckedCreateWithoutRefundInvoiceInput & {
    customItemName?: string | null;
  };

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateInvoiceCaches(): void {
    this.cacheService.invalidatePrefix('invoices:');
    this.cacheService.invalidatePrefix('analytics:');
    this.cacheService.invalidatePrefix('parties:');
    this.cacheService.invalidatePrefix('products:');
    this.cacheService.invalidatePrefix('stock:');
  }

  /**
   * Calculates the Indian Financial Year string (e.g. "2425" or "2526" or "2627")
   */
  private getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed (0 is January, 3 is April)
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const sStr = String(startYear).slice(-2);
    const eStr = String(endYear).slice(-2);
    return `${sStr}${eStr}`;
  }

  async create(data: CreateInvoiceDto, salesmanId: string) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException(
        'An invoice must contain at least one line item',
      );
    }
    if (!data.partyId && !data.newParty) {
      throw new BadRequestException(
        'Selected customer/party does not exist and new party details were not provided',
      );
    }

    const companyState = process.env.COMPANY_STATE_CODE || '07';
    const taxRate = data.taxRate !== undefined ? Math.max(0, data.taxRate) : 18;
    const transportCost = Math.max(0, data.transportCost || 0);
    const transportGstRate = Math.max(0, data.transportGstRate || 0);
    const roundOffEnabled = Boolean(data.roundOffEnabled);

    // Calculate one bill-level discount before GST and transport.
    let itemsSubtotal = 0;
    const calculatedItems = data.items.map((item) => {
      const lineTotal = item.qty * item.unitPrice;
      itemsSubtotal += lineTotal;
      return {
        ...item,
        discount: 0,
        total: lineTotal,
      };
    });

    const discountAmount = Math.min(
      itemsSubtotal,
      Math.max(0, Number(data.discountAmount || 0)),
    );
    const subtotal = Math.round((itemsSubtotal - discountAmount) * 100) / 100;
    const itemsTax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const transportTax =
      Math.round(((transportCost * transportGstRate) / 100) * 100) / 100;
    const taxAmount = Math.round((itemsTax + transportTax) * 100) / 100;
    const calculatedTotal =
      Math.round((subtotal + itemsTax + transportCost + transportTax) * 100) /
      100;
    const roundOffAmount = roundOffEnabled
      ? Math.round(calculatedTotal) - calculatedTotal
      : 0;
    const totalAmount =
      Math.round((calculatedTotal + roundOffAmount) * 100) / 100;

    const fy = this.getFinancialYear();
    let resolvedPartyName = 'Customer';

    const invoice = await this.prisma.$transaction(async (tx) => {
      // 1. Transactional Party Resolution / Creation (prevents orphaned records on failure)
      let party: Party | null = null;
      if (data.partyId) {
        party = await tx.party.findUnique({
          where: { id: data.partyId },
        });
      } else if (data.newParty) {
        const partyName =
          data.newParty.name?.trim() ||
          (data.isCashSale ? 'Cash Sale' : 'Walk-in Customer');
        const partyPhone = data.newParty.phone?.trim() || '';
        party = await tx.party.create({
          data: {
            name: partyName,
            phone: partyPhone,
            address: data.newParty.address || null,
            gstin: data.newParty.gstin || null,
            isSaved: data.newParty.isSaved ?? (data.isCashSale ? false : true),
          },
        });
      }

      if (!party) {
        throw new NotFoundException(
          'Selected customer/party does not exist and new party details were not provided',
        );
      }

      resolvedPartyName = party.name;

      let previousBalance = Number(data.previousBalance || 0);
      if (party) {
        const priorLedgers = await tx.creditLedger.findMany({
          where: {
            partyId: party.id,
            status: { not: CreditStatus.SETTLED },
          },
        });
        previousBalance = priorLedgers.reduce(
          (sum, cl) =>
            cl.type === CreditType.RECEIVABLE
              ? sum + Number(cl.amountDue || 0)
              : sum - Number(cl.amountDue || 0),
          0,
        );
      }

      // GST Breakup based on validated party state
      const trimmedGstin = party.gstin ? party.gstin.trim() : '';
      const isInterState =
        trimmedGstin.length >= 2
          ? trimmedGstin.slice(0, 2) !== companyState
          : false;

      const taxBreakup = {
        rate: taxRate,
        isInterState,
        totalTax: taxAmount,
        cgst: isInterState ? 0 : taxAmount / 2,
        sgst: isInterState ? 0 : taxAmount / 2,
        igst: isInterState ? taxAmount : 0,
        items: {
          rate: taxRate,
          taxable: subtotal,
          cgst: isInterState ? 0 : itemsTax / 2,
          sgst: isInterState ? 0 : itemsTax / 2,
          igst: isInterState ? itemsTax : 0,
          totalTax: itemsTax,
        },
        transport: {
          rate: transportGstRate,
          taxable: transportCost,
          cgst: isInterState ? 0 : transportTax / 2,
          sgst: isInterState ? 0 : transportTax / 2,
          igst: isInterState ? transportTax : 0,
          totalTax: transportTax,
        },
      };

      // 2. Validate & Decrement Stock for all line items
      const allocatedInvoiceItems: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[] =
        [];
      const pendingAuditLogs: Array<{
        action: string;
        entity: string;
        entityId: string;
        diff: Record<string, any>;
        actorId: string;
      }> = [];
      for (const item of calculatedItems) {
        let remainingQty = item.qty;

        // Unified aggregate stock allocation: query all available stock across inventory
        const stockLedgers: Array<
          StockLedger & { product: Product; warehouse: Warehouse | null }
        > = await tx.stockLedger.findMany({
          where: {
            productId: item.productId,
            quantity: { gt: 0 },
          },
          orderBy: { quantity: 'desc' },
          include: { product: true, warehouse: true },
        });

        for (const stock of stockLedgers) {
          if (remainingQty <= 0) break;

          // Row-level lock to ensure serializable stock decrement under concurrent invoice creation
          const lockedRows = await tx.$queryRawUnsafe<
            Array<{ id: string; quantity: string | number }>
          >(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            stock.id,
          );
          const lockedQty = Number(lockedRows[0]?.quantity ?? stock.quantity);
          if (lockedQty <= 0) continue;

          const qtyToTake = Math.min(lockedQty, remainingQty);
          if (qtyToTake <= 0) continue;

          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                decrement: new Prisma.Decimal(qtyToTake.toFixed(2)),
              },
            },
          });

          pendingAuditLogs.push({
            action: 'ADJUST_STOCK',
            entity: 'StockLedger',
            entityId: stock.id,
            diff: {
              reason: 'Invoice Sales',
              previousQuantity: lockedQty,
              newQuantity: lockedQty - qtyToTake,
              change: -qtyToTake,
            },
            actorId: salesmanId,
          });

          remainingQty -= qtyToTake;
        }

        if (remainingQty > 0) {
          // Find any existing stock ledger for this product (even if 0 or negative)
          let fallbackStock = await tx.stockLedger.findFirst({
            where: { productId: item.productId },
            orderBy: { updatedAt: 'desc' },
          });

          if (!fallbackStock) {
            fallbackStock = await tx.stockLedger.create({
              data: {
                productId: item.productId,
                warehouseId: null,
                batchNo: null,
                quantity: new Prisma.Decimal(0),
              },
            });
          }

          // Row lock fallback
          const lockedFallbackRows = await tx.$queryRawUnsafe<
            Array<{ id: string; quantity: string | number }>
          >(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            fallbackStock.id,
          );
          const currentQty = Number(
            lockedFallbackRows[0]?.quantity ?? fallbackStock.quantity,
          );

          await tx.stockLedger.update({
            where: { id: fallbackStock.id },
            data: {
              quantity: {
                decrement: new Prisma.Decimal(remainingQty.toFixed(2)),
              },
            },
          });

          pendingAuditLogs.push({
            action: 'ADJUST_STOCK',
            entity: 'StockLedger',
            entityId: fallbackStock.id,
            diff: {
              reason: 'Invoice Sales (Negative Stock Overdraft)',
              previousQuantity: currentQty,
              newQuantity: currentQty - remainingQty,
              change: -remainingQty,
            },
            actorId: salesmanId,
          });

          remainingQty = 0;
        }

        // Single unified commercial line item on the invoice
        allocatedInvoiceItems.push({
          productId: item.productId,
          warehouseId: null,
          batchNo: null,
          qty: new Prisma.Decimal(item.qty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          discount: new Prisma.Decimal((item.discount || 0).toFixed(2)),
          total: new Prisma.Decimal(item.total.toFixed(2)),
        });
      }

      // 3. Calculate upfront payment and credit balance
      // Support both multi-payment splits array and legacy single payment fields
      let paymentSplits: Array<{
        mode: PaymentMode;
        amount: number;
        upiTxnRef?: string;
        upiUtr?: string;
        notes?: string;
      }> = [];

      if (data.payments && data.payments.length > 0) {
        paymentSplits = data.payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            mode: p.mode,
            amount: Number(p.amount),
            upiTxnRef: p.upiTxnRef,
            upiUtr: p.upiUtr,
            notes: p.notes,
          }));
      } else if (
        data.amountPaidNow !== undefined &&
        data.amountPaidNow !== null &&
        Number(data.amountPaidNow) > 0 &&
        data.paymentMode !== PaymentMode.CREDIT
      ) {
        const actualMode = data.paymentMode || PaymentMode.CASH;
        paymentSplits = [
          {
            mode: actualMode,
            amount: Number(data.amountPaidNow),
          },
        ];
      } else if (
        data.paymentMode === PaymentMode.CASH ||
        data.paymentMode === PaymentMode.UPI ||
        (data.paymentMode as string) === 'CARD' ||
        data.paymentMode === PaymentMode.BANK_TRANSFER
      ) {
        paymentSplits = [
          {
            mode: data.paymentMode as PaymentMode,
            amount: totalAmount,
          },
        ];
      }

      const rawUpfrontAmount = paymentSplits.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      // Cap upfront payment to totalAmount
      let upfrontAmount = Math.max(0, Math.min(rawUpfrontAmount, totalAmount));
      upfrontAmount = Math.round(upfrontAmount * 100) / 100;

      const balanceCredit = Math.max(
        0,
        Math.round((totalAmount - upfrontAmount) * 100) / 100,
      );

      let effectiveInvoicePaymentMode: PaymentMode;
      if (paymentSplits.length === 0) {
        effectiveInvoicePaymentMode = PaymentMode.CREDIT;
      } else if (paymentSplits.length === 1) {
        effectiveInvoicePaymentMode = paymentSplits[0].mode;
      } else {
        effectiveInvoicePaymentMode = PaymentMode.SPLIT;
      }

      let initialStatus: InvoiceStatus;
      if (balanceCredit === 0 && upfrontAmount > 0) {
        initialStatus = InvoiceStatus.PAID;
      } else if (upfrontAmount > 0) {
        initialStatus = InvoiceStatus.PARTIAL;
      } else {
        initialStatus = InvoiceStatus.CREATED;
      }

      // 3. Gapless Invoice Sequence per Financial Year (Deferred right before create to minimize lock holding time)
      const seq = await tx.invoiceSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const invoiceNo = `INV-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      if (pendingAuditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: pendingAuditLogs.map((log) => ({
            ...log,
            diff: { ...log.diff, invoiceNo },
          })),
        });
      }

      const createData = {
        invoiceNo,
        partyId: party.id,
        salesmanId,
        paymentMode: effectiveInvoicePaymentMode,
        status: initialStatus,
        notes: data.notes,
        address: data.address || party.address || null,
        previousBalance: new Prisma.Decimal(previousBalance.toFixed(2)),
        isCashSale: Boolean(data.isCashSale),
        quotationId: data.quotationId || null,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        tax: new Prisma.Decimal(taxAmount.toFixed(2)),
        taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
        transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
        transportGstRate: new Prisma.Decimal(transportGstRate.toFixed(2)),
        transportTax: new Prisma.Decimal(transportTax.toFixed(2)),
        itemsTax: new Prisma.Decimal(itemsTax.toFixed(2)),
        total: new Prisma.Decimal(totalAmount.toFixed(2)),
        roundOffEnabled,
        roundOffAmount: new Prisma.Decimal(roundOffAmount.toFixed(2)),
        taxBreakup: taxBreakup,
        items: {
          create: allocatedInvoiceItems,
        },
      };

      const invoice = await tx.invoice.create({
        data: createData as unknown as Prisma.InvoiceCreateInput,
        include: {
          items: { include: { product: true, warehouse: true } },
          party: true,
          salesman: {
            select: { id: true, name: true, phone: true, role: true },
          },
        },
      });

      if (data.quotationId) {
        await tx.quotation.update({
          where: { id: data.quotationId },
          data: { status: 'CONVERTED' },
        });
      }

      // 4. If any amount was paid upfront (Cash, UPI, Bank Transfer, etc.), record confirmed payments immediately
      for (const split of paymentSplits) {
        if (split.amount <= 0) continue;
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            partyId: party.id,
            mode: split.mode,
            amount: new Prisma.Decimal(split.amount.toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            paidAt: new Date(),
            confirmedById: salesmanId,
            upiTxnRef: split.upiTxnRef,
            upiUtr: split.upiUtr,
            notes:
              split.notes ||
              `Upfront ${split.mode} payment of ₹${split.amount.toFixed(2)} for ${invoiceNo}`,
          },
        });
      }

      // 5. If customer has active store credit / advance overpayment (PAYABLE), offset it against this invoice
      let effectiveBalanceCredit = balanceCredit;
      if (effectiveBalanceCredit > 0) {
        const payableLedgers = await tx.creditLedger.findMany({
          where: {
            partyId: party.id,
            type: CreditType.PAYABLE,
            status: { not: CreditStatus.SETTLED },
            invoiceId: null,
            purchaseId: null,
            refundInvoiceId: null,
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const pl of payableLedgers) {
          if (effectiveBalanceCredit <= 0.001) break;
          const plAmt = Number(pl.amountDue || 0);
          if (plAmt <= 0.001) continue;
          const plDeduct = Math.min(plAmt, effectiveBalanceCredit);
          const plRem = Math.max(0, plAmt - plDeduct);
          effectiveBalanceCredit = Math.max(
            0,
            Math.round((effectiveBalanceCredit - plDeduct) * 100) / 100,
          );

          await tx.creditLedger.update({
            where: { id: pl.id },
            data: {
              amountDue: new Prisma.Decimal(plRem.toFixed(2)),
              status:
                plRem <= 0.005 ? CreditStatus.SETTLED : CreditStatus.PARTIAL,
            },
          });

          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              partyId: party.id,
              mode: PaymentMode.CREDIT,
              amount: new Prisma.Decimal(plDeduct.toFixed(2)),
              status: PaymentStatus.CONFIRMED,
              paidAt: new Date(),
              confirmedById: salesmanId,
              notes: `Offset against customer Store Credit (₹${plDeduct.toFixed(2)})`,
            },
          });
        }

        if (effectiveBalanceCredit <= 0.005) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.PAID },
          });
        }
      }

      // 6. If remaining balance is greater than 0, record in Credit Ledger
      if (effectiveBalanceCredit > 0.005) {
        await tx.creditLedger.create({
          data: {
            partyId: party.id,
            invoiceId: invoice.id,
            amountDue: new Prisma.Decimal(effectiveBalanceCredit.toFixed(2)),
            type: CreditType.RECEIVABLE,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days credit
            notes: `Balance receivable for Invoice #${invoiceNo}`,
          },
        });
      }

      // 7. Automatically dispatch to Delivery section in PENDING status
      // Cash Sales are customer pickup at counter by default - do NOT push to deliveries!
      if (!data.isCashSale) {
        await tx.delivery.create({
          data: {
            invoiceId: invoice.id,
            status: DeliveryStatus.PENDING,
            amountToCollect: new Prisma.Decimal(effectiveBalanceCredit.toFixed(2)),
            notes: data.notes || null,
          },
        });
      }

      return invoice;
    });

    // Notify Owner & Admin about new sale
    const partyName = resolvedPartyName;
    void this.notifications.notifyAdmins(
      'New Sale Generated!',
      `₹${Math.round(totalAmount).toLocaleString('en-IN')} invoiced for ${partyName}.`,
      { type: 'NEW_INVOICE', invoiceId: invoice.id },
    );

    this.invalidateInvoiceCaches();
    return invoice;
  }

  async findAll(
    user: { id: string; role: Role },
    pagination?: PaginationParams & { createdById?: string; dateFilter?: DateRangeFilter; search?: string },
  ): Promise<any> {
    const cacheKey = `invoices:${user.role}:${user.id}:${pagination?.createdById || ''}:${pagination?.dateFilter?.preset || ''}:${pagination?.dateFilter?.from || ''}:${pagination?.dateFilter?.to || ''}:${pagination?.search || ''}`;
    // Invoices list cache: 30 minutes (1800 seconds)
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const where: Prisma.InvoiceWhereInput = {};
      // Salesmen only view their own sales unless Admin/Owner
      if (user.role === Role.SALESMAN) {
        where.salesmanId = user.id;
      } else if (
        pagination?.createdById &&
        (user.role === Role.OWNER || user.role === Role.ADMIN)
      ) {
        where.salesmanId = pagination.createdById;
      }

      const dateRange = buildDateRange(pagination?.dateFilter);
      if (dateRange) {
        where.createdAt = dateRange;
      }
      if (pagination?.search) {
        where.OR = [
          { invoiceNo: { contains: pagination.search, mode: 'insensitive' } },
          { party: { name: { contains: pagination.search, mode: 'insensitive' } } },
          { party: { phone: { contains: pagination.search.replace(/\D/g, ''), mode: 'insensitive' } } },
        ] as any;
      }

      const includeRelations = {
        party: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            gstin: true,
          },
        },
        salesman: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
          },
        },
        items: {
          select: {
            id: true,
            qty: true,
          },
        },
        refundInvoices: {
          select: {
            id: true,
            refundNo: true,
            total: true,
            refundMode: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
        },
        payments: {
          select: {
            id: true,
            mode: true,
            amount: true,
            status: true,
            paidAt: true,
            upiUtr: true,
          },
        },
      };

      if (pagination?.page !== undefined || pagination?.limit !== undefined) {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(Math.max(1, pagination?.limit || 40), 500);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
          this.prisma.invoice.findMany({
            where,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.invoice.count({ where }),
        ]);

        const sanitizedData =
          user.role === Role.SUPERVISOR
            ? data.map((inv) => this.sanitizeInvoiceForSupervisor(inv))
            : data;

        return {
          data: sanitizedData,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      const invoices = await this.prisma.invoice.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
        ...(dateRange || pagination?.search ? {} : { take: 2000 }),
      });

      return user.role === Role.SUPERVISOR
        ? invoices.map((inv) => this.sanitizeInvoiceForSupervisor(inv))
        : invoices;
    });
  }

  private sanitizeInvoiceForSupervisor<T extends Record<string, unknown>>(
    inv: T,
  ): T {
    const refundInvoices = Array.isArray(inv.refundInvoices)
      ? (inv.refundInvoices as Array<Record<string, unknown>>).map((rf) => ({
          ...rf,
          total: new Prisma.Decimal(0),
        }))
      : [];

    const items = Array.isArray(inv.items)
      ? (inv.items as Array<Record<string, unknown>>).map((it) => ({
          ...it,
          unitPrice: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        }))
      : [];

    return {
      ...inv,
      subtotal: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      taxRate: new Prisma.Decimal(0),
      transportCost: new Prisma.Decimal(0),
      transportGstRate: new Prisma.Decimal(0),
      transportTax: new Prisma.Decimal(0),
      itemsTax: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
      taxBreakup: {},
      payments: [],
      creditLedgers: [],
      refundInvoices,
      items,
    };
  }

  async findOne(id: string, user?: { id: string; role: Role }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        party: true,
        salesman: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true, warehouse: true } },
        payments: true,
        deliveries: { include: { trips: true, driver: true } },
        refundInvoices: {
          include: {
            items: { include: { product: true, warehouse: true } },
            createdBy: { select: { id: true, name: true, phone: true } },
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    if (user?.role === Role.SUPERVISOR) {
      return this.sanitizeInvoiceForSupervisor(invoice);
    }

    return invoice;
  }

  private async getActiveUpiSettings() {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: 'default' },
    });
    const vpa = setting?.upiId || process.env.UPI_VPA || 'shreeom@bank';
    const merchantName = encodeURIComponent(
      setting?.merchantName ||
        process.env.UPI_MERCHANT_NAME ||
        'Shree Om Tiles',
    );
    return {
      vpa,
      merchantName,
      isConfigured: Boolean(setting?.upiId || process.env.UPI_VPA),
    };
  }

  /**
   * Generates direct UPI payment intent string and Base64 QR code image
   */
  async getUpiQr(id: string) {
    const invoice = await this.findOne(id);
    const { vpa, merchantName, isConfigured } =
      await this.getActiveUpiSettings();
    const invoiceNo = invoice.invoiceNo;

    // Standard NPCI UPI Intent URI & QR
    const qrResult = await generateUpiIntentQr({
      vpa,
      merchantName,
      amount: invoice.total.toString(),
      transactionRef: invoiceNo,
      transactionNote: `Invoice ${invoiceNo}`,
    });

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      amount: qrResult.amount,
      vpa,
      upiUri: qrResult.upiUri,
      qrDataUrl: qrResult.qrDataUrl,
      isConfigured,
    };
  }

  /**
   * Generates dynamic UPI QR for live checkout before invoice record is saved
   */
  async previewUpiQr(
    amount: number,
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
      const active = await this.getActiveUpiSettings();
      vpa = active.vpa;
      merchantName = active.merchantName;
      isConfigured = active.isConfigured;
    }

    const ref = `SHREEOM-${Date.now().toString().slice(-6)}`;
    const qrResult = await generateUpiIntentQr({
      vpa,
      merchantName,
      amount,
      transactionRef: ref,
      transactionNote: 'Shree Om Tiles Counter Bill',
    });

    return {
      amount: qrResult.amount,
      vpa,
      upiUri: qrResult.upiUri,
      qrDataUrl: qrResult.qrDataUrl,
      isConfigured,
    };
  }

  /**
   * Pre-formatted WhatsApp share message and contact info
   */
  async getShareInfo(id: string) {
    const invoice = await this.findOne(id);
    const companyName = process.env.COMPANY_NAME || 'Shree Om Tiles';
    const customerName = invoice.party.name;
    const customerPhone = invoice.party.phone || '';
    const total = Number(invoice.total).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

    // Customer caption - strictly direct message without any external links
    const customerMessage = `Hi ${customerName}, please find attached your Invoice #${invoice.invoiceNo} from ${companyName}. Total Amount: Rs. ${total}. Thank you for your business!`;
    const cleanPhone = customerPhone
      ? customerPhone.replace(/[^0-9]/g, '')
      : '';
    const customerWhatsAppUrl = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(customerMessage)}`
      : '';

    // Driver caption
    const itemsList = invoice.items
      .map(
        (i) =>
          `• ${i.product?.name || 'Item'} (${Number(i.qty)} ${i.product?.unit || 'unit'}) [WH: ${i.warehouse?.name || 'Standard'}]`,
      )
      .join('\n');
    const driverMessage = `Delivery for Invoice #${invoice.invoiceNo}\nCustomer: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}\nAddress: ${invoice.party.address || 'Counter Pickup'}\nItems:\n${itemsList}`;

    return {
      invoiceNo: invoice.invoiceNo,
      customer: {
        name: customerName,
        phone: customerPhone,
        message: customerMessage,
        whatsappUrl: customerWhatsAppUrl,
      },
      driver: {
        message: driverMessage,
      },
    };
  }

  /**
   * Look up invoice by Invoice Number or ID for Return/Counter verification
   */
  async lookupInvoice(query: string) {
    const cleanQuery = query.trim();
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [
          { invoiceNo: { equals: cleanQuery, mode: 'insensitive' } },
          { id: cleanQuery },
        ],
      },
      include: {
        party: true,
        salesman: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true, warehouse: true } },
        payments: true,
        deliveries: true,
        refundInvoices: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice matching "${query}" was not found.`);
    }

    // Calculate previously returned and remaining returnable quantities per line item
    const itemReturnStats: Record<string, number> = {};
    for (const refund of invoice.refundInvoices) {
      for (const rItem of refund.items) {
        if (rItem.productId) {
          const key = `${rItem.productId}_${rItem.batchNo || ''}`;
          itemReturnStats[key] =
            (itemReturnStats[key] || 0) + Number(rItem.qty);
        }
      }
    }

    const itemsWithReturnStats = invoice.items.map((item) => {
      const key = `${item.productId}_${item.batchNo || ''}`;
      const returnedQty = itemReturnStats[key] || 0;
      const remainingReturnable = Math.max(0, Number(item.qty) - returnedQty);
      return {
        ...item,
        returnedQty,
        remainingReturnable,
      };
    });

    return {
      ...invoice,
      items: itemsWithReturnStats,
    };
  }

  /**
   * Process customer return with formal Refund Invoice (Credit Note),
   * showroom/godown restocking and financial refund accounting
   */
  async processReturn(id: string, data: ProcessReturnDto, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('At least one item must be returned.');
    }

    const fy = this.getFinancialYear();

    // Fetch party name before transaction (read-only, safe outside tx)
    const invoiceForParty = await this.prisma.invoice.findUnique({
      where: { id },
      select: { party: { select: { name: true } } },
    });
    const customerName = invoiceForParty?.party?.name || 'Customer';

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch invoice and relations inside transaction to prevent concurrency races
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          party: true,
          items: { include: { product: true } },
          refundInvoices: { include: { items: true } },
        },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found.`);
      }

      // 2. Validate quantities against prior returns to strictly prevent over-returns
      const previouslyReturnedByProduct: Record<string, number> = {};
      for (const prevRefund of invoice.refundInvoices) {
        for (const pItem of prevRefund.items) {
          const pKey = `${pItem.productId}_${pItem.batchNo || ''}`;
          previouslyReturnedByProduct[pKey] =
            (previouslyReturnedByProduct[pKey] || 0) + Number(pItem.qty);
        }
      }

      for (const retItem of data.items) {
        if (!retItem.qty || retItem.qty <= 0) continue;
        if (!retItem.productId) {
          throw new BadRequestException(
            'Product ID is required for invoice returns.',
          );
        }
        const key = `${retItem.productId}_${retItem.batchNo || ''}`;
        const purchasedItem = invoice.items.find(
          (it) =>
            it.productId === retItem.productId &&
            (retItem.batchNo ? it.batchNo === retItem.batchNo : true),
        );
        if (!purchasedItem) {
          throw new BadRequestException(
            `Product ID "${retItem.productId}" was not part of this invoice.`,
          );
        }
        const prevReturned = previouslyReturnedByProduct[key] || 0;
        const availableToReturn = Number(purchasedItem.qty) - prevReturned;
        if (retItem.qty > availableToReturn) {
          throw new BadRequestException(
            `Cannot return ${retItem.qty} units of "${purchasedItem.product?.name || 'Item'}". Already returned: ${prevReturned}, purchased: ${Number(purchasedItem.qty)}, max returnable: ${availableToReturn}.`,
          );
        }
      }

      const companyState = process.env.COMPANY_STATE_CODE || '07';
      const isInterState =
        invoice.party?.gstin && invoice.party.gstin.length >= 2
          ? invoice.party.gstin.slice(0, 2) !== companyState
          : false;

      // Get original invoice tax rate or fallback to 18%
      const originalTaxBreakup =
        (invoice.taxBreakup as unknown as TaxBreakupData) || {};
      const taxRate =
        data.taxRate !== undefined
          ? Math.max(0, data.taxRate)
          : originalTaxBreakup.rate !== undefined
            ? originalTaxBreakup.rate
            : 18;

      let subtotal = 0;
      const returnedSummaries: string[] = [];
      const refundInvoiceItemsData: ExtendedRefundInvoiceItemInput[] = [];

      for (const item of data.items) {
        if (!item.qty || item.qty <= 0) continue;
        const lineTotal = item.qty * item.unitPrice;
        subtotal += lineTotal;

        // Upsert stock in target stock ledger with row lock
        let existingStock = await tx.stockLedger.findFirst({
          where: { productId: item.productId },
          orderBy: { updatedAt: 'desc' },
        });

        if (existingStock) {
          await tx.$queryRawUnsafe(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            existingStock.id,
          );
          await tx.stockLedger.update({
            where: { id: existingStock.id },
            data: {
              quantity: { increment: new Prisma.Decimal(item.qty.toFixed(2)) },
            },
          });
        } else {
          existingStock = await tx.stockLedger.create({
            data: {
              productId: item.productId!,
              warehouseId: null,
              batchNo: null,
              quantity: new Prisma.Decimal(item.qty.toFixed(2)),
            },
          });
        }

        const product = item.productId
          ? await tx.product.findUnique({
              where: { id: item.productId },
            })
          : null;

        returnedSummaries.push(
          `${item.qty}x ${product?.name || item.customItemName || 'Item'} returned to stock`,
        );

        refundInvoiceItemsData.push({
          productId: item.productId || null,
          customItemName: item.customItemName || null,
          warehouseId: null,
          batchNo: null,
          qty: new Prisma.Decimal(item.qty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          total: new Prisma.Decimal(lineTotal.toFixed(2)),
        });
      }

      const taxAmount = (subtotal * taxRate) / 100;
      const totalRefund = subtotal + taxAmount;

      const taxBreakup = isInterState
        ? {
            rate: taxRate,
            igst: taxAmount,
            cgst: 0,
            sgst: 0,
            isInterState: true,
          }
        : {
            rate: taxRate,
            igst: 0,
            cgst: taxAmount / 2,
            sgst: taxAmount / 2,
            isInterState: false,
          };

      // 4. Generate Gapless Sequence for Refund Invoice (Credit Note) right before creation
      const seq = await tx.refundSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const refundNo = `RF-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      // 5. Create formal RefundInvoice (Credit Note)
      const refundInvoice = await tx.refundInvoice.create({
        data: {
          refundNo,
          originalInvoiceId: invoice.id,
          partyId: invoice.partyId,
          createdById: userId,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          tax: new Prisma.Decimal(taxAmount.toFixed(2)),
          total: new Prisma.Decimal(totalRefund.toFixed(2)),
          taxBreakup,
          refundMode: data.refundMode,
          reason: data.reason || 'Customer return',
          notes: `Credit Note against Tax Invoice #${invoice.invoiceNo}`,
          items: {
            create: refundInvoiceItemsData,
          },
        },
        include: {
          items: { include: { product: true, warehouse: true } },
          party: true,
          createdBy: { select: { id: true, name: true } },
        },
      });

      // 5. Accounting Entries:
      if (
        data.refundMode === PaymentMode.CASH ||
        data.refundMode === PaymentMode.UPI ||
        (data.refundMode as string) === 'CARD' ||
        data.refundMode === PaymentMode.BANK_TRANSFER
      ) {
        await tx.payment.create({
          data: {
            refundInvoiceId: refundInvoice.id,
            invoiceId: invoice.id,
            partyId: invoice.partyId,
            mode: data.refundMode,
            amount: new Prisma.Decimal(totalRefund.toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            type: PaymentType.OUTFLOW,
            notes: `Refund payout for ${refundNo} (Invoice #${invoice.invoiceNo})`,
            paidAt: new Date(),
          },
        });
      } else if (data.refundMode === PaymentMode.CREDIT) {
        // Offset customer's outstanding receivable debt first if one exists
        const existingReceivable = await tx.creditLedger.findFirst({
          where: {
            invoiceId: invoice.id,
            type: CreditType.RECEIVABLE,
            status: { not: CreditStatus.SETTLED },
          },
        });

        if (existingReceivable) {
          const currentDue = Number(existingReceivable.amountDue);
          if (currentDue >= totalRefund) {
            const newDue = currentDue - totalRefund;
            await tx.creditLedger.update({
              where: { id: existingReceivable.id },
              data: {
                amountDue: new Prisma.Decimal(newDue.toFixed(2)),
                status:
                  newDue === 0 ? CreditStatus.SETTLED : CreditStatus.PARTIAL,
              },
            });
          } else {
            // Customer debt wiped out; remainder becomes store credit payable
            const excessStoreCredit = totalRefund - currentDue;
            await tx.creditLedger.update({
              where: { id: existingReceivable.id },
              data: {
                amountDue: new Prisma.Decimal(0),
                status: CreditStatus.SETTLED,
              },
            });
            await tx.creditLedger.create({
              data: {
                partyId: invoice.partyId,
                refundInvoiceId: refundInvoice.id,
                invoiceId: invoice.id,
                amountDue: new Prisma.Decimal(excessStoreCredit.toFixed(2)),
                type: CreditType.PAYABLE,
                status: CreditStatus.UNPAID,
                notes: `Excess store credit issued via ${refundNo} for Invoice #${invoice.invoiceNo}`,
              },
            });
          }
        } else {
          // No outstanding invoice debt, create store credit payable
          await tx.creditLedger.create({
            data: {
              partyId: invoice.partyId,
              refundInvoiceId: refundInvoice.id,
              invoiceId: invoice.id,
              amountDue: new Prisma.Decimal(totalRefund.toFixed(2)),
              type: CreditType.PAYABLE,
              status: CreditStatus.UNPAID,
              notes: `Store Credit issued via ${refundNo} for Invoice #${invoice.invoiceNo}`,
            },
          });
        }
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'SALES_RETURN',
          entity: 'RefundInvoice',
          entityId: refundInvoice.id,
          diff: {
            refundNo,
            originalInvoiceNo: invoice.invoiceNo,
            refundTotal: totalRefund,
            subtotal,
            tax: taxAmount,
            refundMode: data.refundMode,
            reason: data.reason || 'Customer return',
            restocked: returnedSummaries,
          },
        },
      });

      // 7. Update original invoice notes & status for audit tracking
      const returnNote = `[REFUND INVOICE ${refundNo} (${new Date().toISOString().slice(0, 10)}): Refunded Rs. ${totalRefund.toFixed(2)} (${data.refundMode}). Reason: ${data.reason || 'Customer return'}]`;
      const prevRefundTotal = (invoice.refundInvoices || []).reduce(
        (s, r) => s + Number(r.total || 0),
        0,
      );
      const totalRefundedSoFar = prevRefundTotal + totalRefund;
      const invoiceTotal = Number(invoice.total);
      const newStatus =
        totalRefundedSoFar >= invoiceTotal - 0.01
          ? InvoiceStatus.CANCELLED
          : InvoiceStatus.PARTIAL;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          notes: invoice.notes ? `${invoice.notes}\n${returnNote}` : returnNote,
          status: newStatus,
        },
      });

      return {
        success: true,
        refundInvoice,
        refundNo,
        invoiceNo: invoice.invoiceNo,
        totalRefund,
        subtotal,
        tax: taxAmount,
        refundMode: data.refundMode,
        restockedItems: returnedSummaries,
      };
    });

    // Notify Owner & Admin about credit note / sales return
    const formattedRefund = Math.round(result.totalRefund).toLocaleString(
      'en-IN',
    );
    void this.notifications.notifyAdmins(
      'Credit Note Issued',
      `₹${formattedRefund} refunded/credited for Invoice #${result.invoiceNo} (${customerName}).`,
      {
        type: 'CREDIT_NOTE_ISSUED',
        invoiceId: id,
        refundInvoiceId: result.refundInvoice.id,
      },
    );

    this.invalidateInvoiceCaches();
    return result;
  }

  /**
   * Process standalone / legacy return (without linked modern invoice record).
   * Supports catalog items (restocked to warehouse) and custom uncataloged items.
   * Standalone returns NEVER push to delivery by design.
   */
  async processStandaloneReturn(
    data: ProcessStandaloneReturnDto,
    userId: string,
  ) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('At least one item must be returned.');
    }

    const fy = this.getFinancialYear();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Resolve or create party if specified
      let resolvedPartyId: string | null = data.partyId || null;
      let partyName = 'Walk-in Customer';

      if (resolvedPartyId) {
        const existingParty = await tx.party.findUnique({
          where: { id: resolvedPartyId },
          select: { name: true },
        });
        if (existingParty) partyName = existingParty.name;
      } else if (data.newParty?.name) {
        const createdParty = await tx.party.create({
          data: {
            name: data.newParty.name,
            phone: data.newParty.phone || '',
            address: data.newParty.address || null,
            gstin: data.newParty.gstin || null,
            category: 'RETAIL',
          },
        });
        resolvedPartyId = createdParty.id;
        partyName = createdParty.name;
      } else if (data.customerName?.trim() || data.customerPhone?.trim()) {
        const cPhone = data.customerPhone?.trim() || '';
        const cName = data.customerName?.trim() || 'Walk-in Customer';
        let existingParty: { id: string; name: string } | null = null;
        if (cPhone) {
          existingParty = await tx.party.findFirst({
            where: { phone: cPhone },
          });
        }
        if (!existingParty && cName && cName !== 'Walk-in Customer') {
          existingParty = await tx.party.findFirst({
            where: { name: { equals: cName, mode: 'insensitive' } },
          });
        }
        if (existingParty) {
          resolvedPartyId = existingParty.id;
          partyName = existingParty.name;
        } else {
          const createdParty = await tx.party.create({
            data: {
              name: cName,
              phone: cPhone,
              category: 'RETAIL',
            },
          });
          resolvedPartyId = createdParty.id;
          partyName = createdParty.name;
        }
      }

      if (!resolvedPartyId) {
        let walkInParty = await tx.party.findFirst({
          where: { name: 'Walk-in Customer' },
        });
        if (!walkInParty) {
          walkInParty = await tx.party.create({
            data: {
              name: 'Walk-in Customer',
              phone: '0000000000',
              category: 'RETAIL',
            },
          });
        }
        resolvedPartyId = walkInParty.id;
      }

      let subtotal = 0;
      let totalTax = 0;
      const returnedSummaries: string[] = [];
      const refundInvoiceItemsData: ExtendedRefundInvoiceItemInput[] = [];

      for (const item of data.items) {
        if (!item.qty || item.qty <= 0) continue;
        const lineTotal = item.qty * item.unitPrice;
        subtotal += lineTotal;
        const lineTaxRate = item.taxRate !== undefined ? item.taxRate : 18;
        const lineTax = (lineTotal * lineTaxRate) / 100;
        totalTax += lineTax;

        if (item.productId) {
          // Increment stock ledger if catalog product exists
          const existingStock = await tx.stockLedger.findFirst({
            where: { productId: item.productId },
            orderBy: { updatedAt: 'desc' },
          });

          if (existingStock) {
            await tx.$queryRawUnsafe(
              `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
              existingStock.id,
            );
            await tx.stockLedger.update({
              where: { id: existingStock.id },
              data: {
                quantity: {
                  increment: new Prisma.Decimal(item.qty.toFixed(2)),
                },
              },
            });
          } else {
            await tx.stockLedger.create({
              data: {
                productId: item.productId,
                warehouseId: null,
                batchNo: null,
                quantity: new Prisma.Decimal(item.qty.toFixed(2)),
              },
            });
          }
        }

        const product = item.productId
          ? await tx.product.findUnique({
              where: { id: item.productId },
            })
          : null;

        const itemName = product?.name || item.customItemName || 'Item';
        returnedSummaries.push(`${item.qty}x ${itemName} returned`);

        refundInvoiceItemsData.push({
          productId: item.productId || null,
          customItemName: item.customItemName || null,
          warehouseId: null,
          batchNo: item.batchNo || null,
          qty: new Prisma.Decimal(item.qty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          taxRate: new Prisma.Decimal(lineTaxRate.toFixed(2)),
          total: new Prisma.Decimal((lineTotal + lineTax).toFixed(2)),
        });
      }

      const totalRefund = subtotal + totalTax;

      // 2. Generate Gapless Sequence
      const seq = await tx.refundSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const refundNo = `RF-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      // Notes
      const notes =
        data.notes ||
        (data.originalInvoiceNumber
          ? `Standalone return against legacy Bill #${data.originalInvoiceNumber}`
          : 'Standalone customer sales return');

      // 3. Create RefundInvoice
      const refundInvoiceData = {
        refundNo,
        originalInvoiceId: null,
        partyId: resolvedPartyId,
        createdById: userId,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        tax: new Prisma.Decimal(totalTax.toFixed(2)),
        total: new Prisma.Decimal(totalRefund.toFixed(2)),
        taxBreakup: {
          rate: 18,
          cgst: totalTax / 2,
          sgst: totalTax / 2,
          igst: 0,
          isInterState: false,
        },
        refundMode: data.refundMode,
        reason: data.reason || 'Standalone return',
        notes,
        items: {
          create: refundInvoiceItemsData,
        },
      };

      const refundInvoice = await tx.refundInvoice.create({
        data: refundInvoiceData as unknown as Prisma.RefundInvoiceCreateInput,
        include: {
          items: { include: { product: true } },
          party: true,
          createdBy: { select: { id: true, name: true } },
        },
      });

      // 4. Financial payout or store credit
      if (
        data.refundMode === PaymentMode.CASH ||
        data.refundMode === PaymentMode.UPI ||
        (data.refundMode as string) === 'CARD' ||
        data.refundMode === PaymentMode.BANK_TRANSFER
      ) {
        await tx.payment.create({
          data: {
            refundInvoiceId: refundInvoice.id,
            invoiceId: null,
            partyId: resolvedPartyId || null,
            mode: data.refundMode,
            amount: new Prisma.Decimal(totalRefund.toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            type: PaymentType.OUTFLOW,
            notes: `Refund payout for ${refundNo}`,
            paidAt: new Date(),
          },
        });
      } else if (data.refundMode === PaymentMode.CREDIT && resolvedPartyId) {
        await tx.creditLedger.create({
          data: {
            partyId: resolvedPartyId,
            refundInvoiceId: refundInvoice.id,
            invoiceId: null,
            amountDue: new Prisma.Decimal(totalRefund.toFixed(2)),
            type: CreditType.PAYABLE,
            status: CreditStatus.UNPAID,
            notes: `Store Credit issued via ${refundNo}`,
          },
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'STANDALONE_RETURN',
          entity: 'RefundInvoice',
          entityId: refundInvoice.id,
          diff: {
            refundNo,
            refundTotal: totalRefund,
            subtotal,
            tax: totalTax,
            refundMode: data.refundMode,
            originalInvoiceNumber: data.originalInvoiceNumber,
            reason: data.reason || 'Standalone return',
            restocked: returnedSummaries,
          },
        },
      });

      return {
        success: true,
        refundInvoice,
        refundNo,
        partyName,
        totalRefund,
        subtotal,
        tax: totalTax,
        refundMode: data.refundMode,
        restockedItems: returnedSummaries,
      };
    });

    const formattedRefund = Math.round(result.totalRefund).toLocaleString(
      'en-IN',
    );
    void this.notifications.notifyAdmins(
      'Standalone Return Processed',
      `₹${formattedRefund} refunded for standalone return ${result.refundNo} (${result.partyName}).`,
      {
        type: 'CREDIT_NOTE_ISSUED',
        refundInvoiceId: result.refundInvoice.id,
      },
    );

    this.invalidateInvoiceCaches();
    return result;
  }

  /**
   * High-precision, elegant PDF invoice generation with compact spacing and return QR code
   */
  /**
   * High-precision, elegant PDF invoice generation with compact spacing and return QR code
   */
  async generatePdf(id: string): Promise<GeneratedPdfResult> {
    const invoice = await this.findOne(id);
    const prevCreditLedgers = await this.prisma.creditLedger.findMany({
      where: {
        partyId: invoice.partyId,
        status: { not: CreditStatus.SETTLED },
        createdAt: { lt: invoice.createdAt },
      },
    });
    const previousBalance = prevCreditLedgers.reduce(
      (sum, item) =>
        item.type === CreditType.RECEIVABLE
          ? sum + Number(item.amountDue || 0)
          : sum - Number(item.amountDue || 0),
      0,
    );

    return generateInvoicePdf({
      ...invoice,
      previousBalance,
    });
  }

  /**
   * Safe transactional invoice deletion restricted to OWNER and ADMIN
   */
  async deleteInvoice(
    id: string,
    actorId: string,
    forceDelivered: boolean = false,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
    });
    if (!actor || (actor.role !== Role.OWNER && actor.role !== Role.ADMIN)) {
      throw new ForbiddenException(
        'Strictly restricted: Only OWNER and ADMIN can delete invoices and restore inventory',
      );
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        refundInvoices: true,
        deliveries: true,
        payments: true,
        creditLedgers: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.refundInvoices && invoice.refundInvoices.length > 0) {
      throw new BadRequestException(
        'Cannot delete invoice with processed returns. Revert refunds first.',
      );
    }

    const hasDelivered = invoice.deliveries?.some(
      (d) => d.status === DeliveryStatus.DELIVERED,
    );
    if (hasDelivered && !forceDelivered) {
      throw new BadRequestException(
        'Order has already been delivered. Acknowledge return of physical goods to proceed.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Atomically restore inventory to StockLedger with row-level locks
      for (const item of invoice.items) {
        if (!item.productId) continue;

        let stock = await tx.stockLedger.findFirst({
          where: {
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            batchNo: item.batchNo || null,
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!stock) {
          stock = await tx.stockLedger.findFirst({
            where: { productId: item.productId },
            orderBy: { updatedAt: 'desc' },
          });
        }

        const itemQty = Number(item.qty);

        if (stock) {
          const lockedRows = await tx.$queryRawUnsafe<
            Array<{ id: string; quantity: string | number }>
          >(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            stock.id,
          );
          const previousQty = Number(lockedRows[0]?.quantity ?? stock.quantity);
          const newQty = previousQty + itemQty;
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                increment: new Prisma.Decimal(itemQty.toFixed(2)),
              },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'INVOICE_DELETE_RESTORE_STOCK',
              entity: 'StockLedger',
              entityId: stock.id,
              diff: {
                invoiceNo: invoice.invoiceNo,
                restoredQty: itemQty,
                previousQuantity: previousQty,
                newQuantity: newQty,
              },
            },
          });
        } else {
          stock = await tx.stockLedger.create({
            data: {
              productId: item.productId,
              warehouseId: item.warehouseId || null,
              batchNo: item.batchNo || null,
              quantity: new Prisma.Decimal(itemQty.toFixed(2)),
            },
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'INVOICE_DELETE_RESTORE_STOCK',
              entity: 'StockLedger',
              entityId: stock.id,
              diff: {
                invoiceNo: invoice.invoiceNo,
                restoredQty: itemQty,
                previousQuantity: 0,
                newQuantity: itemQty,
              },
            },
          });
        }
      }

      // 2. Delete Delivery Trips and Deliveries
      for (const delivery of invoice.deliveries) {
        await tx.deliveryTrip.deleteMany({
          where: { deliveryId: delivery.id },
        });
      }
      await tx.delivery.deleteMany({
        where: { invoiceId: invoice.id },
      });

      // 3. Delete Payments
      await tx.payment.deleteMany({
        where: { invoiceId: invoice.id },
      });

      // 4. Delete Credit Ledgers
      await tx.creditLedger.deleteMany({
        where: { invoiceId: invoice.id },
      });

      // 5. Delete Invoice Items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id },
      });

      // 6. Delete Invoice
      await tx.invoice.delete({
        where: { id: invoice.id },
      });

      // 7. Audit Log for invoice deletion
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DELETE_INVOICE',
          entity: 'Invoice',
          entityId: invoice.id,
          diff: {
            invoiceNo: invoice.invoiceNo,
            total: Number(invoice.total),
            subtotal: Number(invoice.subtotal),
            partyId: invoice.partyId,
            forceDelivered,
          },
        },
      });

      return {
        success: true,
        message: `Invoice #${invoice.invoiceNo} successfully deleted. Inventory restored.`,
      };
    });
    this.invalidateInvoiceCaches();
    return result;
  }

  /**
   * Transactional invoice update (Bill Editing) with inventory rollback, re-allocation,
   * payment & credit ledger sync, and delivery reconciliation.
   */
  async update(
    id: string,
    data: UpdateInvoiceDto,
    actorId: string,
    actorRole: Role,
  ) {
    if (
      actorRole !== Role.OWNER &&
      actorRole !== Role.ADMIN &&
      actorRole !== Role.SALESMAN &&
      actorRole !== Role.ACCOUNTANT
    ) {
      throw new ForbiddenException(
        'You do not have permission to edit invoices',
      );
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException(
        'An invoice must contain at least one line item',
      );
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        refundInvoices: true,
        deliveries: true,
        payments: true,
        creditLedgers: true,
        party: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (existing.refundInvoices && existing.refundInvoices.length > 0) {
      throw new BadRequestException(
        'Cannot edit invoice with processed returns. Revert refunds first.',
      );
    }

    const companyState = process.env.COMPANY_STATE_CODE || '07';
    const taxRate =
      data.taxRate !== undefined
        ? Math.max(0, data.taxRate)
        : Number(existing.taxRate || 18);
    const transportCost =
      data.transportCost !== undefined
        ? Math.max(0, data.transportCost)
        : Number(existing.transportCost || 0);
    const transportGstRate =
      data.transportGstRate !== undefined
        ? Math.max(0, data.transportGstRate)
        : Number(existing.transportGstRate || 0);
    const roundOffEnabled =
      data.roundOffEnabled !== undefined
        ? Boolean(data.roundOffEnabled)
        : Boolean(existing.roundOffEnabled);

    let itemsSubtotal = 0;
    const calculatedItems = data.items.map((item) => {
      const lineTotal = item.qty * item.unitPrice;
      itemsSubtotal += lineTotal;
      return {
        ...item,
        discount: 0,
        total: lineTotal,
      };
    });

    const discountAmount = Math.min(
      itemsSubtotal,
      Math.max(
        0,
        data.discountAmount !== undefined
          ? Number(data.discountAmount)
          : Number(existing.discountAmount || 0),
      ),
    );
    const subtotal = Math.round((itemsSubtotal - discountAmount) * 100) / 100;
    const itemsTax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const transportTax =
      Math.round(((transportCost * transportGstRate) / 100) * 100) / 100;
    const taxAmount = Math.round((itemsTax + transportTax) * 100) / 100;
    const calculatedTotal =
      Math.round((subtotal + itemsTax + transportCost + transportTax) * 100) /
      100;
    const roundOffAmount = roundOffEnabled
      ? Math.round(calculatedTotal) - calculatedTotal
      : 0;
    const totalAmount =
      Math.round((calculatedTotal + roundOffAmount) * 100) / 100;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Resolve Party
      let party: Party | null = null;
      if (data.partyId) {
        party = await tx.party.findUnique({
          where: { id: data.partyId },
        });
      } else if (data.newParty) {
        const partyName =
          data.newParty.name?.trim() ||
          (data.isCashSale ? 'Cash Sale' : 'Walk-in Customer');
        const partyPhone = data.newParty.phone?.trim() || '';
        party = await tx.party.create({
          data: {
            name: partyName,
            phone: partyPhone,
            address: data.newParty.address || null,
            gstin: data.newParty.gstin || null,
            isSaved: data.newParty.isSaved ?? (data.isCashSale ? false : true),
          },
        });
      } else {
        party = existing.party;
      }

      if (!party) {
        throw new NotFoundException('Selected customer/party does not exist');
      }

      // GST Breakup based on party GSTIN state
      const trimmedGstin = party.gstin ? party.gstin.trim() : '';
      const isInterState =
        trimmedGstin.length >= 2
          ? trimmedGstin.slice(0, 2) !== companyState
          : false;

      const taxBreakup = {
        rate: taxRate,
        isInterState,
        totalTax: taxAmount,
        cgst: isInterState ? 0 : taxAmount / 2,
        sgst: isInterState ? 0 : taxAmount / 2,
        igst: isInterState ? taxAmount : 0,
        items: {
          rate: taxRate,
          taxable: subtotal,
          cgst: isInterState ? 0 : itemsTax / 2,
          sgst: isInterState ? 0 : itemsTax / 2,
          igst: isInterState ? itemsTax : 0,
          totalTax: itemsTax,
        },
        transport: {
          rate: transportGstRate,
          taxable: transportCost,
          cgst: isInterState ? 0 : transportTax / 2,
          sgst: isInterState ? 0 : transportTax / 2,
          igst: isInterState ? transportTax : 0,
          totalTax: transportTax,
        },
      };

      // 2. Revert previous inventory stock for all existing line items
      for (const oldItem of existing.items) {
        if (!oldItem.productId) continue;
        const oldQty = Number(oldItem.qty);
        let stock = await tx.stockLedger.findFirst({
          where: {
            productId: oldItem.productId,
            warehouseId: oldItem.warehouseId || null,
            batchNo: oldItem.batchNo || null,
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!stock) {
          stock = await tx.stockLedger.findFirst({
            where: { productId: oldItem.productId },
            orderBy: { updatedAt: 'desc' },
          });
        }

        if (stock) {
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                increment: new Prisma.Decimal(oldQty.toFixed(2)),
              },
            },
          });
        } else {
          await tx.stockLedger.create({
            data: {
              productId: oldItem.productId,
              warehouseId: oldItem.warehouseId || null,
              batchNo: oldItem.batchNo || null,
              quantity: new Prisma.Decimal(oldQty.toFixed(2)),
            },
          });
        }
      }

      // 3. Validate & Decrement Stock for all updated line items
      const allocatedInvoiceItems: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[] =
        [];
      const pendingAuditLogs: Array<{
        action: string;
        entity: string;
        entityId: string;
        diff: Record<string, any>;
        actorId: string;
      }> = [];

      for (const item of calculatedItems) {
        let remainingQty = item.qty;

        const stockLedgers: Array<
          StockLedger & { product: Product; warehouse: Warehouse | null }
        > = await tx.stockLedger.findMany({
          where: {
            productId: item.productId,
            quantity: { gt: 0 },
          },
          orderBy: { quantity: 'desc' },
          include: { product: true, warehouse: true },
        });

        for (const stock of stockLedgers) {
          if (remainingQty <= 0) break;

          const lockedRows = await tx.$queryRawUnsafe<
            Array<{ id: string; quantity: string | number }>
          >(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            stock.id,
          );
          const lockedQty = Number(lockedRows[0]?.quantity ?? stock.quantity);
          if (lockedQty <= 0) continue;

          const qtyToTake = Math.min(lockedQty, remainingQty);
          if (qtyToTake <= 0) continue;

          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                decrement: new Prisma.Decimal(qtyToTake.toFixed(2)),
              },
            },
          });

          pendingAuditLogs.push({
            action: 'ADJUST_STOCK',
            entity: 'StockLedger',
            entityId: stock.id,
            diff: {
              reason: 'Invoice Sales (Edit Update)',
              previousQuantity: lockedQty,
              newQuantity: lockedQty - qtyToTake,
              change: -qtyToTake,
            },
            actorId,
          });

          remainingQty -= qtyToTake;
        }

        if (remainingQty > 0) {
          let fallbackStock = await tx.stockLedger.findFirst({
            where: { productId: item.productId },
            orderBy: { updatedAt: 'desc' },
          });

          if (!fallbackStock) {
            fallbackStock = await tx.stockLedger.create({
              data: {
                productId: item.productId,
                warehouseId: null,
                batchNo: null,
                quantity: new Prisma.Decimal(0),
              },
            });
          }

          const lockedFallbackRows = await tx.$queryRawUnsafe<
            Array<{ id: string; quantity: string | number }>
          >(
            `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
            fallbackStock.id,
          );
          const currentQty = Number(
            lockedFallbackRows[0]?.quantity ?? fallbackStock.quantity,
          );

          await tx.stockLedger.update({
            where: { id: fallbackStock.id },
            data: {
              quantity: {
                decrement: new Prisma.Decimal(remainingQty.toFixed(2)),
              },
            },
          });

          pendingAuditLogs.push({
            action: 'ADJUST_STOCK',
            entity: 'StockLedger',
            entityId: fallbackStock.id,
            diff: {
              reason: 'Invoice Sales (Edit Negative Overdraft)',
              previousQuantity: currentQty,
              newQuantity: currentQty - remainingQty,
              change: -remainingQty,
            },
            actorId,
          });

          remainingQty = 0;
        }

        allocatedInvoiceItems.push({
          productId: item.productId,
          warehouseId: null,
          batchNo: null,
          qty: new Prisma.Decimal(item.qty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          discount: new Prisma.Decimal((item.discount || 0).toFixed(2)),
          total: new Prisma.Decimal(item.total.toFixed(2)),
        });
      }

      // 4. Payment Reconciliation & Preservation
      const existingConfirmedPayments = (existing.payments || []).filter(
        (p) => p.status === PaymentStatus.CONFIRMED,
      );

      let submittedSplits: Array<{
        mode: PaymentMode;
        amount: number;
        upiTxnRef?: string;
        upiUtr?: string;
        notes?: string;
      }> = [];

      if (data.payments && data.payments.length > 0) {
        submittedSplits = data.payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            mode: p.mode,
            amount: Number(p.amount),
            upiTxnRef: p.upiTxnRef,
            upiUtr: p.upiUtr,
            notes: p.notes,
          }));
      } else if (
        data.amountPaidNow !== undefined &&
        data.amountPaidNow !== null &&
        Number(data.amountPaidNow) > 0 &&
        data.paymentMode !== PaymentMode.CREDIT
      ) {
        submittedSplits = [
          {
            mode: data.paymentMode || PaymentMode.CASH,
            amount: Number(data.amountPaidNow),
          },
        ];
      }

      // When payment splits are provided on edit, synchronize invoice payments to match submitted splits
      if (data.payments !== undefined || data.amountPaidNow !== undefined) {
        await tx.payment.deleteMany({
          where: { invoiceId: id },
        });

        for (const split of submittedSplits) {
          if (split.amount <= 0) continue;
          await tx.payment.create({
            data: {
              invoiceId: id,
              partyId: party.id,
              mode: split.mode,
              amount: new Prisma.Decimal(split.amount.toFixed(2)),
              status: PaymentStatus.CONFIRMED,
              paidAt: new Date(),
              confirmedById: actorId,
              upiTxnRef: split.upiTxnRef,
              upiUtr: split.upiUtr,
              notes:
                split.notes ||
                `Updated ${split.mode} payment of ₹${split.amount.toFixed(2)} for ${existing.invoiceNo}`,
            },
          });
        }
      } else if (
        party.id !== existing.partyId &&
        existingConfirmedPayments.length > 0
      ) {
        await tx.payment.updateMany({
          where: { invoiceId: id, status: PaymentStatus.CONFIRMED },
          data: { partyId: party.id },
        });
      }

      // 5. Replace Line Items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // 6. Credit Ledger Reconciliation
      const existingCredit =
        (existing.creditLedgers && existing.creditLedgers[0]) ||
        (await tx.creditLedger.findFirst({ where: { invoiceId: id } }));

      const allCurrentPayments = await tx.payment.findMany({
        where: { invoiceId: id, status: PaymentStatus.CONFIRMED },
      });
      const totalSettledOrPaid = allCurrentPayments.reduce(
        (sum, p) =>
          p.type === PaymentType.OUTFLOW
            ? sum - Number(p.amount)
            : sum + Number(p.amount),
        0,
      );
      const netRemainingBalance = Math.max(
        0,
        Math.round((totalAmount - totalSettledOrPaid) * 100) / 100,
      );
      const balanceCredit = netRemainingBalance;

      if (existingCredit) {
        // Retain existing credit ledger history and set amountDue to net remaining balance
        await tx.creditLedger.update({
          where: { id: existingCredit.id },
          data: {
            partyId: party.id,
            amountDue: new Prisma.Decimal(netRemainingBalance.toFixed(2)),
            status:
              netRemainingBalance <= 0
                ? CreditStatus.SETTLED
                : totalSettledOrPaid > 0
                  ? CreditStatus.PARTIAL
                  : existingCredit.status === CreditStatus.OVERDUE
                    ? CreditStatus.OVERDUE
                    : CreditStatus.UNPAID,
            notes: `Balance receivable for Invoice #${existing.invoiceNo} (Updated)`,
          },
        });

        // Clean up any stray duplicate credit ledgers if any exist
        await tx.creditLedger.deleteMany({
          where: {
            invoiceId: id,
            id: { not: existingCredit.id },
          },
        });
      } else if (balanceCredit > 0) {
        await tx.creditLedger.create({
          data: {
            partyId: party.id,
            invoiceId: id,
            amountDue: new Prisma.Decimal(balanceCredit.toFixed(2)),
            type: CreditType.RECEIVABLE,
            status:
              totalSettledOrPaid > 0
                ? CreditStatus.PARTIAL
                : CreditStatus.UNPAID,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `Balance receivable for Invoice #${existing.invoiceNo} (Updated)`,
          },
        });
      }

      // Determine effective invoice payment mode and status
      let effectiveInvoicePaymentMode: PaymentMode;
      if (totalSettledOrPaid <= 0 && balanceCredit > 0) {
        effectiveInvoicePaymentMode = PaymentMode.CREDIT;
      } else if (submittedSplits.length === 1) {
        effectiveInvoicePaymentMode = submittedSplits[0].mode;
      } else if (submittedSplits.length > 1) {
        effectiveInvoicePaymentMode = PaymentMode.SPLIT;
      } else if (existingConfirmedPayments.length === 1) {
        effectiveInvoicePaymentMode = existingConfirmedPayments[0].mode;
      } else if (existingConfirmedPayments.length > 1) {
        effectiveInvoicePaymentMode = PaymentMode.SPLIT;
      } else {
        effectiveInvoicePaymentMode =
          existing.paymentMode || PaymentMode.CREDIT;
      }

      let newStatus: InvoiceStatus;
      if (balanceCredit <= 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (totalSettledOrPaid > 0) {
        newStatus = InvoiceStatus.PARTIAL;
      } else {
        newStatus = InvoiceStatus.CREATED;
      }

      // 7. Reconcile Deliveries
      const existingExtended = existing as unknown as ExtendedInvoice;
      const isCashSale =
        data.isCashSale !== undefined
          ? Boolean(data.isCashSale)
          : Boolean(existingExtended.isCashSale);

      const existingDelivery = await tx.delivery.findFirst({
        where: { invoiceId: id },
      });

      if (existingDelivery) {
        if (isCashSale) {
          if (existingDelivery.status === DeliveryStatus.PENDING) {
            await tx.delivery.delete({
              where: { id: existingDelivery.id },
            });
          }
        } else {
          await tx.delivery.update({
            where: { id: existingDelivery.id },
            data: {
              amountToCollect: new Prisma.Decimal(balanceCredit.toFixed(2)),
              notes:
                data.notes !== undefined ? data.notes : existingDelivery.notes,
            },
          });
        }
      } else if (!isCashSale) {
        await tx.delivery.create({
          data: {
            invoiceId: id,
            status: DeliveryStatus.PENDING,
            amountToCollect: new Prisma.Decimal(balanceCredit.toFixed(2)),
            notes: data.notes || null,
          },
        });
      }

      if (pendingAuditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: pendingAuditLogs.map((log) => ({
            ...log,
            diff: { ...log.diff, invoiceNo: existing.invoiceNo },
          })),
        });
      }

      // 9. Update the Invoice record
      let resolvedPreviousBalance = Number(existing.previousBalance || 0);
      if (party.id !== existing.partyId) {
        if (data.previousBalance !== undefined) {
          resolvedPreviousBalance = Number(data.previousBalance);
        } else {
          const priorLedgers = await tx.creditLedger.findMany({
            where: {
              partyId: party.id,
              invoiceId: { not: id },
              status: { not: CreditStatus.SETTLED },
            },
          });
          resolvedPreviousBalance = priorLedgers.reduce(
            (sum, cl) =>
              cl.type === CreditType.RECEIVABLE
                ? sum + Number(cl.amountDue || 0)
                : sum - Number(cl.amountDue || 0),
            0,
          );
        }
      } else if (
        data.previousBalance !== undefined &&
        (existing.previousBalance === null ||
          Number(existing.previousBalance) === 0)
      ) {
        resolvedPreviousBalance = Number(data.previousBalance);
      }

      const updateData = {
        partyId: party.id,
        status: newStatus,
        paymentMode: effectiveInvoicePaymentMode,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        address:
          data.address !== undefined
            ? data.address
            : existingExtended.address || party.address || null,
        isCashSale,
        previousBalance: new Prisma.Decimal(resolvedPreviousBalance.toFixed(2)),
        quotationId:
          data.quotationId !== undefined
            ? data.quotationId
            : existing.quotationId,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        tax: new Prisma.Decimal(taxAmount.toFixed(2)),
        taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
        transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
        transportGstRate: new Prisma.Decimal(transportGstRate.toFixed(2)),
        transportTax: new Prisma.Decimal(transportTax.toFixed(2)),
        itemsTax: new Prisma.Decimal(itemsTax.toFixed(2)),
        total: new Prisma.Decimal(totalAmount.toFixed(2)),
        roundOffEnabled,
        roundOffAmount: new Prisma.Decimal(roundOffAmount.toFixed(2)),
        taxBreakup,
        items: {
          create: allocatedInvoiceItems,
        },
      };

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          items: { include: { product: true, warehouse: true } },
          party: true,
          salesman: {
            select: { id: true, name: true, phone: true, role: true },
          },
          deliveries: true,
          payments: true,
          creditLedgers: true,
        },
      });

      const updatedExtended = updatedInvoice as unknown as ExtendedInvoice;

      // 10. Audit Log for Edit Invoice
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EDIT_INVOICE',
          entity: 'Invoice',
          entityId: id,
          diff: {
            invoiceNo: existing.invoiceNo,
            oldTotal: Number(existing.total),
            newTotal: totalAmount,
            oldItemsCount: existing.items.length,
            newItemsCount: allocatedInvoiceItems.length,
            isCashSale,
            address: updatedExtended.address || null,
          },
        },
      });

      return updatedInvoice;
    });
    this.invalidateInvoiceCaches();
    return result;
  }

  /**
   * Generates official GST-compliant Credit Note / Refund Voucher PDF
   */
  async updateReturn(
    refundId: string,
    data: ProcessReturnDto,
    userId: string,
    userRole?: Role,
  ) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('At least one returned item is required.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refundInvoice.findUnique({
        where: { id: refundId },
        include: {
          items: true,
          payments: true,
          creditLedgers: true,
          originalInvoice: { include: { refundInvoices: true } },
        },
      });
      if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);
      if (userRole === Role.SALESMAN) {
        const isOwner =
          refund.createdById === userId ||
          refund.originalInvoice?.salesmanId === userId;
        if (!isOwner) {
          throw new ForbiddenException(
            'Salesmen can only edit returns created by them or for their invoices',
          );
        }
      }
      if (!refund.originalInvoiceId || !refund.originalInvoice) {
        throw new BadRequestException(
          'Standalone returns cannot be edited from an invoice.',
        );
      }

      const oldByProduct = new Map<string, number>();
      for (const item of refund.items) {
        if (item.productId) {
          oldByProduct.set(
            item.productId,
            (oldByProduct.get(item.productId) || 0) + Number(item.qty),
          );
        }
      }
      const newByProduct = new Map<string, number>();
      for (const item of data.items) {
        if (item.productId) {
          newByProduct.set(
            item.productId,
            (newByProduct.get(item.productId) || 0) + item.qty,
          );
        }
      }

      for (const [productId, oldQty] of oldByProduct) {
        const newQty = newByProduct.get(productId) || 0;
        const delta = newQty - oldQty;
        if (Math.abs(delta) < 0.001) continue;
        const stock = await tx.stockLedger.findFirst({
          where: { productId },
          orderBy: { updatedAt: 'desc' },
        });
        if (delta < 0) {
          if (!stock || Number(stock.quantity) < Math.abs(delta)) {
            throw new BadRequestException(
              'Insufficient stock to reduce this returned quantity.',
            );
          }
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                decrement: new Prisma.Decimal(Math.abs(delta).toFixed(2)),
              },
            },
          });
        } else if (stock) {
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: { increment: new Prisma.Decimal(delta.toFixed(2)) },
            },
          });
        }
      }
      for (const [productId, newQty] of newByProduct) {
        if (oldByProduct.has(productId)) continue;
        const stock = await tx.stockLedger.findFirst({
          where: { productId },
          orderBy: { updatedAt: 'desc' },
        });
        if (stock) {
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: { increment: new Prisma.Decimal(newQty.toFixed(2)) },
            },
          });
        } else {
          await tx.stockLedger.create({
            data: {
              productId,
              warehouseId: null,
              batchNo: null,
              quantity: new Prisma.Decimal(newQty.toFixed(2)),
            },
          });
        }
      }

      const taxRate = Math.max(0, data.taxRate ?? 0);
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.qty * item.unitPrice,
        0,
      );
      const tax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      await tx.refundInvoiceItem.deleteMany({
        where: { refundInvoiceId: refundId },
      });
      await tx.refundInvoiceItem.createMany({
        data: data.items.map((item) => ({
          refundInvoiceId: refundId,
          productId: item.productId || null,
          customItemName: item.customItemName || null,
          warehouseId: item.warehouseId || null,
          batchNo: item.batchNo || null,
          qty: new Prisma.Decimal(item.qty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          total: new Prisma.Decimal(
            (
              item.qty * item.unitPrice +
              (item.qty * item.unitPrice * taxRate) / 100
            ).toFixed(2),
          ),
        })),
      });

      await tx.refundInvoice.update({
        where: { id: refundId },
        data: {
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          tax: new Prisma.Decimal(tax.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          refundMode: data.refundMode,
          reason: data.reason || refund.reason,
          taxBreakup: {
            rate: taxRate,
            totalTax: tax,
            cgst: tax / 2,
            sgst: tax / 2,
            igst: 0,
          },
        },
      });
      for (const payment of refund.payments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            amount: new Prisma.Decimal(total.toFixed(2)),
            mode: data.refundMode,
          },
        });
      }
      for (const ledger of refund.creditLedgers) {
        await tx.creditLedger.update({
          where: { id: ledger.id },
          data: { amountDue: new Prisma.Decimal(total.toFixed(2)) },
        });
      }

      const refunds = await tx.refundInvoice.findMany({
        where: { originalInvoiceId: refund.originalInvoiceId },
      });
      const refundedTotal = refunds.reduce(
        (sum, item) => sum + Number(item.total),
        0,
      );
      await tx.invoice.update({
        where: { id: refund.originalInvoiceId },
        data: {
          status:
            refundedTotal >= Number(refund.originalInvoice.total) - 0.01
              ? InvoiceStatus.CANCELLED
              : InvoiceStatus.PARTIAL,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'EDIT_RETURN',
          entity: 'RefundInvoice',
          entityId: refundId,
          diff: { oldTotal: Number(refund.total), newTotal: total },
        },
      });
      return tx.refundInvoice.findUnique({
        where: { id: refundId },
        include: { items: { include: { product: true } } },
      });
    });
    this.invalidateInvoiceCaches();
    return result;
  }

  async deleteReturn(refundId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refundInvoice.findUnique({
        where: { id: refundId },
        include: {
          items: true,
          payments: true,
          creditLedgers: true,
          originalInvoice: {
            include: { payments: true, refundInvoices: true },
          },
        },
      });
      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }

      for (const item of refund.items) {
        if (item.productId) {
          const stock = await tx.stockLedger.findFirst({
            where: { productId: item.productId },
            orderBy: { updatedAt: 'desc' },
          });
          if (stock) {
            const nextQty = Number(stock.quantity) - Number(item.qty);
            await tx.stockLedger.update({
              where: { id: stock.id },
              data: {
                quantity: new Prisma.Decimal(Math.max(0, nextQty).toFixed(2)),
              },
            });
          }
        }
      }

      await tx.payment.deleteMany({ where: { refundInvoiceId: refundId } });
      await tx.creditLedger.deleteMany({
        where: { refundInvoiceId: refundId },
      });
      await tx.refundInvoiceItem.deleteMany({
        where: { refundInvoiceId: refundId },
      });
      await tx.refundInvoice.delete({ where: { id: refundId } });

      if (refund.originalInvoiceId && refund.originalInvoice) {
        const remainingRefunds = await tx.refundInvoice.findMany({
          where: { originalInvoiceId: refund.originalInvoiceId },
        });
        const remainingRefundTotal = remainingRefunds.reduce(
          (sum, r) => sum + Number(r.total),
          0,
        );
        const confirmedPayments = refund.originalInvoice.payments
          .filter(
            (p) =>
              p.status === PaymentStatus.CONFIRMED &&
              p.refundInvoiceId !== refundId,
          )
          .reduce(
            (sum, p) =>
              p.type === PaymentType.OUTFLOW
                ? sum - Number(p.amount)
                : sum + Number(p.amount),
            0,
          );
        const invTotal = Number(refund.originalInvoice.total);

        let newStatus = refund.originalInvoice.status;
        if (remainingRefundTotal >= invTotal - 0.01) {
          newStatus = InvoiceStatus.CANCELLED;
        } else if (remainingRefundTotal > 0) {
          newStatus = InvoiceStatus.PARTIAL;
        } else if (confirmedPayments >= invTotal - 0.01) {
          newStatus = InvoiceStatus.PAID;
        } else if (confirmedPayments > 0) {
          newStatus = InvoiceStatus.PARTIAL;
        } else {
          newStatus = InvoiceStatus.CREATED;
        }

        await tx.invoice.update({
          where: { id: refund.originalInvoiceId },
          data: { status: newStatus },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_RETURN',
          entity: 'RefundInvoice',
          entityId: refundId,
          diff: {
            refundNo: refund.refundNo,
            total: Number(refund.total),
            originalInvoiceId: refund.originalInvoiceId,
          },
        },
      });

      return {
        success: true,
        message: `Refund ${refund.refundNo} deleted and stock adjusted.`,
      };
    });
    this.invalidateInvoiceCaches();
    return result;
  }

  async generateRefundPdf(refundId: string): Promise<GeneratedPdfResult> {
    const refund = await this.prisma.refundInvoice.findUnique({
      where: { id: refundId },
      include: {
        originalInvoice: true,
        party: true,
        createdBy: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true, warehouse: true } },
        payments: true,
      },
    });

    if (!refund) {
      throw new NotFoundException(`Refund Invoice ${refundId} not found`);
    }

    return generateRefundInvoicePdf(refund);
  }
}
