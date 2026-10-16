import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, TransferStockDto } from './dto/stock.dto';
import { Prisma, StockLedger, Product, Warehouse, Role } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query?: {
      productId?: string;
      warehouseId?: string;
      page?: number;
      limit?: number;
    },
    user?: { id: string; role: Role; scope?: string | null },
  ): Promise<any> {
    const where: Prisma.StockLedgerWhereInput = {};
    if (query?.productId) where.productId = query.productId;
    if (query?.warehouseId) where.warehouseId = query.warehouseId;

    const isSupervisor = user?.role === Role.SUPERVISOR;
    if (isSupervisor && user?.scope) {
      where.warehouseId = user.scope;
    }

    const includeRelations = {
      product: true,
      warehouse: true,
    };

    const sanitizeStockForSupervisor = <T extends Record<string, unknown>>(
      item: T,
    ): T => {
      if (!item) return item;
      const rawProd =
        item.product && typeof item.product === 'object'
          ? (item.product as Record<string, unknown>)
          : null;
      if (!rawProd) return item;
      let cleanAttrs = rawProd.attributes;
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
        ...item,
        product: {
          ...rawProd,
          attributes: cleanAttrs,
        },
      };
    };

    if (query?.page !== undefined || query?.limit !== undefined) {
      const page = Math.max(1, query.page || 1);
      const limit = Math.min(Math.max(1, query.limit || 50), 100);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.stockLedger.findMany({
          where,
          include: includeRelations,
          orderBy: [
            { warehouse: { name: 'asc' } },
            { product: { name: 'asc' } },
          ],
          skip,
          take: limit,
        }),
        this.prisma.stockLedger.count({ where }),
      ]);

      return {
        data: isSupervisor
          ? data.map((item) => sanitizeStockForSupervisor(item))
          : data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const items = await this.prisma.stockLedger.findMany({
      where,
      include: includeRelations,
      orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
      take: 250,
    });

    return isSupervisor
      ? items.map((item) => sanitizeStockForSupervisor(item))
      : items;
  }

  async adjustStock(
    dto: AdjustStockDto,
    actorId?: string,
    user?: { id: string; role: Role; scope?: string | null },
  ): Promise<StockLedger & { product: Product; warehouse: Warehouse }> {
    if (user?.role === Role.SUPERVISOR && user.scope) {
      if (dto.warehouseId !== user.scope) {
        throw new ForbiddenException(
          'Supervisors can only adjust stock in their assigned warehouse.',
        );
      }
    }

    const batchNo = dto.batchNo || null;

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockLedger.findFirst({
        where: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          batchNo: batchNo,
        },
      });

      let currentQty = 0;
      let targetQuantity: number;
      let updated: StockLedger & { product: Product; warehouse: Warehouse };

      if (existing) {
        const lockedRows = await tx.$queryRaw<
          Array<{ id: string; quantity: number }>
        >`
          SELECT id, quantity FROM "StockLedger" WHERE id = ${existing.id} FOR UPDATE
        `;
        const lockedQty = lockedRows[0]?.quantity ?? existing.quantity ?? 0;
        currentQty = lockedQty;

        if (dto.mode === 'ADD') {
          targetQuantity = lockedQty + dto.quantity;
        } else {
          targetQuantity = dto.quantity;
        }

        if (targetQuantity < 0) {
          throw new BadRequestException('Stock quantity cannot be negative');
        }

        updated = await tx.stockLedger.update({
          where: { id: existing.id },
          data: { quantity: targetQuantity },
          include: { product: true, warehouse: true },
        });
      } else {
        targetQuantity = dto.quantity;
        if (targetQuantity < 0) {
          throw new BadRequestException('Stock quantity cannot be negative');
        }
        updated = await tx.stockLedger.create({
          data: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            batchNo,
            quantity: targetQuantity,
          },
          include: { product: true, warehouse: true },
        });
      }

      // Record in Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: dto.mode === 'ADD' ? 'STOCK_INWARD' : 'STOCK_ADJUSTMENT',
          entity: 'StockLedger',
          entityId: updated.id,
          diff: {
            mode: dto.mode || 'SET',
            previousQuantity: currentQty,
            operationQuantity: dto.quantity,
            newQuantity: targetQuantity,
            productName: product.name,
            warehouseName: warehouse.name,
            batchNo,
          },
        },
      });

      return updated;
    });
  }

  async zeroOutStock(
    query: { productId?: string; warehouseId?: string },
    actorId?: string,
    user?: { id: string; role: Role; scope?: string | null },
  ) {
    if (user?.role === Role.SUPERVISOR && user.scope) {
      if (query.warehouseId && query.warehouseId !== user.scope) {
        throw new ForbiddenException(
          'Supervisors can only zero out stock in their assigned warehouse.',
        );
      }
      query.warehouseId = user.scope;
    }

    if (!query.productId && !query.warehouseId) {
      throw new BadRequestException(
        'Either productId or warehouseId must be specified to zero out stock',
      );
    }

    const where: Prisma.StockLedgerWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    return this.prisma.$transaction(async (tx) => {
      const records = await tx.stockLedger.findMany({
        where,
        include: { product: true, warehouse: true },
      });

      for (const rec of records) {
        if (rec.quantity > 0) {
          await tx.stockLedger.update({
            where: { id: rec.id },
            data: { quantity: 0 },
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STOCK_ZERO_OUT',
              entity: 'StockLedger',
              entityId: rec.id,
              diff: {
                previousQuantity: rec.quantity,
                newQuantity: 0,
                productName: rec.product.name,
                warehouseName: rec.warehouse.name,
                batchNo: rec.batchNo,
              },
            },
          });
        }
      }

      return {
        message: 'Stock successfully zeroed out',
        updatedRecordsCount: records.length,
      };
    });
  }

  async transferStock(
    dto: TransferStockDto,
    actorId?: string,
    user?: { id: string; role: Role; scope?: string | null },
  ) {
    if (user?.role === Role.SUPERVISOR && user.scope) {
      if (dto.fromWarehouseId !== user.scope) {
        throw new ForbiddenException(
          'Supervisors can only transfer stock out of their assigned warehouse.',
        );
      }
    }

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'Source and destination warehouses cannot be the same',
      );
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be greater than 0');
    }

    const batchNo = dto.batchNo || null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Check and lock source stock
      const sourceStock = await tx.stockLedger.findFirst({
        where: {
          productId: dto.productId,
          warehouseId: dto.fromWarehouseId,
          batchNo: batchNo,
        },
      });

      if (!sourceStock) {
        throw new BadRequestException(
          'No stock record found in source warehouse for this product/batch',
        );
      }

      // Row-level lock to prevent concurrent over-allocation
      await tx.$queryRawUnsafe(
        `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
        sourceStock.id,
      );

      const lockedSource = await tx.stockLedger.findUnique({
        where: { id: sourceStock.id },
      });

      if (!lockedSource || lockedSource.quantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock in source warehouse. Available: ${lockedSource?.quantity ?? 0}, Requested: ${dto.quantity}`,
        );
      }

      // 2. Decrement source
      await tx.stockLedger.update({
        where: { id: sourceStock.id },
        data: { quantity: { decrement: dto.quantity } },
      });

      // 3. Increment destination atomically
      const destStock = await tx.stockLedger.findFirst({
        where: {
          productId: dto.productId,
          warehouseId: dto.toWarehouseId,
          batchNo: batchNo,
        },
      });

      if (destStock) {
        await tx.$queryRawUnsafe(
          `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
          destStock.id,
        );
        await tx.stockLedger.update({
          where: { id: destStock.id },
          data: { quantity: { increment: dto.quantity } },
        });
      } else {
        try {
          await tx.stockLedger.create({
            data: {
              productId: dto.productId,
              warehouseId: dto.toWarehouseId,
              batchNo,
              quantity: dto.quantity,
            },
          });
        } catch {
          // In case of concurrent creation race, lock and increment
          const fallbackDest = await tx.stockLedger.findFirst({
            where: {
              productId: dto.productId,
              warehouseId: dto.toWarehouseId,
              batchNo: batchNo,
            },
          });
          if (fallbackDest) {
            await tx.stockLedger.update({
              where: { id: fallbackDest.id },
              data: { quantity: { increment: dto.quantity } },
            });
          }
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STOCK_TRANSFER',
          entity: 'StockLedger',
          entityId: sourceStock.id,
          diff: {
            productId: dto.productId,
            fromWarehouseId: dto.fromWarehouseId,
            toWarehouseId: dto.toWarehouseId,
            batchNo,
            quantity: dto.quantity,
          },
        },
      });

      return {
        message: 'Stock transferred successfully',
        productId: dto.productId,
        transferredQuantity: dto.quantity,
        batchNo,
      };
    });
  }
}
