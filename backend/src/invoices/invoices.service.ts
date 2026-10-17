import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
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
import { PaginationParams } from '../common/interfaces/pagination.interface';
import { generateUpiIntentQr } from '../common/utils/upi.util';
import { GeneratedPdfResult, TaxBreakupData } from './pdf/pdf-utils';
import { generateInvoicePdf } from './pdf/invoice-pdf.generator';
import { generateRefundInvoicePdf } from './pdf/refund-pdf.generator';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

    // Pre-calculate line items and subtotal
    let subtotal = 0;
    const calculatedItems = data.items.map((item) => {
      const discount = item.discount || 0;
      const lineTotal = item.qty * item.unitPrice - discount;
      subtotal += lineTotal;
      return {
        ...item,
        discount,
        total: lineTotal,
      };
    });

    const itemsTax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const transportTax =
      Math.round(((transportCost * transportGstRate) / 100) * 100) / 100;
    const taxAmount = Math.round((itemsTax + transportTax) * 100) / 100;
    const totalAmount =
      Math.round((subtotal + itemsTax + transportCost + transportTax) * 100) /
      100;

    const fy = this.getFinancialYear();

    const invoice = await this.prisma.$transaction(async (tx) => {
      // 1. Transactional Party Resolution / Creation (prevents orphaned records on failure)
      let party: Party | null = null;
      if (data.partyId) {
        party = await tx.party.findUnique({
          where: { id: data.partyId },
        });
      } else if (data.newParty) {
        party = await tx.party.create({
          data: {
            name: data.newParty.name,
            phone: data.newParty.phone,
            address: data.newParty.address,
            gstin: data.newParty.gstin,
            isSaved: data.newParty.isSaved ?? true,
          },
        });
      }

      if (!party) {
        throw new NotFoundException(
          'Selected customer/party does not exist and new party details were not provided',
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
      // If amountPaidNow is explicitly provided, use it (bounded between 0 and totalAmount)
      // Otherwise: if CASH or UPI, full amount is paid upfront; if CREDIT, 0 paid upfront
      let upfrontAmount = 0;
      if (data.amountPaidNow !== undefined && data.amountPaidNow !== null) {
        upfrontAmount = Math.max(
          0,
          Math.min(Number(data.amountPaidNow), totalAmount),
        );
      } else {
        if (
          data.paymentMode === PaymentMode.CASH ||
          data.paymentMode === PaymentMode.UPI
        ) {
          upfrontAmount = totalAmount;
        } else {
          upfrontAmount = 0;
        }
      }
      // Round to 2 decimal places
      upfrontAmount = Math.round(upfrontAmount * 100) / 100;
      const balanceCredit = Math.max(
        0,
        Math.round((totalAmount - upfrontAmount) * 100) / 100,
      );

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

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          partyId: party.id,
          salesmanId,
          paymentMode: data.paymentMode,
          status: initialStatus,
          notes: data.notes,
          quotationId: data.quotationId || null,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          tax: new Prisma.Decimal(taxAmount.toFixed(2)),
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
          transportGstRate: new Prisma.Decimal(transportGstRate.toFixed(2)),
          transportTax: new Prisma.Decimal(transportTax.toFixed(2)),
          itemsTax: new Prisma.Decimal(itemsTax.toFixed(2)),
          total: new Prisma.Decimal(totalAmount.toFixed(2)),
          taxBreakup: taxBreakup,
          items: {
            create: allocatedInvoiceItems,
          },
        },
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

      // 4. If any amount was paid upfront (Cash, UPI, etc.), record a confirmed payment immediately
      if (upfrontAmount > 0) {
        const actualMode =
          data.paymentMode === PaymentMode.CREDIT
            ? PaymentMode.CASH
            : data.paymentMode || PaymentMode.UPI;
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            partyId: party.id,
            mode: actualMode,
            amount: new Prisma.Decimal(upfrontAmount.toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            paidAt: new Date(),
            confirmedById: salesmanId,
            notes: `Upfront payment of ₹${upfrontAmount.toFixed(2)} on invoice creation`,
          },
        });
      }

      // 5. If remaining balance is greater than 0, record in Credit Ledger
      if (balanceCredit > 0) {
        await tx.creditLedger.create({
          data: {
            partyId: party.id,
            invoiceId: invoice.id,
            amountDue: new Prisma.Decimal(balanceCredit.toFixed(2)),
            type: CreditType.RECEIVABLE,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days credit
            notes: `Balance receivable for Invoice #${invoiceNo}`,
          },
        });
      }

      // 6. Automatically dispatch to Delivery section in PENDING status
      // Link the leftover credit amount to driver's delivery collection!
      await tx.delivery.create({
        data: {
          invoiceId: invoice.id,
          status: DeliveryStatus.PENDING,
          amountToCollect: new Prisma.Decimal(balanceCredit.toFixed(2)),
          notes: data.notes || null,
        },
      });

      return invoice;
    });

    // Notify Owner & Admin about new sale
    const partyName = invoice.party?.name || 'Customer';
    void this.notifications.notifyAdmins(
      'New Sale Generated!',
      `₹${Math.round(totalAmount).toLocaleString('en-IN')} invoiced for ${partyName}.`,
      { type: 'NEW_INVOICE', invoiceId: invoice.id },
    );

    return invoice;
  }

  async findAll(
    user: { id: string; role: Role },
    pagination?: PaginationParams,
  ): Promise<any> {
    const where: Prisma.InvoiceWhereInput = {};
    // Salesmen only view their own sales unless Admin/Owner
    if (user.role === Role.SALESMAN) {
      where.salesmanId = user.id;
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
          productId: true,
          warehouseId: true,
          batchNo: true,
          qty: true,
          unitPrice: true,
          discount: true,
          total: true,
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
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
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
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
      take: 100,
    });

    return user.role === Role.SUPERVISOR
      ? invoices.map((inv) => this.sanitizeInvoiceForSupervisor(inv))
      : invoices;
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
    const customerPhone = invoice.party.phone;
    const total = Number(invoice.total).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

    // Customer caption - strictly direct message without any external links
    const customerMessage = `Hi ${customerName}, please find attached your Tax Invoice #${invoice.invoiceNo} from ${companyName}. Total Amount: Rs. ${total}. Thank you for your business!`;
    const customerWhatsAppUrl = `https://wa.me/91${customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(customerMessage)}`;

    // Driver caption
    const itemsList = invoice.items
      .map(
        (i) =>
          `• ${i.product?.name || 'Item'} (${i.qty} ${i.product?.unit || 'unit'}) [WH: ${i.warehouse?.name || 'Standard'}]`,
      )
      .join('\n');
    const driverMessage = `Delivery for Invoice #${invoice.invoiceNo}\nCustomer: ${customerName} (${customerPhone})\nAddress: ${invoice.party.address || 'Counter Pickup'}\nItems:\n${itemsList}`;

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
          itemReturnStats[key] = (itemReturnStats[key] || 0) + rItem.qty;
        }
      }
    }

    const itemsWithReturnStats = invoice.items.map((item) => {
      const key = `${item.productId}_${item.batchNo || ''}`;
      const returnedQty = itemReturnStats[key] || 0;
      const remainingReturnable = Math.max(0, item.qty - returnedQty);
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
  async processReturn(
    id: string,
    data: {
      items: Array<{
        productId: string;
        warehouseId: string;
        batchNo?: string;
        qty: number;
        unitPrice: number;
      }>;
      refundMode: PaymentMode;
      reason?: string;
    },
    userId: string,
  ) {
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
            (previouslyReturnedByProduct[pKey] || 0) + pItem.qty;
        }
      }

      for (const retItem of data.items) {
        if (!retItem.qty || retItem.qty <= 0) continue;
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
        const availableToReturn = purchasedItem.qty - prevReturned;
        if (retItem.qty > availableToReturn) {
          throw new BadRequestException(
            `Cannot return ${retItem.qty} units of "${purchasedItem.product?.name || 'Item'}". Already returned: ${prevReturned}, purchased: ${purchasedItem.qty}, max returnable: ${availableToReturn}.`,
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
        originalTaxBreakup.rate !== undefined ? originalTaxBreakup.rate : 18;

      let subtotal = 0;
      const returnedSummaries: string[] = [];
      const refundInvoiceItemsData: Prisma.RefundInvoiceItemUncheckedCreateWithoutRefundInvoiceInput[] =
        [];

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
              productId: item.productId,
              warehouseId: null,
              batchNo: null,
              quantity: new Prisma.Decimal(item.qty.toFixed(2)),
            },
          });
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        returnedSummaries.push(
          `${item.qty}x ${product?.name || 'Item'} returned to stock`,
        );

        refundInvoiceItemsData.push({
          productId: item.productId,
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

    return this.prisma.$transaction(async (tx) => {
      // 1. Atomically restore inventory to StockLedger with row-level locks
      for (const item of invoice.items) {
        if (!item.productId) continue;

        let stock = await tx.stockLedger.findFirst({
          where: { productId: item.productId },
          orderBy: { updatedAt: 'desc' },
        });

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
              warehouseId: null,
              batchNo: null,
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
  }

  /**
   * Generates official GST-compliant Credit Note / Refund Voucher PDF
   */
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
