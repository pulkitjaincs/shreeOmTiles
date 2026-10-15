'use client';

import { Building2, Check } from 'lucide-react';
import { Delivery } from './types';

interface DeliveryItemsCellProps {
  delivery: Delivery;
  isOutForPickup: boolean;
}

export function DeliveryItemsCell({ delivery, isOutForPickup }: DeliveryItemsCellProps) {
  const activeItems =
    delivery.items && delivery.items.length > 0
      ? delivery.items
      : delivery.invoice.items.map((it) => ({
          productId: it.productId,
          productName: it.product?.name || 'Item',
          unit: it.product?.unit || 'unit',
          warehouseName: it.warehouse?.name || 'Warehouse',
          warehouseAddress: it.warehouse?.address || '',
          batchNo: it.batchNo,
          qty: it.qty,
          pickedUp: false,
        }));

  const pickedCount = activeItems.filter((i) => i.pickedUp).length;
  const totalCount = activeItems.length;

  return (
    <div className="space-y-1.5">
      {/* Pickup progress bar if in pickup stage */}
      {isOutForPickup && (
        <div className="mb-2 p-1.5 rounded-[0.5rem] bg-purple-500/10 border border-purple-500/20 text-[0.6875rem] text-purple-700 dark:text-purple-300 flex items-center justify-between">
          <span className="font-semibold">Warehouse Pickup:</span>
          <span className="font-bold">
            {pickedCount} of {totalCount} collected
          </span>
        </div>
      )}

      {activeItems.slice(0, 3).map((it, idx) => (
        <div
          key={idx}
          className={`p-2 rounded-[0.5rem] border text-[0.75rem] transition-colors ${
            it.pickedUp
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-muted/40 border-border/60 text-muted-foreground'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{it.productName}</span>
            {it.pickedUp ? (
              <span className="text-[0.625rem] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Picked Up
              </span>
            ) : (
              <span className="text-[0.625rem] text-amber-600 dark:text-amber-400 font-medium">Pending Pickup</span>
            )}
          </div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
            {it.qty} {it.unit}
            {it.batchNo ? ` [Lot: ${it.batchNo}]` : ''}
          </div>
          <div className="text-[0.6875rem] text-primary/90 flex items-center gap-1 mt-0.5">
            <Building2 className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate">{it.warehouseName || 'Warehouse'}</span>
          </div>
        </div>
      ))}
      {activeItems.length > 3 && (
        <div className="text-[0.6875rem] text-muted-foreground pt-0.5">
          + {activeItems.length - 3} more product(s)
        </div>
      )}
    </div>
  );
}
