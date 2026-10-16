'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { UserPlus, Pencil, X } from 'lucide-react';
import { Party } from './types';

interface PartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  party?: Party | null;
}

export function PartyFormModal({
  isOpen,
  onClose,
  onSuccess,
  party,
}: PartyFormModalProps) {
  const isEditing = Boolean(party);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [category, setCategory] = useState<'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER'>('RETAIL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(party?.name || '');
      setPhone(party?.phone || '');
      setAddress(party?.address || '');
      setGstin(party?.gstin || '');
      setCategory(party?.category || 'RETAIL');
      setError('');
    }
  }, [isOpen, party]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be strictly 10 digits');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEditing && party) {
        await apiRequest(`/parties/${party.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            address: address.trim() || undefined,
            gstin: gstin.trim().toUpperCase() || undefined,
            category,
          }),
        });
      } else {
        await apiRequest('/parties', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            address: address.trim() || undefined,
            gstin: gstin.trim().toUpperCase() || undefined,
            category,
          }),
        });
      }

      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 animate-in fade-in">
      <div className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              {isEditing ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Customer Details' : 'Add New Customer / Party'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEditing
                  ? 'Update mobile number, shipping address, or GSTIN.'
                  : 'Register a contractor, walk-in customer, or commercial buyer.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Customer / Firm Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar or Balaji Construction"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              10-Digit Mobile Number *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="9876543210"
                className="w-full rounded-xl border border-border/80 bg-muted/50 pl-10 pr-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Used for automated WhatsApp invoices & payment receipt dispatch.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Site Address / Location
            </label>
            <textarea
              rows={2}
              placeholder="Plot/Flat no, Street, Colony, City"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              GSTIN (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 07AAAAA0000A1Z5"
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-xs text-foreground uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Customer Category / Tier
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER')}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            >
              <option value="RETAIL">Retail Customer</option>
              <option value="CONTRACTOR">Contractor (Tiered Wholesale)</option>
              <option value="ARCHITECT">Architect / Designer</option>
              <option value="WHOLESALER">Wholesaler / Dealer</option>
            </select>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Wholesalers & Contractors automatically receive wholesale pricing on invoices.
            </span>
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
              className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs px-4 shadow-lg shadow-primary/20"
            >
              {submitting
                ? 'Saving...'
                : isEditing
                ? 'Save Customer'
                : 'Create Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
