export interface StockLedgerEntry {
  warehouse?: { name: string };
  batchNo?: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  hsnCode?: string;
  price?: number;
  attributes?: Record<string, unknown>;
  stockLedgers?: StockLedgerEntry[];
}

export interface Warehouse {
  id: string;
  name: string;
  type: string;
  address?: string;
}

export interface StockItem {
  id: string;
  productId: string;
  warehouseId: string;
  batchNo?: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
  warehouse: {
    id: string;
    name: string;
    type: string;
  };
}
