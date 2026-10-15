'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PackagePlus, X, CheckCircle2 } from 'lucide-react';
import { Warehouse, Product, StockItem } from './types';

interface InwardStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  warehouses: Warehouse[];
  products: Product[];
  stocks: StockItem[];
  initialWarehouseId?: string;
  initialProductId?: string;
  initialBatchNo?: string;
}

export function InwardStockModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses,
  products,
  stocks,
  initialWarehouseId = '',
  initialProductId = '',
  initialBatchNo = '',
}: InwardStockModalProps) {
  const [inwardWarehouseId, setInwardWarehouseId] = useState(
    initialWarehouseId || warehouses[0]?.id || '',
  );
  const [inwardProductId, setInwardProductId] = useState(
    initialProductId || products[0]?.id || '',
  );
  const [inwardBatchNo, setInwardBatchNo] = useState(
    initialBatchNo ||
      `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [inwardQty, setInwardQty] = useState<number>(50);
  const [inwardMode, setInwardMode] = useState<'ADD' | 'SET'>('ADD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInwardWarehouseId(initialWarehouseId || warehouses[0]?.id || '');
      setInwardProductId(initialProductId || products[0]?.id || '');
      setInwardBatchNo(
        initialBatchNo ||
          `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      );
      setInwardQty(50);
      setInwardMode('ADD');
      setError('');
    }
  }, [isOpen, initialWarehouseId, initialProductId, initialBatchNo, warehouses, products]);

  if (!isOpen) return null;

  const selectedInwardProduct = products.find((p) => p.id === inwardProductId);
  const currentMatchingStock = stocks.find(
    (s) =>
      s.productId === inwardProductId &&
      s.warehouseId === inwardWarehouseId &&
      (inwardBatchNo ? s.batchNo === inwardBatchNo.trim() : !s.batchNo),
  );
  const currentInwardQty = currentMatchingStock?.quantity || 0;
  const projectedInwardQty =
    inwardMode === 'ADD' ? currentInwardQty + (inwardQty || 0) : inwardQty || 0;

  const handleInwardStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inwardWarehouseId || !inwardProductId) {
      setError('Please select both warehouse and product');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: inwardProductId,
          warehouseId: inwardWarehouseId,
          batchNo: inwardBatchNo.trim() || undefined,
          quantity: Number(inwardQty),
          mode: inwardMode,
        }),
      });

      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to inward stock');
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
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Inward Stock to Warehouse</h2>
              <p className="text-xs text-muted-foreground">
                Add new tile designs or incoming shipments into a specific warehouse.
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

        <form onSubmit={handleInwardStock} className="space-y-4 overflow-y-auto pr-1">
          {/* Destination Warehouse */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Destination Warehouse / Showroom *
            </label>
            <select
              required
              value={inwardWarehouseId}
              onChange={(e) => setInwardWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-card text-foreground">
                  {w.name} ({w.type}) — {w.address}
                </option>
              ))}
            </select>
          </div>

          {/* Product / Design Selection */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Select Product / Tile Design *
            </label>
            <select
              required
              value={inwardProductId}
              onChange={(e) => setInwardProductId(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            >
              {products.map((p) => {
                const sizeStr = (p.attributes as Record<string, string>)?.size;
                const finishStr = (p.attributes as Record<string, string>)?.finish;
                const spec = [sizeStr, finishStr].filter(Boolean).join(' • ');
                return (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name} [{p.category}] {spec ? `(${spec})` : ''} - Unit: {p.unit}
                  </option>
                );
              })}
            </select>
            <div className="flex justify-between items-center mt-1 text-[11px] text-muted-foreground">
              <span>Need a new design not listed here?</span>
              <Link
                href="/dashboard/products"
                className="text-primary hover:text-primary/80 underline font-medium"
              >
                + Add New Design in Products
              </Link>
            </div>
          </div>

          {/* Batch / Lot No & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Batch / Lot No
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-2024-05"
                className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={inwardBatchNo}
                onChange={(e) => setInwardBatchNo(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Helps track color shades & manufacturer lots.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Quantity ({selectedInwardProduct?.unit || 'units'}) *
              </label>
              <input
                type="number"
                min="1"
                required
                className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={inwardQty}
                onChange={(e) => setInwardQty(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Mode Selection: Add (Inward) vs Override (Set) */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Inward Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInwardMode('ADD')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition ${
                  inwardMode === 'ADD'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div>
                  <div className="font-semibold text-foreground">Add to Stock</div>
                  <div className="text-[10px] text-muted-foreground">Incoming shipment</div>
                </div>
                {inwardMode === 'ADD' && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setInwardMode('SET')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition ${
                  inwardMode === 'SET'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div>
                  <div className="font-semibold text-foreground">Override Count</div>
                  <div className="text-[10px] text-muted-foreground">Set exact total</div>
                </div>
                {inwardMode === 'SET' && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Real-Time Preview Card */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Current stock in warehouse:</span>
              <span className="font-mono text-foreground font-medium">
                {currentInwardQty} {selectedInwardProduct?.unit || 'units'}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Operation:</span>
              <span className="font-medium text-foreground">
                {inwardMode === 'ADD'
                  ? `+ ${inwardQty || 0} incoming`
                  : `Directly set to ${inwardQty || 0}`}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 flex justify-between font-semibold">
              <span className="text-foreground">New Available Stock:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm">
                {projectedInwardQty} {selectedInwardProduct?.unit || 'units'}
              </span>
            </div>
          </div>

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
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20"
            >
              {submitting ? 'Adding...' : 'Confirm Inward Stock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
