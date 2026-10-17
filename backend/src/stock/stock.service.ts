import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, TransferStockDto } from './dto/stock.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query?: {
      productId?: string;
      warehouseId?: string;
      page?: number;
      limit?: number;
      inStockOnly?: boolean;
    },
    user?: { id: string; role: Role; scope?: string | null },
  ): Promise<any> {
    const isSupervisor = user?.role === Role.SUPERVISOR;

    const sanitizeProduct = <T extends Record<string, unknown>>(prod: T): T => {
      if (!prod) return prod;
      let cleanAttrs = prod.attributes;
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
        ...prod,
        attributes: cleanAttrs,
      };
    };

    // Query active products with their stock ledgers
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query?.productId ? { id: query.productId } : {}),
    };

    const products = await this.prisma.product.findMany({
      where: productWhere,
      include: {
        stockLedgers: true,
      },
      orderBy: { name: 'asc' },
    });

    // Aggregate warehouse-level stock into a single available quantity per product
    const aggregated = products
      .map((prod) => {
        const totalQty = prod.stockLedgers.reduce(
          (sum, l) => sum + Number(l.quantity || 0),
          0,
        );

        let latestUpdatedAt = prod.updatedAt;
        for (const l of prod.stockLedgers) {
          if (l.updatedAt && l.updatedAt > latestUpdatedAt) {
            latestUpdatedAt = l.updatedAt;
          }
        }

        const cleanProd = isSupervisor ? sanitizeProduct(prod) : prod;

        return {
          id: prod.id,
          productId: prod.id,
          quantity: Number(totalQty.toFixed(2)),
          availableQuantity: Number(totalQty.toFixed(2)),
          product: cleanProd,
          batchNo: null,
          warehouseId: null,
          warehouse: null,
          updatedAt: latestUpdatedAt,
        };
      })
      .filter((item) => {
        if (query?.inStockOnly) {
          return item.quantity > 0;
        }
        return true;
      });

    if (query?.page !== undefined || query?.limit !== undefined) {
      const page = Math.max(1, query.page || 1);
      const limit = Math.min(Math.max(1, query.limit || 50), 100);
      const skip = (page - 1) * limit;

      const pagedData = aggregated.slice(skip, skip + limit);

      return {
        data: pagedData,
        total: aggregated.length,
        page,
        limit,
        totalPages: Math.ceil(aggregated.length / limit),
      };
    }

    return aggregated;
  }

  async adjustStock(
    dto: AdjustStockDto,
    actorId?: string,
    _user?: { id: string; role: Role; scope?: string | null },
  ): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.$transaction(async (tx) => {
      // Find all existing stock ledgers for this product
      const ledgers = await tx.stockLedger.findMany({
        where: { productId: dto.productId },
      });

      const currentTotalQty = ledgers.reduce(
        (sum, l) => sum + Number(l.quantity || 0),
        0,
      );

      let targetQuantity: number;
      if (dto.mode === 'ADD') {
        targetQuantity = currentTotalQty + dto.quantity;
      } else {
        targetQuantity = dto.quantity;
      }

      // Pick primary ledger (prefer warehouseId: null, or first ledger)
      let primaryLedger =
        ledgers.find((l) => l.warehouseId === null) || ledgers[0];

      if (primaryLedger) {
        await tx.$queryRawUnsafe(
          `SELECT id, quantity FROM "StockLedger" WHERE id = $1 FOR UPDATE`,
          primaryLedger.id,
        );

        if (dto.mode === 'ADD') {
          primaryLedger = await tx.stockLedger.update({
            where: { id: primaryLedger.id },
            data: {
              quantity: {
                increment: new Prisma.Decimal(dto.quantity.toFixed(2)),
              },
            },
            include: { product: true, warehouse: true },
          });
        } else {
          primaryLedger = await tx.stockLedger.update({
            where: { id: primaryLedger.id },
            data: { quantity: new Prisma.Decimal(targetQuantity.toFixed(2)) },
            include: { product: true, warehouse: true },
          });

          const otherLedgerIds = ledgers
            .filter(
              (l) => l.id !== primaryLedger.id && Number(l.quantity) !== 0,
            )
            .map((l) => l.id);

          if (otherLedgerIds.length > 0) {
            await tx.stockLedger.updateMany({
              where: { id: { in: otherLedgerIds } },
              data: { quantity: new Prisma.Decimal(0) },
            });
          }
        }
      } else {
        primaryLedger = await tx.stockLedger.create({
          data: {
            productId: dto.productId,
            warehouseId: null,
            batchNo: null,
            quantity: new Prisma.Decimal(targetQuantity.toFixed(2)),
          },
          include: { product: true, warehouse: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: dto.mode === 'ADD' ? 'STOCK_INWARD' : 'STOCK_ADJUSTMENT',
          entity: 'StockLedger',
          entityId: primaryLedger.id,
          diff: {
            mode: dto.mode || 'SET',
            previousQuantity: currentTotalQty,
            operationQuantity: dto.quantity,
            newQuantity: targetQuantity,
            productName: product.name,
          },
        },
      });

      return {
        id: product.id,
        productId: product.id,
        quantity: Number(targetQuantity.toFixed(2)),
        availableQuantity: Number(targetQuantity.toFixed(2)),
        product,
        warehouseId: null,
        warehouse: null,
        batchNo: null,
        updatedAt: primaryLedger.updatedAt,
      };
    });
  }

  async zeroOutStock(
    query: { productId?: string; warehouseId?: string },
    actorId?: string,
    _user?: { id: string; role: Role; scope?: string | null },
  ) {
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
        if (Number(rec.quantity) !== 0) {
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
                previousQuantity: Number(rec.quantity),
                newQuantity: 0,
                productName: rec.product.name,
                warehouseName: rec.warehouse?.name || 'Direct Stock',
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
          `Insufficient stock in source warehouse. Available: ${Number(lockedSource?.quantity ?? 0)}, Requested: ${dto.quantity}`,
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
