import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMode,
  PaymentStatus,
  CreditType,
  CreditStatus,
  PaymentType,
  Role,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';

interface DriverCashDeliveryItem {
  id: string;
  cashCollected: Prisma.Decimal | number | null;
  cashCollectedAt: Date | null;
  driver?: { id: string; name: string; phone: string } | null;
  invoice?: { invoiceNo: string; party?: { name: string } | null } | null;
}

interface SalesStaffItem {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

interface RecentPaymentItem {
  id: string;
  invoiceId: string | null;
  mode: PaymentMode;
  type?: string;
  amount: Prisma.Decimal | number;
  status: PaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  invoice?: {
    invoiceNo: string;
    party?: { name: string } | null;
    deliveries?: Array<{
      cashHandedOver: boolean;
      driver?: { id: string; name: string } | null;
    }>;
  } | null;
  party?: { name: string } | null;
  confirmedBy?: { id: string; name: string } | null;
}

interface ReceivableLedgerItem {
  partyId: string;
  party: { id: string; name: string; phone: string };
  amountDue: Prisma.Decimal | number;
  dueDate: Date | null;
  invoice?: { invoiceNo: string } | null;
  status: CreditStatus;
}

interface SalesmanRecentInvoiceItem {
  id: string;
  invoiceNo: string;
  party: { name: string; phone: string };
  total: Prisma.Decimal | number;
  status: InvoiceStatus;
  paymentMode: PaymentMode | null;
  createdAt: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      revenueAgg,
      todayInvoices,
      totalInvoices,
      upiAgg,
      creditAgg,
      driverCashDeliveries,
      confirmedPaymentsAgg,
      productCount,
      partyCount,
    ] = await Promise.all([
      // 1. Total Revenue
      this.prisma.invoice.aggregate({
        _sum: { total: true },
      }),
      // Today Invoices
      this.prisma.invoice.count({
        where: { createdAt: { gte: today } },
      }),
      // Total Invoices
      this.prisma.invoice.count(),
      // 2. Pending UPI
      this.prisma.payment.aggregate({
        where: { mode: PaymentMode.UPI, status: PaymentStatus.PENDING },
        _sum: { amount: true },
      }),
      // 3. Outstanding Credit
      this.prisma.creditLedger.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amountDue: true },
      }),
      // 4. Cash to be collected from drivers (driver collected from customer, not yet handed over to owner)
      this.prisma.delivery.findMany({
        where: {
          cashHandedOver: false,
          cashCollected: { gt: 0 },
        },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          invoice: {
            select: { invoiceNo: true, party: { select: { name: true } } },
          },
        },
      }),
      // 5. Total Actual Transactions (Confirmed Payments)
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CONFIRMED },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // 6. Total Products & Total Parties
      this.prisma.product.count(),
      this.prisma.party.count(),
    ]);

    const totalRevenue = Number(revenueAgg._sum.total || 0);
    const pendingUpi = Number(upiAgg._sum.amount || 0);
    const outstandingCredit = Number(creditAgg._sum.amountDue || 0);
    const cashToBeCollectedFromDrivers = driverCashDeliveries.reduce(
      (sum, d) => sum + Number(d.cashCollected || 0),
      0,
    );
    const actualTransactionsTotal = Number(
      confirmedPaymentsAgg._sum.amount || 0,
    );
    const actualTransactionsCount = confirmedPaymentsAgg._count.id;

    return {
      totalRevenue,
      todayInvoices,
      totalInvoices,
      pendingUpi,
      outstandingCredit,
      cashToBeCollectedFromDrivers,
      pendingDriverDeliveries: driverCashDeliveries.map((d) => ({
        id: d.id,
        invoiceNo: d.invoice.invoiceNo,
        partyName: d.invoice.party.name,
        driverName: d.driver?.name || 'Driver',
        amount: Number(d.cashCollected || 0),
        cashCollectedAt: d.cashCollectedAt,
      })),
      actualTransactionsTotal,
      actualTransactionsCount,
      productCount,
      partyCount,
    };
  }

  async getRecentTransactions(limit = 15) {
    const payments = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.CONFIRMED },
      orderBy: { paidAt: 'desc' },
      take: limit,
      include: {
        invoice: {
          include: {
            party: true,
            deliveries: {
              where: { cashHandedOver: true },
              include: {
                driver: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
        confirmedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return payments.map((p) => {
      const deliveryWithDriver = p.invoice?.deliveries?.find(
        (d) => d.cashHandedOver,
      );
      return {
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNo: p.invoice?.invoiceNo || 'N/A',
        partyName: p.invoice?.party?.name || 'Customer',
        mode: p.mode,
        amount: Number(p.amount),
        status: p.status,
        paidAt: p.paidAt || p.createdAt,
        driverName: deliveryWithDriver?.driver?.name || null,
        confirmedByName: p.confirmedBy?.name || 'Owner / Cashier',
      };
    });
  }

  async getCategorySplit() {
    return this.prisma.$queryRaw<Array<{ name: string; value: number }>>`
      SELECT 
        COALESCE(p.category, 'Other') AS name, 
        ROUND(COALESCE(SUM(ii.total), 0))::int AS value
      FROM "InvoiceItem" ii
      LEFT JOIN "Product" p ON ii."productId" = p.id
      GROUP BY COALESCE(p.category, 'Other')
      ORDER BY value DESC
    `;
  }

  async getPaymentSplit() {
    const invoices = await this.prisma.invoice.groupBy({
      by: ['paymentMode'],
      _sum: { total: true },
      _count: { id: true },
    });

    return invoices.map((inv) => ({
      name: inv.paymentMode || 'OTHER',
      value: Math.round(Number(inv._sum.total || 0)),
      count: inv._count.id,
    }));
  }

  async getSalesmanPerformance() {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.SALESMAN, Role.ADMIN, Role.OWNER] },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
    });

    const salesByStaff = await this.prisma.$queryRaw<
      Array<{ salesmanId: string; count: number; total: number }>
    >`
      SELECT 
        "salesmanId", 
        COUNT(id)::int AS count, 
        ROUND(COALESCE(SUM(total), 0))::int AS total
      FROM "Invoice"
      GROUP BY "salesmanId"
    `;

    const map = new Map<string, { count: number; total: number }>();
    for (const s of salesByStaff) {
      map.set(s.salesmanId, { count: s.count, total: s.total });
    }

    return staff
      .map((u) => {
        const stats = map.get(u.id) || { count: 0, total: 0 };
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          invoiceCount: stats.count,
          totalSales: stats.total,
        };
      })
      .filter((u) => u.invoiceCount > 0 || u.role === Role.SALESMAN)
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  async getDashboard(
    query: { from?: string; to?: string; preset?: string },
    user?: { id: string; role: Role },
  ) {
    const isSalesman = user?.role === Role.SALESMAN;
    const salesmanId = user?.id;
    const salesmanScope = isSalesman && salesmanId ? { salesmanId } : undefined;

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const preset = query.preset || (query.from ? 'custom' : 'all');

    if (preset === 'today') {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
    } else if (preset === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (preset === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (preset === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = now;
    } else if (query.from && query.to) {
      startDate = new Date(query.from);
      endDate = new Date(query.to);
      endDate.setHours(23, 59, 59, 999);
    }

    const dateFilter =
      startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    // Previous period for delta calculation if date range is bounded
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;
    if (startDate && endDate) {
      const spanMs = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - spanMs);
    }
    const prevDateFilter =
      prevStartDate && prevEndDate
        ? { gte: prevStartDate, lte: prevEndDate }
        : undefined;

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    // Trend bounds: for 'all' or long spans, default to last 14 days
    const trendDays =
      preset === 'today' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : 14;
    const trendStart =
      startDate || new Date(now.getTime() - trendDays * 24 * 60 * 60 * 1000);
    const trendEnd = endDate || now;

    // Dynamic SQL conditions for PostgreSQL query plan optimization (avoids $1 IS NULL index invalidation)
    const salesmanSalesConditions: Prisma.Sql[] = [];
    if (startDate) {
      salesmanSalesConditions.push(Prisma.sql`"createdAt" >= ${startDate}`);
    }
    if (endDate) {
      salesmanSalesConditions.push(Prisma.sql`"createdAt" <= ${endDate}`);
    }
    const salesmanSalesWhere =
      salesmanSalesConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(salesmanSalesConditions, ' AND ')}`
        : Prisma.empty;

    const categorySplitConditions: Prisma.Sql[] = [];
    if (startDate) {
      categorySplitConditions.push(Prisma.sql`inv."createdAt" >= ${startDate}`);
    }
    if (endDate) {
      categorySplitConditions.push(Prisma.sql`inv."createdAt" <= ${endDate}`);
    }
    if (salesmanScope?.salesmanId) {
      categorySplitConditions.push(
        Prisma.sql`inv."salesmanId" = ${salesmanScope.salesmanId}`,
      );
    }
    const categorySplitWhere =
      categorySplitConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(categorySplitConditions, ' AND ')}`
        : Prisma.empty;

    const trendInvoicesConditions: Prisma.Sql[] = [
      Prisma.sql`"createdAt" >= ${trendStart}`,
      Prisma.sql`"createdAt" <= ${trendEnd}`,
    ];
    if (salesmanScope?.salesmanId) {
      trendInvoicesConditions.push(
        Prisma.sql`"salesmanId" = ${salesmanScope.salesmanId}`,
      );
    }
    const trendInvoicesWhere = Prisma.sql`WHERE ${Prisma.join(trendInvoicesConditions, ' AND ')}`;

    const [
      revenueAgg,
      prevRevenueAgg,
      periodInvoicesCount,
      prevInvoicesCount,
      todayInvoicesCount,
      totalInvoicesCount,
      confirmedInflowsAgg,
      receivablesAgg,
      receivablesCount,
      payablesAgg,
      payablesCount,
      pendingUpiAgg,
      driverCashDeliveries,
      productCount,
      partyCount,
      salesmanSalesRaw,
      allSalesStaff,
      paymentSplitAgg,
      categorySplitRaw,
      recentPayments,
      topReceivablesLedgers,
      creditStatusRaw,
      trendInvoicesRaw,
      trendPaymentsRaw,
      trendCreditsRaw,
      salesmanRecentInvoices,
    ] = await Promise.all([
      // Current Period Invoiced Revenue
      this.prisma.invoice.aggregate({
        where: {
          ...(salesmanScope || {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        _sum: { total: true },
      }),
      // Previous Period Revenue (for delta)
      prevDateFilter
        ? this.prisma.invoice.aggregate({
            where: {
              ...(salesmanScope || {}),
              createdAt: prevDateFilter,
            },
            _sum: { total: true },
          })
        : Promise.resolve({ _sum: { total: null } }),
      // Current Period Invoices Count
      this.prisma.invoice.count({
        where: {
          ...(salesmanScope || {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      // Previous Period Invoices Count
      prevDateFilter
        ? this.prisma.invoice.count({
            where: {
              ...(salesmanScope || {}),
              createdAt: prevDateFilter,
            },
          })
        : Promise.resolve(0),
      // Invoices Created Today
      this.prisma.invoice.count({
        where: {
          ...(salesmanScope || {}),
          createdAt: { gte: todayStart },
        },
      }),
      // All-Time Invoices Count
      this.prisma.invoice.count({
        where: salesmanScope,
      }),
      // Confirmed Inflow Collections
      isSalesman
        ? Promise.resolve({ _sum: { amount: null }, _count: { id: 0 } })
        : this.prisma.payment.aggregate({
            where: {
              status: PaymentStatus.CONFIRMED,
              type: PaymentType.INFLOW,
              ...(dateFilter ? { paidAt: dateFilter } : {}),
            },
            _sum: { amount: true },
            _count: { id: true },
          }),
      // Customer Receivables (Dues to Store) - only for Owner/Admin
      isSalesman
        ? Promise.resolve({ _sum: { amountDue: null } })
        : this.prisma.creditLedger.aggregate({
            where: {
              type: CreditType.RECEIVABLE,
              status: {
                in: [
                  CreditStatus.UNPAID,
                  CreditStatus.PARTIAL,
                  CreditStatus.OVERDUE,
                ],
              },
            },
            _sum: { amountDue: true },
          }),
      isSalesman
        ? Promise.resolve(0)
        : this.prisma.creditLedger.count({
            where: {
              type: CreditType.RECEIVABLE,
              status: {
                in: [
                  CreditStatus.UNPAID,
                  CreditStatus.PARTIAL,
                  CreditStatus.OVERDUE,
                ],
              },
            },
          }),
      // Store Payables (Dues we owe to Parties) - only for Owner/Admin
      isSalesman
        ? Promise.resolve({ _sum: { amountDue: null } })
        : this.prisma.creditLedger.aggregate({
            where: {
              type: CreditType.PAYABLE,
              status: {
                in: [
                  CreditStatus.UNPAID,
                  CreditStatus.PARTIAL,
                  CreditStatus.OVERDUE,
                ],
              },
            },
            _sum: { amountDue: true },
          }),
      isSalesman
        ? Promise.resolve(0)
        : this.prisma.creditLedger.count({
            where: {
              type: CreditType.PAYABLE,
              status: {
                in: [
                  CreditStatus.UNPAID,
                  CreditStatus.PARTIAL,
                  CreditStatus.OVERDUE,
                ],
              },
            },
          }),
      // Pending UPI payments
      isSalesman
        ? Promise.resolve({ _sum: { amount: null } })
        : this.prisma.payment.aggregate({
            where: { mode: PaymentMode.UPI, status: PaymentStatus.PENDING },
            _sum: { amount: true },
          }),
      // Real-time Cash with drivers - only for Owner/Admin
      isSalesman
        ? Promise.resolve<DriverCashDeliveryItem[]>([])
        : this.prisma.delivery.findMany({
            where: {
              cashHandedOver: false,
              cashCollected: { gt: 0 },
            },
            include: {
              driver: { select: { id: true, name: true, phone: true } },
              invoice: {
                select: { invoiceNo: true, party: { select: { name: true } } },
              },
            },
          }),
      // Product & Party directory count
      this.prisma.product.count(),
      this.prisma.party.count(),
      // Salesman breakdown via SQL GROUP BY (Zero in-memory array allocation)
      isSalesman
        ? Promise.resolve<
            Array<{ salesmanId: string; count: number; total: number }>
          >([])
        : this.prisma.$queryRaw<
            Array<{ salesmanId: string; count: number; total: number }>
          >`
            SELECT "salesmanId", COUNT(id)::int AS count, ROUND(COALESCE(SUM(total), 0))::int AS total
            FROM "Invoice"
            ${salesmanSalesWhere}
            GROUP BY "salesmanId"
          `,
      // All sales staff (Salesman, Admin, Owner)
      isSalesman
        ? Promise.resolve<SalesStaffItem[]>([])
        : this.prisma.user.findMany({
            where: {
              role: { in: [Role.SALESMAN, Role.ADMIN, Role.OWNER] },
              isActive: true,
            },
            select: { id: true, name: true, phone: true, role: true },
            orderBy: { name: 'asc' },
          }),
      // Payment mode split
      this.prisma.invoice.groupBy({
        by: ['paymentMode'],
        where: {
          ...(salesmanScope || {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Category split via SQL GROUP BY (Zero full table scan)
      this.prisma.$queryRaw<Array<{ name: string; value: number }>>`
        SELECT 
          COALESCE(p.category, 'General') AS name, 
          ROUND(COALESCE(SUM(ii.total), 0))::int AS value
        FROM "InvoiceItem" ii
        LEFT JOIN "Product" p ON ii."productId" = p.id
        JOIN "Invoice" inv ON ii."invoiceId" = inv.id
        ${categorySplitWhere}
        GROUP BY COALESCE(p.category, 'General')
        ORDER BY value DESC
      `,
      // Recent confirmed payments - only for Owner/Admin
      isSalesman
        ? Promise.resolve<RecentPaymentItem[]>([])
        : this.prisma.payment.findMany({
            where: { status: PaymentStatus.CONFIRMED },
            orderBy: { paidAt: 'desc' },
            take: 12,
            include: {
              invoice: {
                include: {
                  party: true,
                  deliveries: {
                    where: { cashHandedOver: true },
                    include: { driver: { select: { id: true, name: true } } },
                  },
                },
              },
              party: true,
              confirmedBy: { select: { id: true, name: true } },
            },
          }),
      // Top pending receivables - only for Owner/Admin
      isSalesman
        ? Promise.resolve<ReceivableLedgerItem[]>([])
        : this.prisma.creditLedger.findMany({
            where: {
              type: CreditType.RECEIVABLE,
              status: {
                in: [
                  CreditStatus.UNPAID,
                  CreditStatus.PARTIAL,
                  CreditStatus.OVERDUE,
                ],
              },
            },
            orderBy: { amountDue: 'desc' },
            take: 6,
            include: {
              party: { select: { id: true, name: true, phone: true } },
              invoice: { select: { invoiceNo: true } },
            },
          }),
      // Credit status breakdown combined into 1 SQL GROUP BY query (Replaces 3 individual queries)
      isSalesman
        ? Promise.resolve<
            Array<{ status: string; count: number; total: number }>
          >([])
        : this.prisma.$queryRaw<
            Array<{ status: string; count: number; total: number }>
          >`
            SELECT status, COUNT(id)::int AS count, ROUND(COALESCE(SUM("amountDue"), 0))::int AS total
            FROM "CreditLedger"
            WHERE type = 'RECEIVABLE' AND status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
            GROUP BY status
          `,
      // Trend: Invoices in trend window aggregated by day (Zero in-memory array loops)
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>`
        SELECT 
          TO_CHAR("createdAt", 'YYYY-MM-DD') AS day,
          ROUND(COALESCE(SUM(total), 0))::int AS total
        FROM "Invoice"
        ${trendInvoicesWhere}
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      `,
      // Trend: Confirmed Inflow Payments in trend window aggregated by day
      isSalesman
        ? Promise.resolve<Array<{ day: string; amount: number }>>([])
        : this.prisma.$queryRaw<Array<{ day: string; amount: number }>>`
            SELECT 
              TO_CHAR("paidAt", 'YYYY-MM-DD') AS day,
              ROUND(COALESCE(SUM(amount), 0))::int AS amount
            FROM "Payment"
            WHERE status = 'CONFIRMED' AND type = 'INFLOW'
              AND "paidAt" >= ${trendStart} AND "paidAt" <= ${trendEnd}
            GROUP BY TO_CHAR("paidAt", 'YYYY-MM-DD')
          `,
      // Trend: Credits given in trend window aggregated by day
      isSalesman
        ? Promise.resolve<Array<{ day: string; amountDue: number }>>([])
        : this.prisma.$queryRaw<Array<{ day: string; amountDue: number }>>`
            SELECT 
              TO_CHAR("createdAt", 'YYYY-MM-DD') AS day,
              ROUND(COALESCE(SUM("amountDue"), 0))::int AS "amountDue"
            FROM "CreditLedger"
            WHERE type = 'RECEIVABLE'
              AND "createdAt" >= ${trendStart} AND "createdAt" <= ${trendEnd}
            GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
          `,
      // Salesman's recent invoices
      isSalesman && salesmanId
        ? (this.prisma.invoice.findMany({
            where: { salesmanId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { party: { select: { name: true, phone: true } } },
          }) as unknown as Promise<SalesmanRecentInvoiceItem[]>)
        : Promise.resolve<SalesmanRecentInvoiceItem[]>([]),
    ]);

    // Format driver cash
    const cashToBeCollectedFromDrivers = driverCashDeliveries.reduce(
      (sum: number, d) => sum + Number(d.cashCollected || 0),
      0,
    );

    // Salesmen sales computation using direct SQL aggregated counts & totals
    const salesmanSalesMap = new Map<
      string,
      { count: number; total: number }
    >();
    for (const stat of salesmanSalesRaw) {
      salesmanSalesMap.set(stat.salesmanId, {
        count: stat.count,
        total: stat.total,
      });
    }

    const salesmenPerformance = allSalesStaff
      .map((u) => {
        const stats = salesmanSalesMap.get(u.id) || { count: 0, total: 0 };
        return {
          id: u.id,
          name: u.name,
          phone: u.phone,
          role: u.role,
          invoiceCount: stats.count,
          totalSales: Math.round(stats.total),
          avgOrderValue:
            stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
        };
      })
      .filter((u) => u.invoiceCount > 0 || u.role === Role.SALESMAN);

    // Calculate deltas
    const currentRevenue = Number(revenueAgg._sum.total || 0);
    const prevRevenue = Number(prevRevenueAgg._sum.total || 0);
    let deltaRevenue: number | null = null;
    if (prevDateFilter && prevRevenue > 0) {
      deltaRevenue = Math.round(
        ((currentRevenue - prevRevenue) / prevRevenue) * 100,
      );
    }

    let deltaInvoices: number | null = null;
    if (prevDateFilter && prevInvoicesCount > 0) {
      deltaInvoices = Math.round(
        ((periodInvoicesCount - prevInvoicesCount) / prevInvoicesCount) * 100,
      );
    }

    // Category breakdown directly from SQL query
    const categorySplit = categorySplitRaw;

    // Payment split
    const paymentSplit = paymentSplitAgg.map((inv) => ({
      name: inv.paymentMode || 'OTHER',
      value: Math.round(Number(inv._sum.total || 0)),
      count: inv._count.id,
    }));

    // Credit status breakdown map from consolidated query
    const creditStatusMap = new Map<string, { count: number; total: number }>();
    for (const c of creditStatusRaw) {
      creditStatusMap.set(c.status, { count: c.count, total: c.total });
    }

    // Revenue Trend daily buckets (populated via direct O(1) key lookups)
    const bucketMap = new Map<
      string,
      {
        date: string;
        label: string;
        invoiced: number;
        collected: number;
        credit: number;
      }
    >();
    const curCursor = new Date(trendStart);
    curCursor.setHours(0, 0, 0, 0);
    const endCursor = new Date(trendEnd);
    endCursor.setHours(23, 59, 59, 999);

    while (curCursor <= endCursor) {
      const key = curCursor.toISOString().slice(0, 10);
      const label = curCursor.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      bucketMap.set(key, {
        date: key,
        label,
        invoiced: 0,
        collected: 0,
        credit: 0,
      });
      curCursor.setDate(curCursor.getDate() + 1);
    }

    for (const inv of trendInvoicesRaw) {
      const bucket = bucketMap.get(inv.day);
      if (bucket) {
        bucket.invoiced = inv.total;
      }
    }

    for (const p of trendPaymentsRaw) {
      const bucket = bucketMap.get(p.day);
      if (bucket) {
        bucket.collected = p.amount;
      }
    }

    for (const c of trendCreditsRaw) {
      const bucket = bucketMap.get(c.day);
      if (bucket) {
        bucket.credit = c.amountDue;
      }
    }

    const revenueTrend = Array.from(bucketMap.values());

    return {
      role: user?.role || Role.OWNER,
      filter: {
        preset,
        from: startDate?.toISOString() || null,
        to: endDate?.toISOString() || null,
      },
      kpi: {
        totalRevenue: currentRevenue,
        deltaRevenue,
        periodInvoices: periodInvoicesCount,
        deltaInvoices,
        todayInvoices: todayInvoicesCount,
        totalInvoices: totalInvoicesCount,
        totalCollected: Number(confirmedInflowsAgg._sum?.amount || 0),
        totalCollectedCount: confirmedInflowsAgg._count?.id || 0,
        cashToBeCollectedFromDrivers,
        pendingDriverDeliveriesCount: driverCashDeliveries.length,
        receivablesTotal: Number(receivablesAgg._sum?.amountDue || 0),
        receivablesCount,
        payablesTotal: Number(payablesAgg._sum?.amountDue || 0),
        payablesCount,
        pendingUpi: Number(pendingUpiAgg._sum?.amount || 0),
        productCount,
        partyCount,
      },
      pendingDriverDeliveries: driverCashDeliveries.map((d) => ({
        id: d.id,
        invoiceNo: d.invoice?.invoiceNo || 'N/A',
        partyName: d.invoice?.party?.name || 'Customer',
        driverName: d.driver?.name || 'Driver',
        amount: Number(d.cashCollected || 0),
        cashCollectedAt: d.cashCollectedAt,
      })),
      revenueTrend,
      paymentSplit,
      categorySplit,
      salesmenPerformance,
      receivablesHealth: {
        unpaid: creditStatusMap.get('UNPAID') || { count: 0, total: 0 },
        partial: creditStatusMap.get('PARTIAL') || { count: 0, total: 0 },
        overdue: creditStatusMap.get('OVERDUE') || { count: 0, total: 0 },
        topPending: topReceivablesLedgers.map((l) => ({
          partyId: l.partyId,
          partyName: l.party.name,
          phone: l.party.phone,
          amountDue: Number(l.amountDue),
          dueDate: l.dueDate,
          invoiceNo: l.invoice?.invoiceNo || null,
          status: l.status,
        })),
      },
      recentTransactions: recentPayments.map((p) => {
        const deliveryWithDriver = p.invoice?.deliveries?.find(
          (d) => d.cashHandedOver,
        );
        return {
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNo: p.invoice?.invoiceNo || 'Direct',
          partyName:
            p.invoice?.party?.name || p.party?.name || 'Party / Vendor',
          mode: p.mode,
          type: p.type,
          amount: Number(p.amount),
          status: p.status,
          paidAt: p.paidAt || p.createdAt,
          driverName: deliveryWithDriver?.driver?.name || null,
          confirmedByName: p.confirmedBy?.name || 'Owner / Cashier',
        };
      }),
      salesmanRecentInvoices: salesmanRecentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        partyName: inv.party.name,
        partyPhone: inv.party.phone,
        total: Number(inv.total),
        status: inv.status,
        paymentMode: inv.paymentMode,
        createdAt: inv.createdAt,
      })),
    };
  }
}
