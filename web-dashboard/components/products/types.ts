export interface Warehouse {
  id: string;
  name: string;
  type: string;
}

export interface StockLedgerEntry {
  warehouse: { name: string };
  batchNo?: string;
  quantity: number;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  hsnCode?: string;
  unit: string;
  attributes: Record<string, unknown>;
  stockLedgers?: StockLedgerEntry[];
}
