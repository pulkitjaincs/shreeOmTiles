export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
}

export interface StockLedger {
  id: string;
  productId: string;
  warehouseId: string;
  batchNo?: string;
  quantity: number;
}

export interface InvoiceLineItem {
  productId: string;
  warehouseId: string;
  batchNo?: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface UpiModalData {
  invoiceId: string;
  invoiceNo: string;
  partyName?: string;
  partyPhone?: string;
  total: number;
  qrDataUrl?: string;
  vpa?: string;
}
