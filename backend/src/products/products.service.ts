import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductDto, actorId?: string) {
    const finalAttributes = {
      ...(data.attributes || {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          category: data.category,
          name: data.name,
          attributes: finalAttributes,
          hsnCode: data.hsnCode,
          unit: data.unit || 'box',
        },
      });

      if (
        data.initialWarehouseId &&
        data.initialQuantity &&
        data.initialQuantity > 0
      ) {
        const batchNo = data.initialBatchNo?.trim() || null;
        const stockLedger = await tx.stockLedger.create({
          data: {
            productId: product.id,
            warehouseId: data.initialWarehouseId,
            batchNo,
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
              warehouseId: data.initialWarehouseId,
              quantity: data.initialQuantity,
              batchNo,
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
  }

  async findAll(query?: {
    category?: string;
    search?: string;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<any> {
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

    const includeRelations = {
      stockLedgers: {
        include: { warehouse: true },
      },
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
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.prisma.product.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        stockLedgers: {
          include: { warehouse: true },
        },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
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

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        attributes: updatedAttrs as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
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
        product.stockLedgers?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;
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
  }
}
