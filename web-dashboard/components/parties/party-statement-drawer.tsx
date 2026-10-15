'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  X,
  Pencil,
  Phone,
  Building2,
  MapPin,
  Loader2,
  ShoppingBag,
  CreditCard,
  Receipt,
  Calendar,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Party, PartyDetail } from './types';

interface PartyStatementDrawerProps {
  party: Party | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (party: Party) => void;
}

export function PartyStatementDrawer({
  party,
  isOpen,
  onClose,
  onEdit,
}: PartyStatementDrawerProps) {
  const [partyData, setPartyData] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'credits'>('orders');

  const fetchParty360 = useCallback(async (partyId: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<PartyDetail>(`/parties/${partyId}`);
      setPartyData(data);
    } catch (err) {
      console.error('Failed to fetch customer 360 history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (isOpen && party) {
      setPartyData(null);
      setActiveTab('orders');
      fetchParty360(party.id);
    }
  }, [isOpen, party, fetchParty360]);

  if (!isOpen || !party) return null;

  // Aggregate stats
  const lifetimeTotal = (partyData?.invoices || []).reduce(
    (sum, inv) => sum + Number(inv.total || 0),
    0
  );

  const settledPayments = (partyData?.invoices || []).reduce((sum, inv) => {
    const paid = (inv.payments || [])
      .filter((p) => p.status === 'CONFIRMED')
      .reduce((pSum, p) => pSum + Number(p.amount || 0), 0);
    return sum + paid;
  }, 0);

  const totalDues = (partyData?.creditLedgers || [])
    .filter((cl) => cl.status !== 'SETTLED')
    .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

  // WhatsApp Reminder handler
  const handleSendReminder = () => {
    const cleanPhone = party.phone.replace(/[^0-9]/g, '');
    const formattedDue = `₹${totalDues.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const message = `Dear ${party.name}, this is a friendly reminder from Shree Om Tiles regarding your outstanding balance of ${formattedDue}. Please clear the payment at your earliest convenience. Thank you!`;
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[88dvh] flex flex-col rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-border/60 bg-card/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg uppercase shadow-lg shadow-primary/25">
              {party.name.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground tracking-tight">{party.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-foreground">{party.phone}</span>
                </span>
                {party.gstin && (
                  <span className="flex items-center gap-1 font-mono text-primary font-medium">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    GST: {party.gstin}
                  </span>
                )}
                {party.address && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {party.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                onClose();
                onEdit(party);
              }}
              variant="outline"
              className="bg-muted/60 hover:bg-muted text-foreground text-xs px-3 py-1.5 rounded-xl border border-border/80 inline-flex items-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5 text-amber-500" />
              Edit Customer
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body with Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Fetching complete order and credit history...</p>
            </div>
          ) : !partyData ? (
            <div className="py-12 text-center text-muted-foreground">Unable to load customer history.</div>
          ) : (
            <>
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/40">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                    Lifetime Billing
                  </span>
                  <div className="text-lg font-bold text-foreground mt-1">
                    ₹{lifetimeTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Across all orders</span>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-muted/40">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                    Total Orders
                  </span>
                  <div className="text-lg font-bold text-foreground mt-1">
                    {partyData.invoices?.length || 0}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Invoices generated</span>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                    Outstanding Dues
                  </span>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                    ₹{totalDues.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-0.5 block">
                    {totalDues > 0 ? 'Pending in credit ledger' : 'All accounts settled'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Total Received
                  </span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ₹{settledPayments.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 block">Confirmed payments</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-border/60">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`pb-3 px-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
                    activeTab === 'orders'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Orders Placed ({partyData.invoices?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('credits')}
                  className={`pb-3 px-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
                    activeTab === 'credits'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Credit & Ledger History ({partyData.creditLedgers?.length || 0})
                </button>
              </div>

              {/* TAB 1: ORDERS PLACED */}
              {activeTab === 'orders' && (
                <div className="space-y-3">
                  {!partyData.invoices || partyData.invoices.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-border/80">
                      <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm">No orders have been placed by this customer yet.</p>
                    </div>
                  ) : (
                    partyData.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 rounded-xl border border-border/80 bg-card/60 hover:border-border transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-foreground text-sm">
                              {inv.invoiceNo}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {inv.paymentMode && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 font-medium">
                                {inv.paymentMode}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : inv.status === 'PARTIAL'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : inv.status === 'CREATED'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {inv.status}
                            </span>
                            <span className="font-bold font-mono text-foreground text-base">
                              ₹{Number(inv.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Items Breakdown */}
                        {inv.items && inv.items.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {inv.items.map((item) => (
                              <div
                                key={item.id}
                                className="text-xs flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg border border-border/60 text-foreground"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-medium text-foreground">
                                    {item.product?.name || 'Item'}
                                  </span>
                                  <span className="text-muted-foreground ml-1.5 font-mono">
                                    × {item.qty} {item.product?.unit || 'pcs'}
                                  </span>
                                </div>
                                <span className="font-mono text-foreground font-semibold whitespace-nowrap">
                                  ₹{Number(item.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {inv.salesman && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                            <span>Billed by Salesman:</span>
                            <span className="text-foreground font-medium">{inv.salesman.name}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: CREDIT & LEDGER HISTORY */}
              {activeTab === 'credits' && (
                <div className="space-y-3">
                  {!partyData.creditLedgers || partyData.creditLedgers.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-border/80">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="text-sm">No credit transactions recorded. This customer has always paid upfront via Cash or UPI.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/80 overflow-hidden bg-card/60">
                      <table className="w-full text-left text-xs text-foreground">
                        <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider border-b border-border/80">
                          <tr>
                            <th className="py-3 px-4">Invoice Ref</th>
                            <th className="py-3 px-4">Date Issued</th>
                            <th className="py-3 px-4">Due Date</th>
                            <th className="py-3 px-4">Amount Due</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Reminders</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {partyData.creditLedgers.map((cl) => {
                            const dueAmt = Number(cl.amountDue || 0);
                            const isOverdue =
                              cl.dueDate &&
                              cl.status !== 'SETTLED' &&
                              new Date(cl.dueDate).getTime() < now;

                            return (
                              <tr key={cl.id} className="hover:bg-muted/30 transition">
                                <td className="py-3 px-4 font-mono font-medium text-foreground">
                                  {cl.invoice?.invoiceNo || 'Direct Credit'}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {new Date(cl.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </td>
                                <td className="py-3 px-4">
                                  {cl.dueDate ? (
                                    <div>
                                      <span className="text-foreground">
                                        {new Date(cl.dueDate).toLocaleDateString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </span>
                                      {isOverdue && (
                                        <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                          Overdue
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold">
                                  <span className={dueAmt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
                                    ₹{dueAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-medium ${
                                      cl.status === 'SETTLED'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : cl.status === 'PARTIAL'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                    }`}
                                  >
                                    {cl.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-mono text-muted-foreground bg-muted border border-border/50 px-2 py-0.5 rounded text-[11px]">
                                    {cl.remindersSent} sent
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/60 bg-card/90 flex items-center justify-between">
          {totalDues > 0 ? (
            <button
              onClick={handleSendReminder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-semibold border border-[#25D366]/30 transition"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Send WhatsApp Reminder (₹{totalDues.toLocaleString('en-IN', { maximumFractionDigits: 2 })})
            </button>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No pending balance due for this party
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs px-4 py-2"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
