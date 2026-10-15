export interface InvoiceItem {
  id: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  batchNo?: string;
  product?: {
    name: string;
    category?: string;
    unit?: string;
  };
}

export interface Payment {
  id: string;
  mode: string;
  amount: number;
  status: string;
  paidAt?: string;
}

export interface Delivery {
  id: string;
  status: string;
}

export interface PartyInvoice {
  id: string;
  invoiceNo: string;
  status: string;
  total: number;
  paymentMode?: string;
  createdAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  deliveries?: Delivery[];
  salesman?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface PartyCreditLedger {
  id: string;
  amountDue: number;
  dueDate?: string;
  status: string;
  remindersSent: number;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNo: string;
    total: number;
    createdAt: string;
  };
}

export interface PartyDetail {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  createdAt: string;
  invoices?: PartyInvoice[];
  creditLedgers?: PartyCreditLedger[];
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  createdAt?: string;
  creditLedgers?: {
    id?: string;
    amountDue: number;
    status: string;
    dueDate?: string;
  }[];
  _count?: {
    invoices: number;
  };
}
