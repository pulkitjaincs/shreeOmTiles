'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

interface AddTripModalProps {
  deliveryId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTripModal({ deliveryId, onClose, onSuccess }: AddTripModalProps) {
  const [vehicle, setVehicle] = useState('');
  const [tripCost, setTripCost] = useState<number | ''>(0);
  const [tripNotes, setTripNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!deliveryId) return null;

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest(`/delivery/${deliveryId}/trips`, {
        method: 'POST',
        body: JSON.stringify({
          vehicle,
          cost: Number(tripCost) || 0,
          notes: tripNotes,
        }),
      });
      setVehicle('');
      setTripCost(0);
      setTripNotes('');
      onSuccess();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to record trip cost');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[1.25rem] border border-border/70 bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-base font-bold text-foreground">Log Additional Transport Cost</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleAddTrip} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Vehicle / Truck No
            </label>
            <input
              type="text"
              placeholder="e.g. DL-1AA-1234 (Tata Ace)"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Trip Cost (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={tripCost}
              onChange={(e) => setTripCost(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Extra toll / secondary trip"
              value={tripNotes}
              onChange={(e) => setTripNotes(e.target.value)}
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

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
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1.5 active:scale-98"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Cost'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
