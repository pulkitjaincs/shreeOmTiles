'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, RotateCcw } from 'lucide-react';
import { StockItem } from './types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  stock: StockItem | null;
}

export function StockAdjustModal({
  isOpen,
  onClose,
  onSuccess,
  stock,
}: StockAdjustModalProps) {
  const [newQuantity, setNewQuantity] = useState<number>(stock?.quantity || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && stock) {
      setNewQuantity(stock.quantity);
      setError('');
    }
  }, [isOpen, stock]);

  if (!isOpen || !stock) return null;

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: stock.productId,
          warehouseId: stock.warehouseId,
          batchNo: stock.batchNo,
          quantity: Number(newQuantity),
          mode: 'SET',
        }),
      });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-base font-bold text-foreground">Audit Physical Count</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/40 p-3.5 rounded-xl border border-border/60">
            <p>
              <span className="text-muted-foreground font-medium">Product:</span>{' '}
              <span className="text-foreground font-semibold">{stock.product?.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground font-medium">Warehouse:</span>{' '}
              <span className="text-foreground">{stock.warehouse?.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground font-medium">Batch:</span>{' '}
              <span className="font-mono text-foreground">{stock.batchNo || 'Default'}</span>
            </p>
            <p>
              <span className="text-muted-foreground font-medium">Current Qty:</span>{' '}
              <span className="font-mono font-bold text-foreground">
                {stock.quantity} {stock.product?.unit}
              </span>
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Verified Physical Quantity
              </label>
              <button
                type="button"
                onClick={() => setNewQuantity(0)}
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Set to 0
              </button>
            </div>
            <input
              type="number"
              required
              min="0"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive">
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
              {submitting ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
