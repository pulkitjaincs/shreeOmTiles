export interface Product {
  id: string;
  name: string;
  category: string;
  hsnCode?: string;
  unit: string;
  attributes?: Record<string, unknown>;
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string;
  type: string;
  address?: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  isSaved?: boolean;
  category?: 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER';
}

export interface StockLedger {
  id: string;
  productId: string;
  warehouseId?: string | null;
  batchNo?: string;
  quantity: number;
  warehouse?: Warehouse;
  product?: Product;
}

export interface StockOptionAllocation {
  stockLedgerId?: string;
  warehouseId?: string | null;
  warehouseName?: string;
  warehouseCode?: string;
  batchNo?: string | null;
  availableQty: number;
  qty: number;
}

export interface InvoiceLineItem {
  productId: string;
  warehouseId?: string | null;
  batchNo?: string;
  qty: number;
  allocations?: StockOptionAllocation[];
  unitPrice: number;
  discount: number;
}

export interface InvoiceItemDetail {
  id: string;
  productId: string;
  warehouseId: string;
  batchNo: string | null;
  qty: number;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
  returnedQty?: number;
  remainingReturnable?: number;
  product?: {
    id?: string;
    name: string;
    category?: string;
    unit: string;
  };
  warehouse?: {
    id?: string;
    name: string;
    code?: string;
    type?: string;
  };
}

export interface RefundInvoiceItemDetail {
  id: string;
  productId: string;
  warehouseId: string;
  batchNo: string | null;
  qty: number;
  unitPrice: string | number;
  taxRate?: string | number;
  total: string | number;
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
  originalInvoiceId?: string;
  total: number | string;
  subtotal?: number | string;
  tax?: number | string;
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

export interface InvoiceTaxBreakup {
  rate?: number;
  isInterState?: boolean;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  createdAt: string;
  total: number | string;
  subtotal?: number | string;
  tax?: number | string;
  taxAmount?: number | string;
  taxRate?: number;
  taxBreakup?: InvoiceTaxBreakup | null;
  status: string;
  paymentMode?: string | null;
  paidAmount?: number | string;
  paid?: number | string;
  party?: Party | null;
  salesman?: { id?: string; name: string; phone?: string } | null;
  notes?: string;
  items?: InvoiceItemDetail[];
  refundInvoices?: RefundInvoiceDetail[];
  payments?: any[];
  [key: string]: any;
}

export type InvoiceListEntry = Invoice;

export interface UpiModalData {
  invoiceId: string;
  invoiceNo: string;
  partyName?: string;
  partyPhone?: string;
  total: number;
  qrDataUrl?: string;
  vpa?: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName?: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface PreviewUpiData {
  amount: number;
  vpa: string;
  upiUri?: string;
  qrDataUrl: string;
}

export type CustomerMode = 'EXISTING' | 'NEW_SAVED' | 'UNREGISTERED';
export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
export type InvoiceStatusFilter = 'ALL' | 'PAID' | 'PARTIAL' | 'CREATED' | 'REFUNDED';
export type PaymentModeFilter = 'ALL' | 'UPI' | 'CASH' | 'CREDIT' | 'CHEQUE';
