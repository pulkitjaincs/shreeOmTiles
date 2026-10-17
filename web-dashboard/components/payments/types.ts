export interface PendingCreditLedger {
  id: string;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  partyId: string;
  partyName?: string;
  partyPhone?: string;
  amountDue: number;
  createdAt: string;
  status: string;
  type: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  type?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string | null;
  partyId?: string | null;
  mode: string;
  type?: 'INFLOW' | 'OUTFLOW';
  amount: number | string;
  upiTxnRef?: string | null;
  upiUtr?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  invoice?: {
    id: string;
    invoiceNo: string;
    total: number | string;
    party?: { id: string; name: string; phone: string };
  } | null;
  party?: { id: string; name: string; phone: string } | null;
  confirmedBy?: { id: string; name: string } | null;
}

export interface CreditLedgerRecord {
  id: string;
  partyId: string;
  invoiceId?: string | null;
  amountDue: number | string;
  dueDate?: string | null;
  type: 'RECEIVABLE' | 'PAYABLE';
  notes?: string | null;
  status: string;
  remindersSent: number;
  createdAt: string;
  party?: { id: string; name: string; phone: string };
  invoice?: { id: string; invoiceNo: string };
}

export interface PendingItem {
  id: string;
  invoiceNo?: string;
  partyId: string;
  partyName: string;
  partyPhone: string;
  total?: number;
  paid?: number;
  remainingDue: number;
  createdAt: string;
  status: string;
  isCreditLedger?: boolean;
  creditType?: 'RECEIVABLE' | 'PAYABLE';
}

export interface FinancialStats {
  totalSales: number;
  totalCollected: number;
  totalPaidOut: number;
  cashCollected: number;
  upiCollected: number;
  bankCollected?: number;
  pendingReceivables: number;
  creditsOwed: number;
}

export interface UpiPreviewData {
  amount: number;
  vpa: string;
  upiUri: string;
  qrDataUrl: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName: string;
  isPrimary: boolean;
  createdAt: string;
}

