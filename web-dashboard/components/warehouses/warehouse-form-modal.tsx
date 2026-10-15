'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Warehouse as WarehouseIcon, Edit3, X } from 'lucide-react';
import { Warehouse } from './types';

interface WarehouseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  warehouse?: Warehouse | null;
}

export function WarehouseFormModal({
  isOpen,
  onClose,
  onSuccess,
  warehouse,
}: WarehouseFormModalProps) {
  const isEditing = Boolean(warehouse);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('WAREHOUSE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(warehouse?.name || '');
      setAddress(warehouse?.address || '');
      setType(warehouse?.type || 'WAREHOUSE');
      setError('');
    }
  }, [isOpen, warehouse]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isEditing && warehouse) {
        await apiRequest(`/warehouses/${warehouse.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, address, type }),
        });
      } else {
        await apiRequest('/warehouses', {
          method: 'POST',
          body: JSON.stringify({ name, address, type }),
        });
      }
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              {isEditing ? (
                <Edit3 className="h-5 w-5" />
              ) : (
                <WarehouseIcon className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Warehouse / Facility' : 'Add Warehouse / Showroom'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? 'Update warehouse name, location address, and facility type.'
                  : 'Define a new storage godown or retail showroom counter.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Warehouse Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Godown #1 (Industrial Area)"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Full Location / Address *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Street, Industrial Area, City, Pincode"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Facility Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            >
              <option value="WAREHOUSE" className="bg-card text-foreground">Warehouse / Godown (Storage & Bulk Stock)</option>
              <option value="SHOWROOM" className="bg-card text-foreground">Showroom (Display & Direct Retail Walk-ins)</option>
            </select>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-lg shadow-primary/20"
            >
              {submitting
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Save Warehouse'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
