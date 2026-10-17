export interface PartyCreditLedger {
  id?: string;
  amountDue: number | string;
  type?: 'RECEIVABLE' | 'PAYABLE';
  status: string;
  dueDate?: string | null;
  createdAt?: string;
  invoice?: {
    id?: string;
    invoiceNo?: string;
    total?: number;
    createdAt?: string;
  };
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  category?: 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER';
  isSaved?: boolean;
  createdAt?: string;
  creditLedgers?: PartyCreditLedger[];
  _count?: {
    invoices: number;
  };
}

export interface StatementInvoiceItem {
  id: string;
  qty?: number;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  total?: number;
  product?: {
    name: string;
    category?: string;
    unit?: string;
  };
}

export interface StatementPayment {
  id: string;
  mode?: string;
  amount: number;
  status: string;
  paidAt?: string;
}

export interface StatementInvoice {
  id: string;
  invoiceNo: string;
  total: number;
  status: string;
  paymentMode?: string;
  createdAt: string;
  items?: StatementInvoiceItem[];
  payments?: StatementPayment[];
  salesman?: {
    id?: string;
    name: string;
    phone?: string;
  };
}

export interface StatementCreditLedger {
  id: string;
  amountDue: number | string;
  status: string;
  type?: 'RECEIVABLE' | 'PAYABLE';
  dueDate?: string | null;
  remindersSent?: number;
  createdAt?: string;
  invoice?: {
    id?: string;
    invoiceNo?: string;
    total?: number;
    createdAt?: string;
  };
}

export interface PartyStatementData {
  party: Party;
  invoices: StatementInvoice[];
  creditLedgers: StatementCreditLedger[];
}

export interface CreditAgeingBuckets {
  totalReceivables: number;
  b0to15: number;
  b15to30: number;
  b30to60: number;
  b60plus: number;
}
