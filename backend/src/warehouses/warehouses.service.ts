import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { Role } from '@prisma/client';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateWarehouseDto) {
    const res = await this.prisma.warehouse.create({ data });
    this.cacheService.invalidatePrefix('warehouses:');
    return res;
  }

  async findAll(user?: { id: string; role: Role }) {
    const cacheKey = `warehouses:${user?.role || 'ALL'}`;
    // Warehouses cache: 3 hours (10800 seconds)
    return this.cacheService.wrap(cacheKey, 10800, async () => {
      const list = await this.prisma.warehouse.findMany({
        include: {
          stockLedgers: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (user?.role === Role.SUPERVISOR) {
        return list.map((wh) => this.sanitizeWarehouseForSupervisor(wh));
      }
      return list;
    });
  }

  async findOne(id: string, user?: { id: string; role: Role }) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockLedgers: {
          include: { product: true },
        },
      },
    });
    if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);

    if (user?.role === Role.SUPERVISOR) {
      return this.sanitizeWarehouseForSupervisor(warehouse);
    }
    return warehouse;
  }

  private sanitizeWarehouseForSupervisor<T extends Record<string, unknown>>(
    wh: T,
  ): T {
    if (!wh) return wh;
    const rawStock = Array.isArray(wh.stockLedgers)
      ? (wh.stockLedgers as Array<Record<string, unknown>>)
      : [];

    const stockLedgers = rawStock.map((sl) => {
      const rawProd =
        sl.product && typeof sl.product === 'object'
          ? (sl.product as Record<string, unknown>)
          : null;

      let cleanAttrs = rawProd?.attributes;
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
        ...sl,
        product: rawProd ? { ...rawProd, attributes: cleanAttrs } : null,
      };
    });

    return {
      ...wh,
      stockLedgers,
    };
  }

  async update(id: string, data: UpdateWarehouseDto) {
    await this.findOne(id);
    const res = await this.prisma.warehouse.update({ where: { id }, data });
    this.cacheService.invalidatePrefix('warehouses:');
    return res;
  }

  async remove(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id },
        include: { stockLedgers: true },
      });
      if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);

      const activeStock =
        warehouse.stockLedgers?.reduce(
          (sum, s) => sum + Number(s.quantity),
          0,
        ) ?? 0;
      if (activeStock > 0) {
        throw new BadRequestException(
          `Cannot delete warehouse '${warehouse.name}' because it contains ${activeStock} units of inventory. The warehouse must be empty before deleting.`,
        );
      }

      // Disassociate warehouse from historical invoice items and refund items
      await tx.invoiceItem.updateMany({
        where: { warehouseId: id },
        data: { warehouseId: null },
      });
      await tx.refundInvoiceItem.updateMany({
        where: { warehouseId: id },
        data: { warehouseId: null },
      });
      await tx.stockLedger.deleteMany({ where: { warehouseId: id } });
      return tx.warehouse.delete({ where: { id } });
    });
    this.cacheService.invalidatePrefix('warehouses:');
    return result;
  }
}
