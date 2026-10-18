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
  type?: 'INFLOW' | 'OUTFLOW';
  mode: string;
  amount: number;
  status: string;
  paidAt?: string;
  notes?: string;
  createdAt?: string;
  invoice?: {
    id: string;
    invoiceNo: string;
    total: number;
  };
  purchase?: {
    id: string;
    purchaseNo: string;
    vendorBillNo?: string;
    total: number;
  };
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

export interface PartyPurchase {
  id: string;
  purchaseNo: string;
  vendorBillNo?: string;
  status: string;
  total: number;
  tax?: number;
  subtotal?: number;
  paymentMode?: string;
  notes?: string;
  createdAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  createdBy?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface PartyCreditLedger {
  id: string;
  amountDue: number;
  type?: 'RECEIVABLE' | 'PAYABLE';
  dueDate?: string;
  status: string;
  remindersSent: number;
  notes?: string;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNo: string;
    total: number;
    createdAt: string;
  };
  purchase?: {
    id: string;
    purchaseNo: string;
    vendorBillNo?: string;
    total: number;
    createdAt: string;
  };
}

export interface PartyDetail {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  category?: 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER';
  createdAt: string;
  invoices?: PartyInvoice[];
  purchases?: PartyPurchase[];
  creditLedgers?: PartyCreditLedger[];
  payments?: Payment[];
}

export interface Party {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  category?: 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER';
  isSaved?: boolean;
  createdAt?: string;
  creditLedgers?: {
    id?: string;
    amountDue: number;
    type?: 'RECEIVABLE' | 'PAYABLE';
    status: string;
    dueDate?: string;
  }[];
  _count?: {
    invoices: number;
  };
}
