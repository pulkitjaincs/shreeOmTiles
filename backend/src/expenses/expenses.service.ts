import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';
import { CacheService } from '../common/cache.service';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateExpenseCaches(): void {
    this.cacheService.invalidatePrefix('expenses:');
    this.cacheService.invalidatePrefix('analytics:');
    this.cacheService.invalidatePrefix('payments:');
  }

  private getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const sStr = String(startYear).slice(-2);
    const eStr = String(endYear).slice(-2);
    return `${sStr}${eStr}`;
  }

  async create(data: CreateExpenseDto, userId: string) {
    const expDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    const fy = this.getFinancialYear(expDate);

    const result = await this.prisma.$transaction(async (tx) => {
      if (data.splits && data.splits.length > 0) {
        const splits = data.splits.filter((s) => Number(s.amount) > 0);
        if (splits.length > 1) {
          const totalAmt = splits.reduce((sum, s) => sum + Number(s.amount), 0);
          const createdList: Array<
            Prisma.ExpenseGetPayload<{
              include: {
                createdBy: { select: { id: true; name: true; phone: true } };
              };
            }>
          > = [];
          for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            const seq = await tx.expenseSequence.upsert({
              where: { financialYear: fy },
              update: { lastNumber: { increment: 1 } },
              create: { financialYear: fy, lastNumber: 1 },
            });
            const expenseNo = `EXP-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;
            const splitNote = [
              `[Split ${i + 1}/${splits.length}]`,
              data.title ? `${data.title} - ` : '',
              data.notes || '',
              `(Total ₹${totalAmt.toFixed(2)})`,
            ]
              .join(' ')
              .trim();

            const exp = await tx.expense.create({
              data: {
                expenseNo,
                category: data.category,
                amount: new Prisma.Decimal(Number(split.amount).toFixed(2)),
                paymentMode: split.mode,
                paidTo: data.paidTo || null,
                notes: splitNote,
                expenseDate: expDate,
                createdById: userId,
              },
              include: {
                createdBy: { select: { id: true, name: true, phone: true } },
              },
            });
            createdList.push(exp);
          }
          return createdList;
        } else if (splits.length === 1) {
          data.amount = splits[0].amount;
          data.paymentMode = splits[0].mode;
        }
      }

      const seq = await tx.expenseSequence.upsert({
        where: { financialYear: fy },
        update: { lastNumber: { increment: 1 } },
        create: { financialYear: fy, lastNumber: 1 },
      });
      const expenseNo = `EXP-${fy}-${String(seq.lastNumber).padStart(4, '0')}`;
      const finalAmount = data.amount || 0;

      return tx.expense.create({
        data: {
          expenseNo,
          category: data.category,
          amount: new Prisma.Decimal(finalAmount.toFixed(2)),
          paymentMode: data.paymentMode || 'CASH',
          paidTo: data.paidTo || null,
          notes: data.notes
            ? data.title
              ? `${data.title} - ${data.notes}`
              : data.notes
            : data.title || null,
          expenseDate: expDate,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true, phone: true } },
        },
      });
    });
    this.invalidateExpenseCaches();
    return result;
  }

  async findAll(
    pagination?: PaginationParams,
    filters?: {
      category?: ExpenseCategory;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    const cacheKey = `expenses:list:${filters?.category || 'all'}:${filters?.startDate || ''}:${filters?.endDate || ''}:${filters?.search || ''}:${pagination?.page || 1}:${pagination?.limit || 'all'}`;
    return this.cacheService.wrap(cacheKey, 1800, async () => {
      const where: Prisma.ExpenseWhereInput = {};

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.startDate || filters?.endDate) {
        where.expenseDate = {};
        if (filters.startDate) {
          where.expenseDate.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.expenseDate.lte = new Date(filters.endDate);
        }
      }

      if (filters?.search) {
        where.OR = [
          { expenseNo: { contains: filters.search, mode: 'insensitive' } },
          { paidTo: { contains: filters.search, mode: 'insensitive' } },
          { notes: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const includeRelations = {
        createdBy: { select: { id: true, name: true, phone: true } },
      };

      if (pagination?.page !== undefined || pagination?.limit !== undefined) {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(Math.max(1, pagination?.limit || 40), 500);
        const skip = (page - 1) * limit;

        const [data, total, totalAmountAgg] = await Promise.all([
          this.prisma.expense.findMany({
            where,
            include: includeRelations,
            orderBy: { expenseDate: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.expense.count({ where }),
          this.prisma.expense.aggregate({
            where,
            _sum: { amount: true },
          }),
        ]);

        return {
          data,
          total,
          totalAmount: Number(totalAmountAgg._sum.amount || 0),
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      return this.prisma.expense.findMany({
        where,
        include: includeRelations,
        orderBy: { expenseDate: 'desc' },
        ...(!filters?.startDate && !filters?.endDate && !filters?.search
          ? { take: 2000 }
          : {}),
      });
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async update(id: string, data: UpdateExpenseDto, userId: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Expense with ID ${id} not found`);
    const amount = Number(data.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }
    const expDate = data.expenseDate
      ? new Date(data.expenseDate)
      : existing.expenseDate;
    const title = data.title?.trim();
    const notes = data.notes?.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          category: data.category,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          paymentMode: data.paymentMode || existing.paymentMode,
          paidTo: data.paidTo?.trim() || null,
          notes: title
            ? notes
              ? `${title} - ${notes}`
              : title
            : notes || null,
          expenseDate: expDate,
        },
        include: {
          createdBy: { select: { id: true, name: true, phone: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'EDIT_EXPENSE',
          entity: 'Expense',
          entityId: id,
          diff: { oldAmount: Number(existing.amount), newAmount: amount },
        },
      });
      return updated;
    });
    this.invalidateExpenseCaches();
    return updated;
  }

  async delete(id: string, userId: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Expense with ID ${id} not found`);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_EXPENSE',
          entity: 'Expense',
          entityId: id,
          diff: {
            notes: existing.notes,
            amount: Number(existing.amount),
            category: existing.category,
          },
        },
      });
      return { success: true, message: `Expense deleted successfully` };
    });
    this.invalidateExpenseCaches();
    return result;
  }
}
