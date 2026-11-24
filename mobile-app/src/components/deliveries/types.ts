export interface DispatchedItem {
  id?: string;
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
  pickedUpByName?: string;
  pickedUpById?: string;
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

export interface DeliveryTrip {
  id: string;
  tripNo: number;
  vehicle?: string;
  cost: number;
  notes?: string;
}

export interface SupervisorUser {
  id: string;
  name: string;
  phone: string;
  role?: string;
  isActive?: boolean;
}

export interface DeliverySupervisorRecord {
  id?: string;
  supervisorId: string;
  supervisor: SupervisorUser;
  assignedAt?: string;
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
  supervisors?: DeliverySupervisorRecord[];
  items?: DispatchedItem[];
  trips?: DeliveryTrip[];
  invoice: {
    id: string;
    invoiceNo: string;
    status?: string;
    paymentMode?: string;
    party: {
      id: string;
      name: string;
      phone: string;
      address?: string;
    };
    items?: {
      id?: string;
      productId: string;
      qty: number;
      product?: { name: string; unit: string };
      warehouse?: { id?: string; name: string; address?: string };
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
  role?: string;
  isActive?: boolean;
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

export interface DeliveryCounts {
  total: number;
  pending: number;
  outForPickup: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
}
