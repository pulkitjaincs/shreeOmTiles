import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateProductDto, actorId?: string) {
    const finalAttributes = {
      ...(data.attributes || {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          category: data.category,
          name: data.name,
          attributes: finalAttributes,
          hsnCode: data.hsnCode,
          unit: data.unit || 'box',
          minStockAlert:
            data.minStockAlert !== undefined ? data.minStockAlert : 10,
        },
      });

      if (data.initialQuantity && data.initialQuantity > 0) {
        const stockLedger = await tx.stockLedger.create({
          data: {
            productId: product.id,
            warehouseId: null,
            batchNo: null,
            quantity: data.initialQuantity,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'INITIAL_STOCK_INWARD',
            entity: 'StockLedger',
            entityId: stockLedger.id,
            diff: {
              productId: product.id,
              productName: product.name,
              quantity: data.initialQuantity,
            },
          },
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          stockLedgers: {
            include: { warehouse: true },
          },
        },
      });
    });
    this.cacheService.invalidatePrefix('products:');
    return result;
  }

  async findAll(
    query?: {
      category?: string;
      search?: string;
      includeInactive?: boolean;
      page?: number;
      limit?: number;
    },
    user?: { id: string; role: Role },
  ): Promise<any> {
    const cacheKey = `products:${user?.role || 'ALL'}:${JSON.stringify(query || {})}`;
    // Products cache: 3 hours (10800 seconds)
    return this.cacheService.wrap(cacheKey, 10800, async () => {
      const where: Prisma.ProductWhereInput = {};
      if (!query?.includeInactive) {
        where.isActive = true;
      }
      if (query?.category) {
        where.category = query.category;
      }
      if (query?.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { category: { contains: query.search, mode: 'insensitive' } },
          { hsnCode: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      // Optimization: prune dead warehouse join; only select necessary columns
      const includeRelations = {
        stockLedgers: {
          select: { id: true, quantity: true, batchNo: true },
        },
      };

      const isSupervisor = user?.role === Role.SUPERVISOR;

      type ProductWithStock = Prisma.ProductGetPayload<{
        include: {
          stockLedgers: { select: { id: true; quantity: true; batchNo: true } };
        };
      }>;

      const formatProduct = (p: ProductWithStock) => {
        const stockLedgers = p.stockLedgers || [];
        const totalStock = stockLedgers.reduce(
          (sum: number, s) => sum + Number(s.quantity || 0),
          0,
        );
        const sanitized = isSupervisor
          ? this.sanitizeProductForSupervisor(p)
          : p;
        return {
          ...sanitized,
          availableQuantity: Number(totalStock.toFixed(2)),
          totalStock: Number(totalStock.toFixed(2)),
          stockLedgers: stockLedgers.map((s) => ({
            id: s.id,
            quantity: Number(s.quantity || 0),
            batchNo: s.batchNo || null,
            warehouseId: null,
            warehouse: null,
          })),
        };
      };

      if (query?.page !== undefined || query?.limit !== undefined) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(Math.max(1, query.limit || 25), 100);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
          this.prisma.product.findMany({
            where,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.product.count({ where }),
        ]);

        return {
          data: data.map((p) => formatProduct(p)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      const products = await this.prisma.product.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
      });

      return products.map((p) => formatProduct(p));
    });
  }

  private sanitizeProductForSupervisor<T extends Record<string, unknown>>(
    prod: T,
  ): T {
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
  }

  async findOne(id: string, user?: { id: string; role: Role }) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        stockLedgers: {
          include: { warehouse: true },
        },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    const isSupervisor = user?.role === Role.SUPERVISOR;
    const stockLedgers = product.stockLedgers || [];
    const totalStock = stockLedgers.reduce(
      (sum, s) => sum + Number(s.quantity || 0),
      0,
    );
    const sanitized = isSupervisor
      ? this.sanitizeProductForSupervisor(product)
      : product;

    return {
      ...sanitized,
      availableQuantity: Number(totalStock.toFixed(2)),
      totalStock: Number(totalStock.toFixed(2)),
      stockLedgers: stockLedgers.map((s) => ({
        id: s.id,
        quantity: Number(s.quantity || 0),
        batchNo: s.batchNo || null,
        warehouseId: null,
        warehouse: null,
      })),
    };
  }

  async update(id: string, data: UpdateProductDto) {
    const existing = await this.findOne(id);
    const existingAttrs = (existing.attributes as Record<string, any>) || {};

    let updatedAttrs = existingAttrs;
    if (data.attributes !== undefined || data.price !== undefined) {
      updatedAttrs = {
        ...existingAttrs,
        ...(data.attributes || {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
      };
    }

    const rest = { ...data };
    delete rest.price;
    delete rest.initialWarehouseId;
    delete rest.initialQuantity;
    delete rest.initialBatchNo;
    delete rest.attributes;

    const res = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        attributes: updatedAttrs as Prisma.InputJsonValue,
      },
    });
    this.cacheService.invalidatePrefix('products:');
    return res;
  }

  async remove(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        include: {
          stockLedgers: true,
          invoiceItems: true,
          refundInvoiceItems: true,
        },
      });
      if (!product) throw new NotFoundException(`Product ${id} not found`);

      const activeStock =
        product.stockLedgers?.reduce((sum, s) => sum + Number(s.quantity), 0) ??
        0;
      if (activeStock > 0) {
        throw new BadRequestException(
          `Cannot delete product '${product.name}' because it still has ${activeStock} ${product.unit} of inventory across warehouses. Stock quantity must be 0 before deleting.`,
        );
      }

      const hasPastInvoices =
        (product.invoiceItems?.length ?? 0) > 0 ||
        (product.refundInvoiceItems?.length ?? 0) > 0;

      if (hasPastInvoices) {
        // Soft delete: deactivate product to preserve historical GST Section 31 tax records and foreign keys
        return tx.product.update({
          where: { id },
          data: { isActive: false },
        });
      }

      // If never invoiced, safely remove empty stock ledgers and delete product
      await tx.stockLedger.deleteMany({ where: { productId: id } });
      return tx.product.delete({ where: { id } });
    });
    this.cacheService.invalidatePrefix('products:');
    return result;
  }
}
