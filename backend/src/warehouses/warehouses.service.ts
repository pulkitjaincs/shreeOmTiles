import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data });
  }

  async findAll() {
    return this.prisma.warehouse.findMany({
      include: {
        stockLedgers: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockLedgers: {
          include: { product: true },
        },
      },
    });
    if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);
    return warehouse;
  }

  async update(id: string, data: UpdateWarehouseDto) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id },
        include: { stockLedgers: true },
      });
      if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);

      const activeStock =
        warehouse.stockLedgers?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;
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
  }
}
