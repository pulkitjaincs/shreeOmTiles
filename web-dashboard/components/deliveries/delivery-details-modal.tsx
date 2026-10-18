'use client';

import React from 'react';
import { 
  X, 
  Truck, 
  MapPin, 
  Phone, 
  Boxes, 
  CheckCircle, 
  FileText, 
  User, 
  CircleDollarSign, 
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { Delivery } from './types';
import { formatINR, formatDate } from '@/lib/formatters';

interface DeliveryDetailsModalProps {
  delivery: Delivery | null;
  onClose: () => void;
  onDownloadChallan?: (id: string, invoiceNo?: string) => void;
  onEdit?: (delivery: Delivery) => void;
  canEdit?: boolean;
}

export function DeliveryDetailsModal({
  delivery,
  onClose,
  onDownloadChallan,
  onEdit,
  canEdit = false,
}: DeliveryDetailsModalProps) {
  if (!delivery) return null;

  const inv = delivery.invoice;
  const party = inv?.party;
  const items = delivery.items || [];
  const pickedCount = items.filter((it) => it.pickedUp).length;
  const totalItems = items.length;

  const isDelivered = delivery.status === 'DELIVERED';
  const isCustomerPickup =
    (delivery.status === 'DELIVERED' && !delivery.driverId) ||
    Boolean(delivery.notes && /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(delivery.notes));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-5 my-8 max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Delivery Details
                <span className="font-mono text-sm text-primary">#{inv?.invoiceNo}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Created on {formatDate(delivery.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Top Status & Party Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Information */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Receiver & Destination
              </span>
              <p className="text-sm font-bold text-foreground">{party?.name || 'Customer'}</p>
              {party?.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{party.phone}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>{party?.address || 'Counter Pickup'}</span>
              </p>
            </div>

            {/* Logistics Status & Mode */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Dispatch Status
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                    isDelivered
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      : delivery.status === 'ASSIGNED'
                      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                      : delivery.status === 'OUT_FOR_PICKUP'
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                      : delivery.status === 'OUT_FOR_DELIVERY'
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {isCustomerPickup ? 'Customer Picked Up' : delivery.status.replace(/_/g, ' ')}
                </span>
                {delivery.vehicle && (
                  <span className="text-xs text-muted-foreground font-medium">
                    Vehicle: {delivery.vehicle}
                  </span>
                )}
              </div>

              {delivery.driver ? (
                <div className="text-xs text-foreground font-medium flex items-center gap-1.5 pt-1">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>Driver: {delivery.driver.name} ({delivery.driver.phone})</span>
                </div>
              ) : isCustomerPickup ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Counter / Customer Self-Pickup</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic pt-1">
                  No driver assigned
                </div>
              )}

              {Number(delivery.amountToCollect || 0) > 0 && (
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  <span>Collect: {formatINR(delivery.amountToCollect)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supervisors Section if any */}
          {delivery.supervisors && delivery.supervisors.length > 0 && (
            <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Assigned Warehouse Supervisors
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {delivery.supervisors.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-card border border-border/60 text-foreground"
                  >
                    {s.supervisor?.name || 'Supervisor'} ({s.supervisor?.phone})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dispatch Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-primary" />
                Dispatched Items ({pickedCount}/{totalItems} Picked)
              </h3>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                No items recorded for this delivery run.
              </p>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                {items.map((it, idx) => (
                  <div
                    key={it.invoiceItemId || idx}
                    className="p-3 bg-card/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>{it.productName || 'Product Item'}</span>
                        {it.batchNo && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                            Lot: {it.batchNo}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Warehouse: {it.warehouseName || 'Showroom'}
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div className="font-bold text-foreground">
                        {it.qty} {it.unit || 'units'}
                      </div>
                      {it.pickedUp ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Picked {it.pickedUpByName ? `(${it.pickedUpByName})` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                          Pending Pick
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery Notes */}
          {delivery.notes && (
            <div className="p-3 rounded-xl border border-border/60 bg-muted/15 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Delivery Notes
              </span>
              <p className="text-xs text-foreground/90 whitespace-pre-line">{delivery.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/60 pt-3 shrink-0">
          {canEdit && onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit(delivery);
              }}
              className="text-xs font-semibold text-primary hover:text-primary/90 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Delivery
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {onDownloadChallan && (
              <button
                onClick={() => onDownloadChallan(delivery.id, inv?.invoiceNo)}
                className="text-xs font-semibold text-foreground px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Challan PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs font-semibold text-foreground px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
