'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemedSelect } from '@/components/ui/themed-select';
import { ArrowLeftRight, X } from 'lucide-react';
import { Warehouse, StockItem } from './types';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  warehouses: Warehouse[];
  stocks: StockItem[];
  initialStockItem?: StockItem | null;
}

export function StockTransferModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses,
  stocks,
  initialStockItem,
}: StockTransferModalProps) {
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferStockId, setTransferStockId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (initialStockItem) {
        setFromWarehouseId(initialStockItem.warehouseId || '');
        setTransferStockId(initialStockItem.id);
        const otherWh = warehouses.find((w) => w.id !== initialStockItem.warehouseId);
        setToWarehouseId(otherWh ? otherWh.id : '');
        setTransferQty(Math.min(initialStockItem.quantity, 10) || 1);
      } else {
        const firstWh = warehouses[0]?.id || '';
        setFromWarehouseId(firstWh);
        const firstWhStocks = stocks.filter(
          (s) => s.warehouseId === firstWh && s.quantity > 0,
        );
        setTransferStockId(firstWhStocks[0]?.id || '');
        const otherWh = warehouses.find((w) => w.id !== firstWh);
        setToWarehouseId(otherWh ? otherWh.id : '');
        setTransferQty(1);
      }
    }
  }, [isOpen, initialStockItem, warehouses, stocks]);

  if (!isOpen) return null;

  const availableSourceStocks = stocks.filter(
    (s) => s.warehouseId === fromWarehouseId && s.quantity > 0,
  );
  const selectedTransferStock = stocks.find((s) => s.id === transferStockId);

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromWarehouseId || !toWarehouseId) {
      setError('Please select both source and destination warehouses');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination warehouses cannot be the same');
      return;
    }

    const currentStock = stocks.find((s) => s.id === transferStockId);
    if (!currentStock) {
      setError('Selected stock record not found');
      return;
    }

    if (transferQty > currentStock.quantity) {
      setError(
        `Cannot transfer ${transferQty}. Available quantity in source is ${currentStock.quantity}.`,
      );
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/stock/transfer', {
        method: 'POST',
        body: JSON.stringify({
          productId: currentStock.productId,
          fromWarehouseId,
          toWarehouseId,
          batchNo: currentStock.batchNo || undefined,
          quantity: Number(transferQty),
        }),
      });

      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to transfer stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Transfer Stock Between Warehouses
              </h2>
              <p className="text-xs text-muted-foreground">
                Move stock from Godown A to Showroom or between any two locations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleTransferStock} className="space-y-4 overflow-y-auto pr-1">
          {/* Source & Destination Warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Source Warehouse (From) *
              </label>
              <ThemedSelect
                value={fromWarehouseId}
                onChange={(newFrom) => {
                  setFromWarehouseId(newFrom);
                  const firstAvail = stocks.filter(
                    (s) => s.warehouseId === newFrom && s.quantity > 0,
                  )[0];
                  setTransferStockId(firstAvail?.id || '');
                }}
                searchable
                searchPlaceholder="Search source godown..."
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: w.name,
                  subLabel: w.address,
                  badge: w.type,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Destination Warehouse (To) *
              </label>
              <ThemedSelect
                value={toWarehouseId}
                onChange={(val) => setToWarehouseId(val)}
                searchable
                searchPlaceholder="Search destination godown..."
                options={warehouses
                  .filter((w) => w.id !== fromWarehouseId)
                  .map((w) => ({
                    value: w.id,
                    label: w.name,
                    subLabel: w.address,
                    badge: w.type,
                  }))}
              />
            </div>
          </div>

          {/* Product Stock Selection */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Select Product & Batch to Transfer *
            </label>
            {availableSourceStocks.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs">
                No active stock in selected source warehouse. Please select another
                source or inward stock first.
              </div>
            ) : (
              <ThemedSelect
                value={transferStockId}
                onChange={(val) => setTransferStockId(val)}
                searchable
                searchPlaceholder="Search product or batch..."
                options={availableSourceStocks.map((s) => ({
                  value: s.id,
                  label: s.product?.name || 'Product',
                  subLabel: `Batch: ${s.batchNo || 'Default'} • Available: ${s.quantity} ${s.product?.unit || 'units'}`,
                  badge: s.product?.category,
                }))}
              />
            )}
          </div>

          {/* Quantity */}
          {selectedTransferStock && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transfer Quantity ({selectedTransferStock.product?.unit}) *
                </label>
                <span className="text-xs text-primary font-mono font-medium">
                  Max available: {selectedTransferStock.quantity}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={selectedTransferStock.quantity}
                required
                className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-muted/60 hover:bg-muted text-foreground border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || availableSourceStocks.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20"
            >
              {submitting ? 'Transferring...' : 'Execute Transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
