export interface Warehouse {
  id: string;
  name: string;
  type: 'WAREHOUSE' | 'SHOWROOM';
  address?: string;
  stockCount?: number;
}
