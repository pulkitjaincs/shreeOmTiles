export interface DriverUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive?: boolean;
}

export interface DeliveryTrip {
  id: string;
  tripNo: number;
  vehicle?: string;
  cost: number;
  notes?: string;
}

export interface DispatchedItem {
  invoiceItemId?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseAddress?: string;
  batchNo?: string;
  qty: number;
  pickedUp?: boolean;
  pickedUpAt?: string;
}

export interface SupervisorUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive?: boolean;
}

export interface DeliverySupervisorRecord {
  id?: string;
  deliveryId?: string;
  supervisorId: string;
  supervisor?: SupervisorUser;
}

export interface Delivery {
  id: string;
  status: string;
  notes?: string;
  driverId?: string;
  createdAt: string;
  amountToCollect?: number;
  cashCollected?: number;
  cashCollectedAt?: string;
  cashHandedOver?: boolean;
  cashHandedOverAt?: string;
  items?: DispatchedItem[];
  supervisors?: DeliverySupervisorRecord[];
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  trips: DeliveryTrip[];
  invoice: {
    id: string;
    invoiceNo: string;
    createdAt?: string;
    party: {
      name: string;
      phone: string;
      address?: string;
    };
    items: {
      id?: string;
      productId: string;
      product: { name: string; unit: string };
      warehouse?: { name: string; address?: string } | null;
      warehouseId?: string;
      batchNo?: string;
      qty: number;
    }[];
  };
}

export interface DispatchSelectionItem extends DispatchedItem {
  maxQty: number;
  dispatchQty: number;
  selected: boolean;
}

export interface PushSuccessDialogData {
  invoiceNo: string;
  driverName: string;
  driverPhone: string;
  itemsCount: number;
  amountToCollect: number;
  transportCost: number;
  hasRemaining: boolean;
  waUrl: string;
}

export type FilterTab =
  | 'ALL'
  | 'PENDING'
  | 'OUT_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';
