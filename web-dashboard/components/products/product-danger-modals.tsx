'use client';

import React, { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, X, Loader2 } from 'lucide-react';
import { Product } from './types';

interface DeleteProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function DeleteProductModal({
  product,
  isOpen,
  onClose,
  onSuccess,
}: DeleteProductModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!isOpen || !product) return null;

  const confirmDeleteProduct = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await apiRequest(`/products/${product.id}`, {
        method: 'DELETE',
      });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[1.25rem] border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-base font-bold text-foreground">Warning: Remove Product</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Are you sure you want to permanently remove{' '}
            <strong className="text-foreground font-semibold">{product.name}</strong> from your catalog?
          </p>
          <div className="p-2.5 rounded-[0.75rem] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
            ⚠️ This item currently has <strong>0 quantity</strong>. Confirming will permanently remove this design.
          </div>
        </div>

        {deleteError && (
          <div className="rounded-[0.5rem] bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            {deleteError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-muted-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={deleting}
            onClick={confirmDeleteProduct}
            className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-sm inline-flex items-center gap-1.5 active:scale-98"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Confirm to Remove</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ZeroOutStockModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function ZeroOutStockModal({
  product,
  isOpen,
  onClose,
  onSuccess,
}: ZeroOutStockModalProps) {
  const [zeroingOut, setZeroingOut] = useState(false);
  const [zeroOutError, setZeroOutError] = useState('');

  if (!isOpen || !product) return null;

  const confirmZeroOutProduct = async () => {
    setZeroingOut(true);
    setZeroOutError('');
    try {
      await apiRequest('/stock/zero-out', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setZeroOutError((err as Error).message || 'Failed to zero out stock');
    } finally {
      setZeroingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[1.25rem] border border-amber-500/30 bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <RotateCcw className="h-5 w-5" />
            <h2 className="text-base font-bold text-foreground">Set Quantity to 0</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Zero out all remaining inventory for{' '}
            <strong className="text-foreground font-semibold">{product.name}</strong> across all warehouses?
          </p>
          <p className="text-muted-foreground">
            Once quantity is set to 0, the trash icon will appear allowing you to delete this product.
          </p>
        </div>

        {zeroOutError && (
          <div className="rounded-[0.5rem] bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            {zeroOutError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-muted-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={zeroingOut}
            onClick={confirmZeroOutProduct}
            className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-sm inline-flex items-center gap-1.5 active:scale-98"
          >
            {zeroingOut ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Setting to 0...</span>
              </>
            ) : (
              <span>Confirm Set to 0</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
