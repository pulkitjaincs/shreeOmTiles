'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Pencil, PackagePlus, Loader2 } from 'lucide-react';
import { Product, Warehouse } from './types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  product?: Product | null;
  warehouses: Warehouse[];
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  warehouses,
}: ProductFormModalProps) {
  const isEditing = Boolean(product);

  // Common Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tiles');
  const [hsnCode, setHsnCode] = useState('6907');
  const [unit, setUnit] = useState('box');
  const [size, setSize] = useState('600x1200mm');
  const [finish, setFinish] = useState('Glossy');
  const [price, setPrice] = useState<number | ''>(850);
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(10);

  // Initial Stock Inward (Add mode only)
  const [initialQuantity, setInitialQuantity] = useState<number | ''>('');
  const [initialBatchNo, setInitialBatchNo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setName(product.name || '');
        setCategory(product.category || 'Tiles');
        setHsnCode(product.hsnCode || '');
        setUnit(product.unit || 'box');
        const attrs = (product.attributes as Record<string, unknown>) || {};
        setSize((attrs.size as string) || '');
        setFinish((attrs.finish as string) || '');
        setPrice(attrs.price !== undefined ? Number(attrs.price) : '');
        setWholesalePrice(attrs.wholesalePrice !== undefined ? Number(attrs.wholesalePrice) : '');
        setPurchasePrice(attrs.purchasePrice !== undefined ? Number(attrs.purchasePrice) : '');
        setMinStockAlert(product.minStockAlert !== undefined ? Number(product.minStockAlert) : 10);
      } else {
        setName('');
        setCategory('Tiles');
        setHsnCode('6907');
        setUnit('box');
        setSize('600x1200mm');
        setFinish('Glossy');
        setPrice(850);
        setWholesalePrice('');
        setPurchasePrice('');
        setMinStockAlert(10);
        setInitialQuantity('');
        setInitialBatchNo('');
      }
      setError('');
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEditing && product) {
        const existingAttrs = (product.attributes as Record<string, unknown>) || {};
        const attrs = {
          ...existingAttrs,
          size,
          finish,
          ...(price !== '' ? { price: Number(price) } : {}),
          ...(wholesalePrice !== '' ? { wholesalePrice: Number(wholesalePrice) } : {}),
          ...(purchasePrice !== '' ? { purchasePrice: Number(purchasePrice) } : {}),
        };

        await apiRequest(`/products/${product.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            category,
            hsnCode: hsnCode.trim() || undefined,
            unit,
            price: price !== '' ? Number(price) : undefined,
            minStockAlert: minStockAlert !== '' ? Number(minStockAlert) : 10,
            attributes: attrs,
          }),
        });
      } else {
        await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            category,
            hsnCode: hsnCode.trim() || undefined,
            unit,
            price: price !== '' ? Number(price) : undefined,
            minStockAlert: minStockAlert !== '' ? Number(minStockAlert) : 10,
            attributes: {
              size,
              finish,
              price: price !== '' ? Number(price) : undefined,
              wholesalePrice: wholesalePrice !== '' ? Number(wholesalePrice) : undefined,
              purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : undefined,
            },
            initialQuantity: initialQuantity ? Number(initialQuantity) : undefined,
            initialBatchNo: initialBatchNo.trim() || undefined,
          }),
        });
      }

      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-[1.25rem] border border-border/70 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 my-8 max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-[0.75rem] bg-primary/10 text-primary">
              {isEditing ? <Pencil className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Product / Design' : 'Add New Product / Design'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? 'Update product details, sizing, finish attributes, and pricing.'
                  : 'Register a new tile design or sanitary item in the catalog.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Product / Design Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Royal Calacatta Gold 600x1200"
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Tiles">Tiles</option>
                <option value="Sanitaryware">Sanitaryware</option>
                <option value="Fittings">Fittings & Taps</option>
                <option value="Adhesives">Adhesives & Grouts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="box">Box</option>
                <option value="sqft">Sq. Ft</option>
                <option value="piece">Piece</option>
                <option value="set">Set</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">HSN Code</label>
              <input
                type="text"
                placeholder="6907"
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Size / Dimensions</label>
              <input
                type="text"
                placeholder="600x1200mm"
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Finish / Shade</label>
            <input
              type="text"
              placeholder="e.g. Glossy / Matt / Sugar"
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
            />
          </div>

          {/* Pricing & Tiering Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 p-3 rounded-[0.875rem] border border-border/60">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Retail Price (₹ / {unit}) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="850"
                  className="w-full rounded-[0.75rem] border border-input bg-background pl-7 pr-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Wholesale Price (₹ / {unit})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="750"
                  className="w-full rounded-[0.75rem] border border-input bg-background pl-7 pr-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Purchase Cost (₹ / {unit})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="650"
                  className="w-full rounded-[0.75rem] border border-input bg-background pl-7 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Low Stock Alert Threshold */}
          <div className="bg-muted/30 p-3 rounded-[0.875rem] border border-border/60">
            <label className="block text-xs font-semibold text-foreground mb-1">
              Low Stock Alert Threshold ({unit})
            </label>
            <input
              type="number"
              min="0"
              placeholder="10"
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Triggers low stock badge on dashboard when total catalog inventory falls below this amount (default: 10).
            </span>
          </div>

          {/* Initial Stock Inward Section (Add mode only) */}
          {!isEditing && (
            <div className="pt-3 border-t border-border/60 space-y-3 bg-muted/30 p-3 rounded-[0.875rem] border border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  📦 Initial Stock Inward (Optional)
                </span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  Stock directly upon creation
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Initial Quantity ({unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Batch / Lot No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2024-01"
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={initialBatchNo}
                    onChange={(e) => setInitialBatchNo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[0.5rem] bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium inline-flex items-center gap-1.5 active:scale-98 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isEditing ? 'Saving Changes...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Product Changes' : 'Save Product & Stock'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
