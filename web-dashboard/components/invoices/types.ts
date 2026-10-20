export interface Product {
  id: string;
  name: string;
  category: string;
  hsnCode?: string;
  unit: string;
  price?: number;
  attributes?: Record<string, unknown>;
  availableQuantity?: number;
  totalStock?: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

export interface Party {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  isSaved?: boolean;
  category?: 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER';
  creditLedgers?: Array<{
    id: string;
    invoiceId?: string | null;
    amountDue: number | string;
    type: 'RECEIVABLE' | 'PAYABLE';
    status: string;
    dueDate?: string;
  }>;
}

export interface StockLedgerRecord {
  id: string;
  productId: string;
  warehouseId?: string | null;
  batchNo: string | null;
  quantity: number;
  warehouse?: Warehouse | null;
  product: Product;
}

export interface StockOptionAllocation {
  stockLedgerId: string;
  warehouseId?: string | null;
  warehouseName: string;
  warehouseCode?: string;
  batchNo: string | null;
  availableQty: number;
  takeQty: number;
}

export interface FormLineItem {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  options?: StockOptionAllocation[];
}

export interface InvoiceItemDetail {
  id: string;
  productId: string;
  warehouseId?: string | null;
  batchNo?: string | null;
  qty: number;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
  returnedQty?: number;
  remainingReturnable?: number;
  customItemName?: string | null;
  product?: {
    name: string;
    unit: string;
  };
  warehouse?: {
    name: string;
  } | null;
}

export interface RefundInvoiceItemDetail {
  id: string;
  productId?: string;
  warehouseId?: string;
  batchNo: string | null;
  qty: number;
  unitPrice: string | number;
  taxRate: string | number;
  total: string | number;
  customItemName?: string | null;
  product?: {
    name: string;
    unit: string;
  };
  warehouse?: {
    name: string;
  };
}

export interface RefundInvoiceDetail {
  id: string;
  refundNo: string;
  originalInvoiceId?: string | null;
  total: number | string;
  subtotal: number | string;
  tax: number | string;
  refundMode: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    phone?: string;
  };
  items?: RefundInvoiceItemDetail[];
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  party: Party;
  partyId?: string;
  salesman: { name: string };
  total: number | string;
  subtotal: number | string;
  tax: number | string;
  discountAmount?: number | string;
  taxRate?: number | string;
  roundOffEnabled?: boolean;
  roundOffAmount?: number | string;
  transportCost?: number | string;
  transportGstRate?: number | string;
  transportTax?: number | string;
  itemsTax?: number | string;
  address?: string;
  previousBalance?: number | string;
  isCashSale?: boolean;
  taxBreakup?: {
    rate?: number;
    isInterState?: boolean;
    cgst?: number;
    sgst?: number;
    igst?: number;
  } | null;
  paymentMode: string;
  status: string;
  createdAt: string;
  notes?: string;
  items: InvoiceItemDetail[];
  refundInvoices?: RefundInvoiceDetail[];
  deliveries?: { id: string; status: string }[];
  payments?: PaymentReceipt[];
}

export interface PaymentReceipt {
  id: string;
  mode: string;
  amount: number | string;
  status: string;
  paidAt?: string;
  upiUtr?: string;
  notes?: string;
}

export interface PaymentSplitItem {
  mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD';
  amount: string;
  upiTxnRef?: string;
  upiUtr?: string;
  notes?: string;
}

export interface PreviewUpiData {
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

export type CustomerMode = 'EXISTING' | 'NEW_SAVED' | 'UNREGISTERED';
export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
export type InvoiceStatusFilter = 'ALL' | 'PAID' | 'PARTIAL' | 'CREATED';
export type PaymentModeFilter = 'ALL' | 'UPI' | 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT';
