'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { Warehouse } from './types';

interface DeleteWarehouseModalProps {
  target: Warehouse | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function DeleteWarehouseModal({
  target,
  onClose,
  onSuccess,
}: DeleteWarehouseModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/warehouses/${target.id}`, { method: 'DELETE' });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to delete warehouse');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-base font-bold text-foreground">Warning: Remove Warehouse</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Are you sure you want to permanently remove warehouse{' '}
            <strong className="text-foreground font-semibold">{target.name}</strong>?
          </p>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300">
            ⚠️ This location is verified empty with <strong>0 units</strong> of stock.
            Confirming will permanently remove this location.
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={deleting}
            onClick={handleConfirmDelete}
            className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-600/20"
          >
            {deleting ? 'Removing...' : 'Confirm to Remove'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ZeroOutWarehouseModalProps {
  target: Warehouse | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function ZeroOutWarehouseModal({
  target,
  onClose,
  onSuccess,
}: ZeroOutWarehouseModalProps) {
  const [zeroing, setZeroing] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;

  const handleConfirmZeroOut = async () => {
    setZeroing(true);
    setError('');
    try {
      await apiRequest('/stock/zero-out', {
        method: 'POST',
        body: JSON.stringify({ warehouseId: target.id }),
      });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to zero out warehouse stock');
    } finally {
      setZeroing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <RotateCcw className="h-5 w-5" />
            <h2 className="text-base font-bold text-foreground">Empty Warehouse (Set to 0)</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Set all active inventory in{' '}
            <strong className="text-foreground font-semibold">{target.name}</strong> to 0?
          </p>
          <p className="text-muted-foreground">
            Once the warehouse is empty (0 units), the trash icon will appear allowing
            you to remove this warehouse.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={zeroing}
            onClick={handleConfirmZeroOut}
            className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-lg shadow-amber-600/20"
          >
            {zeroing ? 'Setting to 0...' : 'Confirm Set All Stock to 0'}
          </Button>
        </div>
      </div>
    </div>
  );
}
