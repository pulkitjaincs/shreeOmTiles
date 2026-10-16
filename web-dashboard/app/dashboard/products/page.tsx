'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Package,
  PackagePlus,
  Trash2,
  RotateCcw,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Product, Warehouse } from '@/components/products/types';

// Lazy-loaded modal components
const ProductFormModal = dynamic(
  () => import('@/components/products/product-form-modal').then((m) => m.ProductFormModal),
  { ssr: false }
);
const DeleteProductModal = dynamic(
  () => import('@/components/products/product-danger-modals').then((m) => m.DeleteProductModal),
  { ssr: false }
);
const ZeroOutStockModal = dynamic(
  () => import('@/components/products/product-danger-modals').then((m) => m.ZeroOutStockModal),
  { ssr: false }
);

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [zeroOutTarget, setZeroOutTarget] = useState<Product | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      const [prodData, whData] = await Promise.all([
        cachedApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh),
        }).catch(() => []),
        cachedApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh),
        }).catch(() => []),
      ]);
      setProducts(prodData);
      setWarehouses(whData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadData]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.hsnCode && p.hsnCode.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Products & Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canManage
              ? 'Manage tiles, sanitaryware, fittings, and inward new designs directly into warehouses.'
              : 'Browse tiles, sanitaryware, specifications, and live stock across all warehouses.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/warehouses"
            className="inline-flex items-center gap-2 bg-muted/50 hover:bg-muted text-foreground font-medium px-4 py-2 rounded-[0.75rem] border border-border/60 transition-all text-xs sm:text-sm active:scale-98 shadow-2xs"
          >
            <PackagePlus className="h-4 w-4 text-primary" />
            Go to Warehouses
          </Link>
          {canManage && (
            <Button
              onClick={() => {
                setProductToEdit(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-[0.75rem] shadow-sm text-xs sm:text-sm active:scale-98"
            >
              <Plus className="h-4 w-4" />
              Add New Product / Design
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-card/75 p-3 rounded-[0.75rem] border border-input shadow-2xs">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <input
          type="text"
          placeholder="Search products by name, category, or HSN..."
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Product List */}
      <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">HSN Code</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Specifications</th>
                <th className="py-3 px-4 text-right">Price / Unit</th>
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4 text-right">{canManage ? 'Actions' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Loading products...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No products found. Add products to populate your inventory catalog.
                  </td>
                </tr>
              ) : (
                filtered.map((prod) => {
                  const totalStock = prod.stockLedgers?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;
                  return (
                    <tr key={prod.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-[0.5rem] bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">{prod.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {prod.hsnCode || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground capitalize">
                        {prod.unit}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {prod.attributes && typeof prod.attributes === 'object'
                          ? Object.entries(prod.attributes)
                              .filter(([k]) => k !== 'price' && k !== 'purchasePrice')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')
                          : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-primary">
                        {prod.attributes &&
                        typeof prod.attributes === 'object' &&
                        (prod.attributes as Record<string, unknown>).price !== undefined ? (
                          <span>
                            ₹{String((prod.attributes as Record<string, unknown>).price)}{' '}
                            <span className="text-[0.6875rem] text-muted-foreground font-normal">/{prod.unit}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold font-mono ${
                            totalStock <= 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : totalStock < 10
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {totalStock} {prod.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setProductToEdit(prod);
                                setIsFormOpen(true);
                              }}
                              title="Edit Product (Name, Category, Size, Finish, Price)"
                              className="text-xs font-medium text-foreground hover:bg-muted/80 px-2 py-1.5 rounded-[0.5rem] bg-muted transition-all inline-flex items-center gap-1 active:scale-95"
                            >
                              <Pencil className="h-3.5 w-3.5 text-primary" />
                              Edit
                            </button>

                            <Link
                              href={`/dashboard/warehouses?inwardProduct=${prod.id}`}
                              className="text-xs font-medium text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-[0.5rem] bg-primary/10 transition-all inline-flex items-center gap-1.5 active:scale-95"
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                              Inward
                            </Link>

                            {/* Set quantity to 0 if stock > 0 */}
                            {totalStock > 0 && (
                              <button
                                onClick={() => setZeroOutTarget(prod)}
                                title="Set quantity to 0 to enable deleting this product"
                                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 px-2 py-1.5 rounded-[0.5rem] bg-amber-500/10 transition-all inline-flex items-center gap-1 active:scale-95"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Set to 0
                              </button>
                            )}

                            {/* Trash icon only if quantity is 0 */}
                            {totalStock === 0 && (
                              <button
                                onClick={() => setDeleteProductTarget(prod)}
                                title="Remove Product (Quantity is 0)"
                                className="p-1.5 rounded-[0.5rem] text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 bg-rose-500/10 transition-all inline-flex items-center active:scale-95"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">In Catalog</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        product={productToEdit}
        warehouses={warehouses}
        onClose={() => {
          setIsFormOpen(false);
          setProductToEdit(null);
        }}
        onSuccess={loadData}
      />

      {/* Delete Product Warning Popup Modal */}
      <DeleteProductModal
        isOpen={Boolean(deleteProductTarget)}
        product={deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        onSuccess={loadData}
      />

      {/* Zero Out Stock Modal */}
      <ZeroOutStockModal
        isOpen={Boolean(zeroOutTarget)}
        product={zeroOutTarget}
        onClose={() => setZeroOutTarget(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
