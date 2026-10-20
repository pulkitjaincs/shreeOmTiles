import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseDto,
  CreateDebitNoteDto,
} from './dto/create-purchase.dto';
import {
  PaymentMode,
  PaymentStatus,
  PaymentType,
  CreditType,
  CreditStatus,
  Prisma,
  Party,
  Role,
} from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  private getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const sStr = String(startYear).slice(-2);
    const eStr = String(endYear).slice(-2);
    return `${sStr}${eStr}`;
  }

  async update(id: string, data: CreatePurchaseDto, userId: string) {
    if (!data.items?.length) {
      throw new BadRequestException(
        'Purchase must contain at least one line item',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('Purchase not found');

      const partyId = data.partyId || existing.partyId;
      const party = await tx.party.findUnique({ where: { id: partyId } });
      if (!party)
        throw new NotFoundException('Selected supplier does not exist');

      const oldByProduct = new Map<string, number>();
      for (const item of existing.items) {
        oldByProduct.set(
          item.productId,
          (oldByProduct.get(item.productId) || 0) + Number(item.qty),
        );
      }
      const newByProduct = new Map<string, number>();
      for (const item of data.items) {
        newByProduct.set(
          item.productId,
          (newByProduct.get(item.productId) || 0) + Number(item.qty),
        );
      }
      const productIds = new Set([
        ...oldByProduct.keys(),
        ...newByProduct.keys(),
      ]);
      for (const productId of productIds) {
        const delta =
          (newByProduct.get(productId) || 0) -
          (oldByProduct.get(productId) || 0);
        if (!delta) continue;
        const stock = await tx.stockLedger.findFirst({
          where: { productId },
          orderBy: { updatedAt: 'desc' },
        });
        if (!stock) {
          if (delta < 0)
            throw new BadRequestException(
              'Stock ledger missing for a removed purchase item',
            );
          await tx.stockLedger.create({
            data: {
              productId,
              warehouseId: null,
              batchNo: null,
              quantity: new Prisma.Decimal(delta),
            },
          });
        } else {
          const next = Number(stock.quantity) + delta;
          if (next < 0)
            throw new BadRequestException(
              'Purchase edit would make stock negative',
            );
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: { quantity: new Prisma.Decimal(next.toFixed(2)) },
          });
        }
      }

      const taxRate = Math.max(0, data.taxRate ?? Number(existing.taxRate));
      const transportCost = Math.max(0, data.transportCost || 0);
      const calculatedItems = data.items.map((item) => {
        const discount = item.discount || 0;
        return {
          ...item,
          discount,
          total: item.qty * item.unitPrice - discount,
        };
      });
      const subtotal = calculatedItems.reduce(
        (sum, item) => sum + item.total,
        0,
      );
      const tax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const total = Math.round((subtotal + tax + transportCost) * 100) / 100;
      const paymentSplits = (data.payments || []).filter(
        (p) => Number(p.amount) > 0,
      );
      const paid = Math.min(
        total,
        paymentSplits.reduce((sum, p) => sum + Number(p.amount), 0),
      );
      const mode =
        paymentSplits.length > 1
          ? PaymentMode.SPLIT
          : paymentSplits[0]?.mode || PaymentMode.CREDIT;

      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.payment.deleteMany({ where: { purchaseId: id } });
      await tx.creditLedger.deleteMany({ where: { purchaseId: id } });
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          vendorBillNo: data.vendorBillNo,
          partyId,
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          tax: new Prisma.Decimal(tax.toFixed(2)),
          transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          paymentMode: mode,
          notes: data.notes,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              warehouseId: item.warehouseId,
              batchNo: item.batchNo,
              qty: new Prisma.Decimal(item.qty.toFixed(2)),
              unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
              discount: new Prisma.Decimal(item.discount.toFixed(2)),
              total: new Prisma.Decimal(item.total.toFixed(2)),
            })),
          },
        },
        include: {
          items: { include: { product: true, warehouse: true } },
          party: true,
          payments: true,
          creditLedgers: true,
        },
      });
      for (const split of paymentSplits) {
        await tx.payment.create({
          data: {
            purchaseId: id,
            partyId,
            mode: split.mode,
            amount: new Prisma.Decimal(Number(split.amount).toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            type: PaymentType.OUTFLOW,
            paidAt: new Date(),
            confirmedById: userId,
            upiTxnRef: split.upiTxnRef,
            upiUtr: split.upiUtr,
            notes: split.notes,
          },
        });
      }
      if (total - paid > 0) {
        await tx.creditLedger.create({
          data: {
            purchaseId: id,
            partyId,
            amountDue: new Prisma.Decimal((total - paid).toFixed(2)),
            type: CreditType.PAYABLE,
            status: paid > 0 ? CreditStatus.PARTIAL : CreditStatus.UNPAID,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `Balance payable to supplier for Purchase #${existing.purchaseNo}`,
          },
        });
      }
      return updated;
    });
  }

  async create(data: CreatePurchaseDto, userId: string) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException(
        'Purchase must contain at least one line item',
      );
    }

    if (!data.partyId && !data.newParty) {
      throw new BadRequestException('Supplier / vendor details are required');
    }

    const fy = this.getFinancialYear();
    const taxRate = data.taxRate !== undefined ? Math.max(0, data.taxRate) : 0;
    const transportCost = Math.max(0, data.transportCost || 0);

    // Precalculate subtotal
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

    const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const totalAmount =
      Math.round((subtotal + taxAmount + transportCost) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve or create vendor party
      let party: Party | null = null;
      if (data.partyId) {
        party = await tx.party.findUnique({ where: { id: data.partyId } });
      } else if (data.newParty) {
        party = await tx.party.create({
          data: {
            name: data.newParty.name?.trim() || 'Walk-in Supplier',
            phone: data.newParty.phone?.trim() || '',
            address: data.newParty.address || null,
            gstin: data.newParty.gstin || null,
            isSaved: data.newParty.isSaved ?? true,
          },
        });
      }

      if (!party) {
        throw new NotFoundException('Selected supplier does not exist');
      }

      // 2. Sequential Purchase Number
      const seq = await tx.purchaseSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const purchaseNo = `PUR-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      // 3. Atomically inward stock for each item
      const purchaseItemsData: Prisma.PurchaseItemUncheckedCreateWithoutPurchaseInput[] =
        [];

      for (const item of calculatedItems) {
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
          const prevQty = Number(lockedRows[0]?.quantity ?? stock.quantity);
          const newQty = prevQty + itemQty;
          stock = await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              quantity: {
                increment: new Prisma.Decimal(itemQty.toFixed(2)),
              },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: userId,
              action: 'PURCHASE_STOCK_INWARD',
              entity: 'StockLedger',
              entityId: stock.id,
              diff: {
                purchaseNo,
                productId: item.productId,
                qtyAdded: itemQty,
                previousQuantity: prevQty,
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
              actorId: userId,
              action: 'PURCHASE_STOCK_INWARD',
              entity: 'StockLedger',
              entityId: stock.id,
              diff: {
                purchaseNo,
                productId: item.productId,
                qtyAdded: itemQty,
                previousQuantity: 0,
                newQuantity: itemQty,
              },
            },
          });
        }

        purchaseItemsData.push({
          productId: item.productId,
          warehouseId: null,
          batchNo: null,
          qty: new Prisma.Decimal(itemQty.toFixed(2)),
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          discount: new Prisma.Decimal(item.discount.toFixed(2)),
          total: new Prisma.Decimal(item.total.toFixed(2)),
        });
      }

      // 4. Calculate upfront payment and credit balance
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
        paymentSplits = [
          {
            mode: data.paymentMode || PaymentMode.BANK_TRANSFER,
            amount: Number(data.amountPaidNow),
          },
        ];
      } else if (
        data.paymentMode === PaymentMode.CASH ||
        data.paymentMode === PaymentMode.BANK_TRANSFER ||
        data.paymentMode === PaymentMode.UPI ||
        data.paymentMode === PaymentMode.CARD
      ) {
        paymentSplits = [
          {
            mode: data.paymentMode,
            amount: totalAmount,
          },
        ];
      }

      const rawAmountPaidNow = paymentSplits.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const amountPaidNow = Math.max(
        0,
        Math.min(rawAmountPaidNow, totalAmount),
      );
      const balancePayable = Math.max(
        0,
        Math.round((totalAmount - amountPaidNow) * 100) / 100,
      );

      let effectivePurchaseMode: PaymentMode;
      if (paymentSplits.length === 0) {
        effectivePurchaseMode = PaymentMode.CREDIT;
      } else if (paymentSplits.length === 1) {
        effectivePurchaseMode = paymentSplits[0].mode;
      } else {
        effectivePurchaseMode = PaymentMode.SPLIT;
      }

      // Create Purchase Record
      const purchase = await tx.purchase.create({
        data: {
          purchaseNo,
          vendorBillNo: data.vendorBillNo,
          partyId: party.id,
          createdById: userId,
          taxRate: new Prisma.Decimal(taxRate.toFixed(2)),
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          tax: new Prisma.Decimal(taxAmount.toFixed(2)),
          transportCost: new Prisma.Decimal(transportCost.toFixed(2)),
          total: new Prisma.Decimal(totalAmount.toFixed(2)),
          paymentMode: effectivePurchaseMode,
          notes: data.notes,
          items: {
            create: purchaseItemsData,
          },
        },
        include: {
          items: { include: { product: true, warehouse: true } },
          party: true,
          createdBy: { select: { id: true, name: true, phone: true } },
        },
      });

      // 5. Financial settlement (Paid vs Payable)
      for (const split of paymentSplits) {
        if (split.amount <= 0) continue;
        await tx.payment.create({
          data: {
            purchaseId: purchase.id,
            partyId: party.id,
            mode: split.mode,
            amount: new Prisma.Decimal(split.amount.toFixed(2)),
            status: PaymentStatus.CONFIRMED,
            type: PaymentType.OUTFLOW,
            paidAt: new Date(),
            confirmedById: userId,
            upiTxnRef: split.upiTxnRef,
            upiUtr: split.upiUtr,
            notes:
              split.notes ||
              `Supplier payment of ₹${split.amount.toFixed(2)} (${split.mode}) for ${purchaseNo}`,
          },
        });
      }

      if (balancePayable > 0) {
        await tx.creditLedger.create({
          data: {
            purchaseId: purchase.id,
            partyId: party.id,
            amountDue: new Prisma.Decimal(balancePayable.toFixed(2)),
            type: CreditType.PAYABLE,
            status: CreditStatus.UNPAID,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `Balance payable to supplier for Purchase #${purchaseNo}`,
          },
        });
      }

      return purchase;
    });
  }

  async findAll(
    pagination?: PaginationParams,
    search?: string,
    user?: { id: string; role: Role; scope?: string | null },
  ) {
    const where: Prisma.PurchaseWhereInput = {};
    if (search) {
      where.OR = [
        { purchaseNo: { contains: search, mode: 'insensitive' } },
        { vendorBillNo: { contains: search, mode: 'insensitive' } },
        { party: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const isSupervisor = user?.role === Role.SUPERVISOR;
    if (isSupervisor && user?.scope) {
      where.items = {
        some: { warehouseId: user.scope },
      };
    }

    const includeRelations = {
      party: true,
      createdBy: { select: { id: true, name: true, phone: true } },
      items: { include: { product: true, warehouse: true } },
      payments: true,
      creditLedgers: true,
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.purchase.findMany({
          where,
          include: includeRelations,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.purchase.count({ where }),
      ]);

      return {
        data: isSupervisor
          ? data.map((p) => this.sanitizePurchaseForSupervisor(p))
          : data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const purchases = await this.prisma.purchase.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return isSupervisor
      ? purchases.map((p) => this.sanitizePurchaseForSupervisor(p))
      : purchases;
  }

  private sanitizePurchaseForSupervisor<T extends Record<string, unknown>>(
    purchase: T,
  ): T {
    const rawItems = Array.isArray(purchase.items)
      ? (purchase.items as Array<Record<string, unknown>>)
      : [];

    const items = rawItems.map((it) => {
      const prod =
        it.product && typeof it.product === 'object'
          ? (it.product as Record<string, unknown>)
          : null;

      let cleanAttrs = prod?.attributes;
      if (cleanAttrs && typeof cleanAttrs === 'object') {
        const copy = { ...(cleanAttrs as Record<string, unknown>) };
        delete copy.price;
        delete copy.sellingPrice;
        delete copy.purchasePrice;
        delete copy.cost;
        delete copy.rate;
        cleanAttrs = copy;
      }

      return {
        ...it,
        unitPrice: new Prisma.Decimal(0),
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        product: prod
          ? {
              ...prod,
              attributes: cleanAttrs,
            }
          : null,
      };
    });

    return {
      ...purchase,
      subtotal: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      taxRate: new Prisma.Decimal(0),
      transportCost: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
      payments: [],
      creditLedgers: [],
      debitNotes: [],
      items,
    };
  }

  async findOne(
    id: string,
    user?: { id: string; role: Role; scope?: string | null },
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        party: true,
        createdBy: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true, warehouse: true } },
        payments: true,
        creditLedgers: true,
        debitNotes: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    if (user?.role === Role.SUPERVISOR) {
      return this.sanitizePurchaseForSupervisor(purchase);
    }

    return purchase;
  }

  async createDebitNote(
    purchaseId: string,
    dto: CreateDebitNoteDto,
    userId: string,
  ) {
    const purchase = await this.findOne(purchaseId);
    const fy = this.getFinancialYear();

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.debitNoteSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const debitNoteNo = `DN-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;

      const debitNote = await tx.debitNote.create({
        data: {
          debitNoteNo,
          purchaseId: purchase.id,
          partyId: purchase.partyId,
          amount: new Prisma.Decimal(dto.amount.toFixed(2)),
          reason: dto.reason,
        },
      });

      // Reduce payable debt or record advance supplier credit
      const existingPayable = await tx.creditLedger.findFirst({
        where: {
          purchaseId: purchase.id,
          type: CreditType.PAYABLE,
          status: { not: CreditStatus.SETTLED },
        },
      });

      if (existingPayable) {
        const curDue = Number(existingPayable.amountDue);
        if (curDue >= dto.amount) {
          const newDue = curDue - dto.amount;
          await tx.creditLedger.update({
            where: { id: existingPayable.id },
            data: {
              amountDue: new Prisma.Decimal(newDue.toFixed(2)),
              status:
                newDue === 0 ? CreditStatus.SETTLED : CreditStatus.PARTIAL,
            },
          });
        } else {
          await tx.creditLedger.update({
            where: { id: existingPayable.id },
            data: {
              amountDue: new Prisma.Decimal(0),
              status: CreditStatus.SETTLED,
            },
          });
          const excess = dto.amount - curDue;
          if (excess > 0.01) {
            await tx.creditLedger.create({
              data: {
                partyId: purchase.partyId,
                purchaseId: purchase.id,
                amountDue: new Prisma.Decimal(excess.toFixed(2)),
                type: CreditType.RECEIVABLE,
                status: CreditStatus.UNPAID,
                notes: `Advance supplier credit from Debit Note #${debitNoteNo} against Purchase #${purchase.purchaseNo}`,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'CREATE_DEBIT_NOTE',
          entity: 'DebitNote',
          entityId: debitNote.id,
          diff: {
            debitNoteNo,
            purchaseNo: purchase.purchaseNo,
            amount: dto.amount,
            reason: dto.reason,
          },
        },
      });

      return debitNote;
    });
  }

  async deletePurchase(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
          creditLedgers: true,
          debitNotes: true,
        },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.debitNotes && purchase.debitNotes.length > 0) {
        throw new BadRequestException(
          'Cannot delete purchase with existing debit notes. Revert debit notes first.',
        );
      }

      for (const item of purchase.items) {
        const stock = await tx.stockLedger.findFirst({
          where: { productId: item.productId },
          orderBy: { updatedAt: 'desc' },
        });
        if (stock) {
          const next = Number(stock.quantity) - Number(item.qty);
          if (next < 0) {
            throw new BadRequestException(
              `Cannot delete purchase: stock for product ${item.productId} would drop below zero`,
            );
          }
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: { quantity: new Prisma.Decimal(next.toFixed(2)) },
          });
        }
      }

      await tx.payment.deleteMany({ where: { purchaseId: id } });
      await tx.creditLedger.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchase.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_PURCHASE',
          entity: 'Purchase',
          entityId: id,
          diff: {
            purchaseNo: purchase.purchaseNo,
            total: Number(purchase.total),
            vendorBillNo: purchase.vendorBillNo,
          },
        },
      });

      return {
        success: true,
        message: `Purchase ${purchase.purchaseNo} deleted and stock reverted successfully`,
      };
    });
  }
}
