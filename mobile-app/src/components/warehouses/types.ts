export interface Warehouse {
  id: string;
  name: string;
  type: 'WAREHOUSE' | 'SHOWROOM';
  address?: string;
  stockCount?: number;
  totalUnits?: number;
  skuCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseStockItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  batchNo?: string;
  quantity: number;
}
