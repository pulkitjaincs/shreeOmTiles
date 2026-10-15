export interface DispatchedItem {
  id?: string;
  invoiceItemId?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseName?: string;
  warehouseAddress?: string;
  batchNo?: string;
  qty: number;
  pickedUp?: boolean;
  pickedUpAt?: string;
}

export interface DispatchSelectionItem {
  invoiceItemId?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseAddress?: string;
  batchNo?: string;
  maxQty: number;
  dispatchQty: number;
  selected: boolean;
}

export interface Delivery {
  id: string;
  status: string;
  notes?: string;
  amountToCollect?: number;
  cashCollected?: number;
  cashCollectedAt?: string;
  cashHandedOver?: boolean;
  cashHandedOverAt?: string;
  createdAt: string;
  driverId?: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  items?: DispatchedItem[];
  invoice: {
    id: string;
    invoiceNo: string;
    paymentMode?: string;
    party: {
      id: string;
      name: string;
      phone: string;
      address?: string;
    };
    items?: {
      id: string;
      productId: string;
      qty: number;
      product?: { name: string; unit: string };
      warehouse?: { id: string; name: string; address?: string };
      batchNo?: string;
    }[];
  };
  trip?: {
    id: string;
    vehicleNo?: string;
    status: string;
  };
}

export interface DriverUser {
  id: string;
  name: string;
  phone: string;
}
