export type DatePreset = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';

export interface PendingDriverDelivery {
  id: string;
  deliveryId?: string;
  invoiceNo: string;
  partyName: string;
  driverName: string;
  amount?: number;
  amountToCollect?: number;
  cashCollectedAt?: string;
}

export interface TrendPoint {
  date: string;
  label: string;
  invoiced: number;
  collected: number;
  credit: number;
}

export interface SalesmanPerformance {
  id: string;
  salesmanId?: string;
  name?: string;
  salesmanName?: string;
  phone?: string;
  role?: string;
  invoiceCount?: number;
  invoicesCount?: number;
  totalSales: number;
  avgOrderValue?: number;
  averageTicket?: number;
}

export interface ReceivablesHealth {
  unpaid?: { count: number; total: number };
  partial?: { count: number; total: number };
  overdue?: { count: number; total: number };
  topPending?: Array<{
    partyId: string;
    partyName: string;
    phone: string;
    amountDue: number;
    dueDate: string | null;
    invoiceNo: string | null;
    status: string;
  }>;
}

export interface TransactionItem {
  id: string;
  invoiceId?: string | null;
  invoiceNo?: string;
  partyName: string;
  mode: string;
  type?: 'INFLOW' | 'OUTFLOW';
  amount: number;
  status: string;
  paidAt: string;
  driverName?: string | null;
  confirmedByName?: string;
}

export interface SalesmanRecentInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  partyPhone?: string;
  total: number;
  status: string;
  paymentMode: string;
  createdAt: string;
}

export interface DashboardKPI {
  totalRevenue: number;
  deltaRevenue?: number | null;
  periodInvoices: number;
  deltaInvoices?: number | null;
  todayInvoices: number;
  totalInvoices?: number;
  totalCollected: number;
  totalCollectedCount: number;
  cashToBeCollectedFromDrivers: number;
  pendingDriverDeliveriesCount: number;
  receivablesTotal: number;
  receivablesCount: number;
  payablesTotal: number;
  payablesCount: number;
  pendingUpi?: number;
  productCount?: number;
  partyCount?: number;
}

export interface DashboardData {
  role?: string;
  filter?: {
    preset: string;
    from: string | null;
    to: string | null;
  };
  kpi?: DashboardKPI;
  pendingDriverDeliveries?: PendingDriverDelivery[];
  revenueTrend?: TrendPoint[];
  paymentSplit?: Array<{ name: string; value: number; count: number }>;
  categorySplit?: Array<{ name: string; value: number }>;
  salesmenPerformance?: SalesmanPerformance[];
  receivablesHealth?: ReceivablesHealth;
  recentTransactions?: TransactionItem[];
  salesmanRecentInvoices?: SalesmanRecentInvoice[];
}
