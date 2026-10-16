'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  Plus, 
  Search, 
  Calendar, 
  Tag, 
  Banknote, 
  X,
  CreditCard
} from 'lucide-react';
import { CreateExpenseModal } from '@/components/expenses/create-expense-modal';
import { formatINR, formatDate } from '@/lib/formatters';

interface ExpenseRecord {
  id: string;
  category: string;
  amount: number;
  paymentMode: string;
  paidTo?: string;
  notes?: string;
  expenseDate: string;
  createdAt: string;
  user?: { name: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  TEA_REFRESHMENT: 'Tea & Refreshments',
  TRANSPORT_FUEL: 'Transport & Fuel',
  MAINTENANCE: 'Maintenance',
  ELECTRICITY: 'Electricity & Utilities',
  OFFICE_SUPPLIES: 'Office Supplies',
  SALARY: 'Staff Wages / Advance',
  RENT: 'Premises Rent',
  MARKETING: 'Marketing',
  OTHER: 'Other Outlay',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadExpenses = useCallback(async (force = false) => {
    try {
      const data = await cachedApiRequest<ExpenseRecord[]>('/expenses', {
        forceRefresh: force,
        onRevalidate: (fresh) => setExpenses(fresh),
      });
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
    const handleRefresh = () => loadExpenses(true);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadExpenses]);

  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const cashExpense = useMemo(() => {
    return expenses
      .filter((e) => e.paymentMode === 'CASH')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const onlineExpense = useMemo(() => {
    return expenses
      .filter((e) => e.paymentMode !== 'CASH')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const cat = (CATEGORY_LABELS[e.category] || e.category).toLowerCase();
        const paidTo = (e.paidTo || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        return cat.includes(q) || paidTo.includes(q) || notes.includes(q);
      }
      return true;
    });
  }, [expenses, search, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Shop Expenses & Outflows
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track daily petty cash drawer debits, utilities, fuel, staff allowances & operational costs
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Record Expense
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Operational Expenses
          </span>
          <span className="text-2xl font-extrabold text-foreground tracking-tight block">
            {formatINR(totalExpense)}
          </span>
          <span className="text-[11px] text-muted-foreground block">
            {expenses.length} expense record(s) logged
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Cash Drawer Outflow
          </span>
          <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight block">
            {formatINR(cashExpense)}
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Cash disbursed directly from store till
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            UPI & Bank Transfers
          </span>
          <span className="text-2xl font-extrabold text-primary tracking-tight block">
            {formatINR(onlineExpense)}
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Electronic payouts & cheque settlements
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 p-3 rounded-2xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search category, paid to, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All Categories
            </button>
            {Object.entries(CATEGORY_LABELS).slice(0, 5).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  categoryFilter === key
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground shrink-0">
          Showing <strong>{filteredExpenses.length}</strong> of {expenses.length} entries
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/50 uppercase tracking-wider text-[11px] text-muted-foreground border-b border-border font-semibold">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Paid To</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Tag className="h-3 w-3 text-primary" />
                        {CATEGORY_LABELS[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground text-sm">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {exp.paidTo || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {formatDate(exp.expenseDate || exp.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                      {exp.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {exp.user?.name || 'Staff'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <CreateExpenseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => loadExpenses(true)}
      />
    </div>
  );
}
