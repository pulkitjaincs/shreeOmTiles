export interface Warehouse {
  id: string;
  name: string;
  address: string;
  type: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  hsnCode?: string;
  attributes?: Record<string, unknown>;
}

export interface StockItem {
  id: string;
  productId: string;
  product: { name: string; category: string; unit: string };
  warehouseId: string;
  warehouse: { name: string };
  batchNo?: string;
  quantity: number;
  updatedAt: string;
}
