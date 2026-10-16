import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';

@Injectable()
export class ExpensesService {
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

  async create(data: CreateExpenseDto, userId: string) {
    const fy = this.getFinancialYear();
    const count = await this.prisma.expense.count();
    const expenseNo = `EXP-${fy}-${String(count + 1).padStart(4, '0')}`;

    const expDate = data.expenseDate ? new Date(data.expenseDate) : new Date();

    return this.prisma.expense.create({
      data: {
        expenseNo,
        category: data.category,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        paymentMode: data.paymentMode || 'CASH',
        paidTo: data.paidTo || null,
        notes: data.notes || null,
        expenseDate: expDate,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, phone: true } },
      },
    });
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
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
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
      take: 100,
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
}
