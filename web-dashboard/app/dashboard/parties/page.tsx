'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cachedApiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { Party } from '@/components/parties/types';
import { PartyFormModal } from '@/components/parties/party-form-modal';
import { DeletePartyModal } from '@/components/parties/delete-party-modal';
import { PartyStatementDrawer } from '@/components/parties/party-statement-drawer';

export default function PartiesPage() {
  const { user } = useAuth();
  const isSalesman = user?.role === 'SALESMAN';

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regFilter, setRegFilter] = useState<'ALL' | 'REGISTERED' | 'UNREGISTERED'>('ALL');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'DUES' | 'PAYABLES' | 'CLEARED'>('ALL');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<Party | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [partyForView, setPartyForView] = useState<Party | null>(null);

  const loadParties = useCallback(async (force = false) => {
    try {
      const data = await cachedApiRequest<Party[]>('/parties?includeUnsaved=true', {
        forceRefresh: force,
        onRevalidate: (fresh) => setParties(fresh),
      });
      setParties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParties();
    const handleRefresh = () => {
      loadParties(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadParties]);

  // Helper to compute party dues (RECEIVABLE - PAYABLE store credit)
  const getPartyTotalDue = (party: Party) => {
    return (party.creditLedgers || [])
      .filter((c) => c.status !== 'SETTLED')
      .reduce((sum, c) => {
        const amt = Number(c.amountDue || 0);
        return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
      }, 0);
  };

  const getPartyPayable = (party: Party) => {
    return (party.creditLedgers || [])
      .filter((c) => c.status !== 'SETTLED' && c.type === 'PAYABLE')
      .reduce((sum, c) => sum + Number(c.amountDue || 0), 0);
  };

  // Filter Counts
  const registeredCount = useMemo(() => parties.filter((p) => p.isSaved !== false).length, [parties]);
  const unregisteredCount = useMemo(() => parties.filter((p) => p.isSaved === false).length, [parties]);

  const duesCount = useMemo(() => parties.filter((p) => getPartyTotalDue(p) > 0.01).length, [parties]);
  const payablesCount = useMemo(() => parties.filter((p) => getPartyTotalDue(p) < -0.01 || getPartyPayable(p) > 0.01).length, [parties]);
  const clearedCount = useMemo(() => parties.filter((p) => Math.abs(getPartyTotalDue(p)) <= 0.01 && getPartyPayable(p) <= 0.01).length, [parties]);

  // Search & Multi-dimensional Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties.filter((p) => {
      // 1. Search Query
      if (q) {
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.gstin && p.gstin.toLowerCase().includes(q)) ||
          (p.address && p.address.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Registration Status Filter
      if (regFilter === 'REGISTERED' && p.isSaved === false) return false;
      if (regFilter === 'UNREGISTERED' && p.isSaved !== false) return false;

      // 3. Balance Due Filter
      const totalDue = getPartyTotalDue(p);
      const payable = getPartyPayable(p);
      if (dueFilter === 'DUES' && totalDue <= 0.01) return false;
      if (dueFilter === 'PAYABLES' && !(totalDue < -0.01 || payable > 0.01)) return false;
      if (dueFilter === 'CLEARED' && !(Math.abs(totalDue) <= 0.01 && payable <= 0.01)) return false;

      return true;
    });
  }, [parties, search, regFilter, dueFilter]);

  // Ageing Buckets Calculation (Only un-settled RECEIVABLES across all customers)
  const ageing = useMemo(() => {
    let totalReceivables = 0;
    let b0to15 = 0;
    let b15to30 = 0;
    let b30to60 = 0;
    let b60plus = 0;
    const nowTime = Date.now();

    for (const p of parties) {
      for (const cl of p.creditLedgers || []) {
        if (cl.status !== 'SETTLED' && cl.type === 'RECEIVABLE') {
          const amt = Number(cl.amountDue || 0);
          totalReceivables += amt;
          const dueTime = cl.dueDate ? new Date(cl.dueDate).getTime() : nowTime;
          const daysOverdue = Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)));
          if (daysOverdue <= 15) b0to15 += amt;
          else if (daysOverdue <= 30) b15to30 += amt;
          else if (daysOverdue <= 60) b30to60 += amt;
          else b60plus += amt;
        }
      }
    }
    return { totalReceivables, b0to15, b15to30, b30to60, b60plus };
  }, [parties]);

  const { totalReceivables, b0to15, b15to30, b30to60, b60plus } = ageing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Parties Directory & Credit Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer accounts, inspect historical order/credit ledgers, update profile details, and enforce zero-due deletion safeguards.
          </p>
        </div>
        {!isSalesman && (
          <Button
            onClick={() => {
              setPartyToEdit(null);
              setFormModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      {/* Credit Ageing Buckets Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Total Receivables</span>
          <div className="text-lg font-bold text-foreground mt-1">
            ₹{totalReceivables.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">0–15 Days</span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{b0to15.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-xl">
          <span className="text-[11px] font-medium text-primary uppercase tracking-wider block">15–30 Days</span>
          <div className="text-lg font-bold text-primary mt-1">
            ₹{b15to30.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider block">30–60 Days</span>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            ₹{b30to60.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 col-span-2 sm:col-span-1 backdrop-blur-xl">
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider block">60+ Days (Overdue)</span>
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
            ₹{b60plus.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="flex items-center gap-3 bg-card/75 backdrop-blur-xl p-3 rounded-2xl border border-border/80 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Search by customer name, 10-digit phone number, address, or GSTIN..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-muted-foreground hover:text-foreground mr-2 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Registration Status Filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs overflow-x-auto shrink-0">
            <button
              onClick={() => setRegFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                regFilter === 'ALL'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Customers ({parties.length})
            </button>
            <button
              onClick={() => setRegFilter('REGISTERED')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                regFilter === 'REGISTERED'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Saved Directory ({registeredCount})
            </button>
            <button
              onClick={() => setRegFilter('UNREGISTERED')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                regFilter === 'UNREGISTERED'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Walk-in / Unregistered ({unregisteredCount})
            </button>
          </div>

          {/* Dues / Balance Filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs overflow-x-auto shrink-0">
            <button
              onClick={() => setDueFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                dueFilter === 'ALL'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Balances
            </button>
            <button
              onClick={() => setDueFilter('DUES')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                dueFilter === 'DUES'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-rose-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Dues Pending ({duesCount})
            </button>
            <button
              onClick={() => setDueFilter('PAYABLES')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                dueFilter === 'PAYABLES'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-amber-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Store Payables ({payablesCount})
            </button>
            <button
              onClick={() => setDueFilter('CLEARED')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                dueFilter === 'CLEARED'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-emerald-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Cleared ({clearedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Parties Table */}
      <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Orders</th>
                <th className="py-3.5 px-4">Outstanding Dues</th>
                {!isSalesman && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={isSalesman ? 5 : 6} className="text-center py-12 text-muted-foreground text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Loading customer directory...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isSalesman ? 5 : 6} className="text-center py-12 text-muted-foreground text-xs">
                    No customers found. {!isSalesman && 'Click "Add Customer" to create your first customer profile.'}
                  </td>
                </tr>
              ) : (
                filtered.map((party) => {
                  const totalDue = getPartyTotalDue(party);

                  return (
                    <tr key={party.id} className="hover:bg-muted/30 transition group">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase shadow-inner">
                            {party.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {isSalesman ? (
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  {party.name}
                                </span>
                              ) : (
                                <span
                                  onClick={() => setPartyForView(party)}
                                  className="font-semibold text-foreground hover:text-primary cursor-pointer transition flex items-center gap-1.5"
                                >
                                  {party.name}
                                </span>
                              )}
                              {party.isSaved === false && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Walk-in
                                </span>
                              )}
                            </div>
                            {party.address && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{party.address}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-foreground">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {party.phone}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {party.gstin ? (
                          <span className="text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 font-medium">
                            {party.gstin}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Unregistered</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-foreground">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted border border-border/60 text-muted-foreground">
                          <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                          {party._count?.invoices || 0} orders
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`font-bold font-mono text-sm ${totalDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            ₹{totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                          {totalDue > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
                              Dues Pending
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                              Nil Dues / Cleared
                            </span>
                          )}
                        </div>
                      </td>

                      {!isSalesman && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* 1. View Customer 360 History Button */}
                            <button
                              onClick={() => setPartyForView(party)}
                              title="View Customer 360° (Orders & Credits)"
                              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* 2. Edit Customer Button */}
                            <button
                              onClick={() => {
                                setPartyToEdit(party);
                                setFormModalOpen(true);
                              }}
                              title="Edit Customer Profile"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            {/* 3. Delete Customer Button */}
                            <button
                              onClick={() => setPartyToDelete(party)}
                              title={totalDue > 0 ? 'Cannot delete: Outstanding dues pending' : 'Delete / Remove Customer'}
                              className={`p-1.5 rounded-lg border transition ${
                                totalDue > 0
                                  ? 'bg-muted text-muted-foreground border-border/60 hover:bg-rose-500/10 hover:text-rose-500'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer 360° View Modal / Drawer */}
      <PartyStatementDrawer
        isOpen={Boolean(partyForView)}
        party={partyForView}
        onClose={() => setPartyForView(null)}
        onEdit={(party) => {
          setPartyToEdit(party);
          setFormModalOpen(true);
        }}
      />

      {/* Add / Edit Customer Modal */}
      <PartyFormModal
        isOpen={formModalOpen}
        party={partyToEdit}
        onClose={() => {
          setFormModalOpen(false);
          setPartyToEdit(null);
        }}
        onSuccess={loadParties}
      />

      {/* Delete / Remove Customer Safety Modal */}
      <DeletePartyModal
        party={partyToDelete}
        onClose={() => setPartyToDelete(null)}
        onSuccess={loadParties}
      />
    </div>
  );
}
