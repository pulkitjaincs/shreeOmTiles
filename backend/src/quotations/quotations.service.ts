import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { Prisma, QuotationStatus, PaymentMode } from '@prisma/client';
import { PaginationParams, DateRangeFilter, buildDateRange } from '../common/interfaces/pagination.interface';
import { generateQuotationPdf } from './pdf/quotation-pdf.generator';
import { PaymentSplitDto } from '../common/dto/payment-split.dto';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly invoicesService: InvoicesService,
  ) {}

  private getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const sStr = String(startYear).slice(-2);
    const eStr = String(endYear).slice(-2);
    return `${sStr}${eStr}`;
  }

  async create(data: CreateQuotationDto, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException(
        'Quotation must contain at least one line item',
      );
    }

    const fy = this.getFinancialYear();
    const taxRate = data.taxRate !== undefined ? Math.max(0, data.taxRate) : 18;
    const transportCost = Math.max(0, data.transportCost || 0);
    const transportGstRate = Math.max(0, data.transportGstRate || 0);

    let subtotal = 0;
    const itemsData: Prisma.QuotationItemUncheckedCreateWithoutQuotationInput[] =
      [];

    for (const item of data.items) {
      const discount = item.discount || 0;
      const lineTotal = item.qty * item.unitPrice - discount;
      subtotal += lineTotal;
      itemsData.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
        discount: new Prisma.Decimal(discount.toFixed(2)),
        total: new Prisma.Decimal(lineTotal.toFixed(2)),
      });
    }

    const itemsTax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const transportTax =
      Math.round(((transportCost * transportGstRate) / 100) * 100) / 100;
    const tax = Math.round((itemsTax + transportTax) * 100) / 100;
    const total = Math.round((subtotal + tax + transportCost) * 100) / 100;

    const res = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.quotationSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const quotationNo = `EST-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      return tx.quotation.create({
        data: {
          quotationNo,
          partyId: data.partyId || null,
          customerName: data.customerName || null,
          customerPhone: data.customerPhone || null,
          customerAddress: data.customerAddress || null,
          createdById: userId,
          status: QuotationStatus.SENT,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          tax: new Prisma.Decimal(tax.toFixed(2)),
          transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
          transportGstRate: new Prisma.Decimal(transportGstRate.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          notes: data.notes,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          party: true,
          createdBy: { select: { id: true, name: true, phone: true } },
        },
      });
    });
    this.cacheService.invalidatePrefix('quotations:');
    this.cacheService.invalidatePrefix('analytics:');
    return res;
  }

  async findAll(
    pagination?: PaginationParams,
    search?: string,
    dateFilter?: DateRangeFilter,
  ) {
    const cacheKey = `quotations:${search || ''}:${JSON.stringify(pagination || {})}:${dateFilter?.preset || ''}:${dateFilter?.from || ''}:${dateFilter?.to || ''}`;
    // Quotations cache: 1 hour (3600 seconds)
    return this.cacheService.wrap(cacheKey, 3600, async () => {
      const where: Prisma.QuotationWhereInput = {};
      if (search) {
        where.OR = [
          { quotationNo: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search, mode: 'insensitive' } },
          { party: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const dateRange = buildDateRange(dateFilter);
      if (dateRange) {
        where.createdAt = dateRange;
      }

      // Optimization: pruned joins for list view
      const includeRelations = {
        party: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true, phone: true } },
        items: {
          select: {
            id: true,
            productId: true,
            qty: true,
            unitPrice: true,
            discount: true,
            total: true,
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        invoices: { select: { id: true, invoiceNo: true } },
      };

      if (pagination?.page !== undefined || pagination?.limit !== undefined) {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(Math.max(1, pagination?.limit || 25), 500);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
          this.prisma.quotation.findMany({
            where,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.quotation.count({ where }),
        ]);

        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      return this.prisma.quotation.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
        ...(dateRange ? {} : { take: 2000 }),
      });
    });
  }

  async findOne(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        party: true,
        createdBy: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true } },
        invoices: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    return quotation;
  }

  async generatePdf(id: string) {
    const quotation = await this.findOne(id);
    return generateQuotationPdf(quotation);
  }

  async convertToInvoice(
    id: string,
    salesmanId: string,
    paymentMode?: PaymentMode,
    amountPaidNow?: number,
    payments?: PaymentSplitDto[],
  ) {
    const quotation = await this.findOne(id);

    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new BadRequestException(
        'Quotation has already been converted to an invoice',
      );
    }

    // 1. Check live stock availability for all items
    for (const item of quotation.items) {
      const stockSum = await this.prisma.stockLedger.aggregate({
        where: { productId: item.productId },
        _sum: { quantity: true },
      });
      const available = Number(stockSum._sum.quantity || 0);
      const required = Number(item.qty);
      if (available < required) {
        throw new BadRequestException(
          `Insufficient stock for "${item.product?.name || item.productId}". Required: ${required}, Available: ${available}`,
        );
      }
    }

    // 2. Prepare invoice DTO
    let partyId = quotation.partyId;
    let newParty:
      { name: string; phone: string; address?: string } | undefined = undefined;

    if (!partyId) {
      if (!quotation.customerName || !quotation.customerPhone) {
        throw new BadRequestException(
          'Quotation does not have valid party or customer contact details to create an invoice',
        );
      }
      // Check if party with this phone already exists
      const existing = await this.prisma.party.findFirst({
        where: { phone: quotation.customerPhone },
      });
      if (existing) {
        partyId = existing.id;
      } else {
        newParty = {
          name: quotation.customerName,
          phone: quotation.customerPhone,
          address: quotation.customerAddress || undefined,
        };
      }
    }

    const converterUser = await this.prisma.user.findUnique({
      where: { id: salesmanId },
      select: { role: true },
    });
    const defaultMode =
      converterUser?.role === 'SALESMAN'
        ? PaymentMode.CASH
        : PaymentMode.CREDIT;
    const effectivePaymentMode = paymentMode || defaultMode;

    const invoiceDto = {
      partyId: partyId || undefined,
      newParty,
      quotationId: quotation.id,
      paymentMode: effectivePaymentMode,
      amountPaidNow: amountPaidNow !== undefined ? amountPaidNow : 0,
      payments: payments && payments.length > 0 ? payments : undefined,
      taxRate: Number(quotation.taxRate),
      transportCost: Number(quotation.transportCost),
      transportGstRate: Number(quotation.transportGstRate),
      notes: quotation.notes
        ? `Converted from Quotation #${quotation.quotationNo}. ${quotation.notes}`
        : `Converted from Quotation #${quotation.quotationNo}`,
      items: quotation.items.map((it) => ({
        productId: it.productId,
        qty: Number(it.qty),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount),
      })),
    };

    const invoice = await this.invoicesService.create(invoiceDto, salesmanId);

    await this.prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: QuotationStatus.CONVERTED },
    });

    this.cacheService.invalidatePrefix('quotations:');
    this.cacheService.invalidatePrefix('analytics:');
    return invoice;
  }

  async update(id: string, data: CreateQuotationDto, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException(
        'Quotation must contain at least one line item',
      );
    }

    const res = await this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!quotation) throw new NotFoundException('Quotation not found');
      if (quotation.status === QuotationStatus.CONVERTED) {
        throw new BadRequestException(
          'Cannot edit a quotation that has already been converted to an invoice',
        );
      }

      const taxRate =
        data.taxRate !== undefined
          ? Math.max(0, data.taxRate)
          : Number(quotation.taxRate || 18);
      const transportCost = Math.max(0, data.transportCost || 0);
      const transportGstRate = Math.max(0, data.transportGstRate || 0);

      let subtotal = 0;
      const itemsData: Prisma.QuotationItemUncheckedCreateWithoutQuotationInput[] =
        [];
      for (const item of data.items) {
        const discount = item.discount || 0;
        const lineTotal = item.qty * item.unitPrice - discount;
        subtotal += lineTotal;
        itemsData.push({
          productId: item.productId,
          qty: item.qty,
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          discount: new Prisma.Decimal(discount.toFixed(2)),
          total: new Prisma.Decimal(lineTotal.toFixed(2)),
        });
      }

      const itemsTax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const transportTax =
        Math.round(((transportCost * transportGstRate) / 100) * 100) / 100;
      const tax = Math.round((itemsTax + transportTax) * 100) / 100;
      const total = Math.round((subtotal + tax + transportCost) * 100) / 100;

      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      const updated = await tx.quotation.update({
        where: { id },
        data: {
          partyId: data.partyId || null,
          customerName: data.customerName || null,
          customerPhone: data.customerPhone || null,
          customerAddress: data.customerAddress || null,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          tax: new Prisma.Decimal(tax.toFixed(2)),
          transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
          transportGstRate: new Prisma.Decimal(transportGstRate.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          notes: data.notes,
          items: {
            create: itemsData,
          },
        },
        include: {
          party: true,
          items: { include: { product: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'EDIT_QUOTATION',
          entity: 'Quotation',
          entityId: id,
          diff: {
            quotationNo: quotation.quotationNo,
            oldTotal: Number(quotation.total),
            newTotal: total,
          },
        },
      });

      return updated;
    });
    this.cacheService.invalidatePrefix('quotations:');
    this.cacheService.invalidatePrefix('analytics:');
    return res;
  }

  async delete(id: string, userId: string) {
    const res = await this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id },
      });
      if (!quotation) throw new NotFoundException('Quotation not found');
      if (quotation.status === QuotationStatus.CONVERTED) {
        throw new BadRequestException(
          'Cannot delete a quotation that has already been converted to an invoice',
        );
      }

      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotation.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_QUOTATION',
          entity: 'Quotation',
          entityId: id,
          diff: {
            quotationNo: quotation.quotationNo,
            total: Number(quotation.total),
          },
        },
      });

      return {
        success: true,
        message: `Quotation ${quotation.quotationNo} deleted successfully`,
      };
    });
    this.cacheService.invalidatePrefix('quotations:');
    this.cacheService.invalidatePrefix('analytics:');
    return res;
  }
}
