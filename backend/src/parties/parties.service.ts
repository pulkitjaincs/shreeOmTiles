import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePartyDto) {
    return this.prisma.party.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
      },
    });
  }

  async findAll(
    search?: string,
    includeUnsaved: boolean = false,
    pagination?: PaginationParams,
  ): Promise<any> {
    const where: Prisma.PartyWhereInput = {};
    if (!includeUnsaved) {
      where.isSaved = true;
    }
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { gstin: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const includeRelations = {
      creditLedgers: true,
      _count: {
        select: { invoices: true },
      },
    };

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.party.findMany({
          where,
          include: includeRelations,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.party.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.prisma.party.findMany({
      where,
      include: includeRelations,
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
            deliveries: true,
            salesman: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        creditLedgers: {
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                total: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    return party;
  }

  async update(id: string, data: UpdatePartyDto) {
    await this.findOne(id);
    return this.prisma.party.update({ where: { id }, data });
  }

  async remove(id: string) {
    // 1. Fetch party with credit ledgers and invoices to check dues
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        creditLedgers: true,
        invoices: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!party) throw new NotFoundException(`Party ${id} not found`);

    // 2. Check pending dues:
    // Dues customer owes the shop (RECEIVABLE)
    const receivableDue = (party.creditLedgers || [])
      .filter((cl) => cl.type === 'RECEIVABLE' && cl.status !== 'SETTLED')
      .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

    // Dues shop owes the customer (PAYABLE - e.g. refunds or credit notes)
    const payableDue = (party.creditLedgers || [])
      .filter((cl) => cl.type === 'PAYABLE' && cl.status !== 'SETTLED')
      .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

    // Unpaid invoices that don't already have a credit ledger
    let unpaidInvoiceDue = 0;
    for (const inv of party.invoices || []) {
      if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') {
        const hasCreditLedger = (party.creditLedgers || []).some(
          (cl) => cl.invoiceId === inv.id && cl.status !== 'SETTLED',
        );
        if (!hasCreditLedger) {
          const total = Number(inv.total || 0);
          const confirmedPaid = (inv.payments || [])
            .filter((p) => p.status === 'CONFIRMED')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const diff = total - confirmedPaid;
          if (diff > 0) {
            unpaidInvoiceDue += diff;
          }
        }
      }
    }

    const totalCustomerDebt = receivableDue + unpaidInvoiceDue;
    if (totalCustomerDebt > 0.01) {
      throw new BadRequestException(
        `Cannot delete customer '${party.name}': Customer has outstanding dues of ₹${totalCustomerDebt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pending payment. Please collect payment first.`,
      );
    }
    if (payableDue > 0.01) {
      throw new BadRequestException(
        `Cannot delete customer '${party.name}': Shop owes ₹${payableDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} in store credit/refunds to this customer. Please settle or refund first.`,
      );
    }

    // 3. Zero dues confirmed.
    // If historical invoices exist, soft-delete (isSaved: false) to protect past tax records and foreign keys.
    if (party.invoices && party.invoices.length > 0) {
      await this.prisma.party.update({
        where: { id },
        data: { isSaved: false },
      });
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }

    // If no historical invoices exist, attempt hard-delete; fall back to soft delete if relations exist
    try {
      await this.prisma.party.delete({ where: { id } });
      return {
        success: true,
        message: `Customer '${party.name}' permanently deleted.`,
      };
    } catch {
      await this.prisma.party.update({
        where: { id },
        data: { isSaved: false },
      });
      return {
        success: true,
        message: `Customer '${party.name}' removed from directory.`,
      };
    }
  }
}
