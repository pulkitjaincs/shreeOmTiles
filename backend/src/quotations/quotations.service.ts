import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { Prisma, QuotationStatus, PaymentMode } from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import { generateQuotationPdf } from './pdf/quotation-pdf.generator';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
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

    return this.prisma.$transaction(async (tx) => {
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
  }

  async findAll(pagination?: PaginationParams, search?: string) {
    const where: Prisma.QuotationWhereInput = {};
    if (search) {
      where.OR = [
        { quotationNo: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { party: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const includeRelations = {
      party: true,
      createdBy: { select: { id: true, name: true, phone: true } },
      items: { include: { product: true } },
      invoices: true,
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
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
      take: 100,
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
      const available = stockSum._sum.quantity || 0;
      if (available < item.qty) {
        throw new BadRequestException(
          `Insufficient stock for "${item.product?.name || item.productId}". Required: ${item.qty}, Available: ${available}`,
        );
      }
    }

    // 2. Prepare invoice DTO
    let partyId = quotation.partyId;
    let newParty: { name: string; phone: string; address?: string } | undefined = undefined;

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
      converterUser?.role === 'SALESMAN' ? PaymentMode.CASH : PaymentMode.CREDIT;
    const effectivePaymentMode = paymentMode || defaultMode;

    const invoiceDto = {
      partyId: partyId || undefined,
      newParty,
      quotationId: quotation.id,
      paymentMode: effectivePaymentMode,
      amountPaidNow: amountPaidNow !== undefined ? amountPaidNow : 0,
      taxRate: Number(quotation.taxRate),
      transportCost: Number(quotation.transportCost),
      transportGstRate: Number(quotation.transportGstRate),
      notes: quotation.notes
        ? `Converted from Quotation #${quotation.quotationNo}. ${quotation.notes}`
        : `Converted from Quotation #${quotation.quotationNo}`,
      items: quotation.items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount),
      })),
    };

    const invoice = await this.invoicesService.create(invoiceDto, salesmanId);

    await this.prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: QuotationStatus.CONVERTED },
    });

    return invoice;
  }
}
