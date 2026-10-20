'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  Plus, 
  Search, 
  Tag, 
  X,
  Pencil,
} from 'lucide-react';
import { CreateExpenseModal } from '@/components/expenses/create-expense-modal';
import { formatINR, formatDate } from '@/lib/formatters';
import { TablePagination } from '@/components/ui/table-pagination';

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
  PANTRY_REFRESHMENTS: 'Tea & Pantry Refreshments',
  LABOUR_HAMALI: 'Labour & Hamali Charges',
  FUEL_TRANSPORT: 'Vehicle Fuel & Tolls',
  RENT_GODOWN: 'Godown / Showroom Rent',
  ELECTRICITY_UTILITIES: 'Electricity & Utilities',
  SALARY_ADVANCE: 'Staff Advance / Wages',
  MAINTENANCE_REPAIRS: 'Shop & Godown Maintenance',
  MARKETING_SAMPLE: 'Marketing & Samples',
  OTHER: 'Other Operational Outlay',
  // Backward compatibility
  TEA_REFRESHMENT: 'Tea & Pantry Refreshments',
  TRANSPORT_FUEL: 'Vehicle Fuel & Tolls',
  MAINTENANCE: 'Shop & Godown Maintenance',
  ELECTRICITY: 'Electricity & Utilities',
  SALARY: 'Staff Advance / Wages',
  RENT: 'Godown / Showroom Rent',
  MARKETING: 'Marketing & Samples',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

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
    const timer = setTimeout(() => {
      void loadExpenses();
    }, 0);
    const handleRefresh = () => loadExpenses(true);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('app:refresh-active-page', handleRefresh);
    };
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

  const deferredSearch = useDeferredValue(search);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const cat = (CATEGORY_LABELS[e.category] || e.category).toLowerCase();
        const paidTo = (e.paidTo || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        return cat.includes(q) || paidTo.includes(q) || notes.includes(q);
      }
      return true;
    });
  }, [expenses, deferredSearch, categoryFilter]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [prevFilterKey, setPrevFilterKey] = useState(`${deferredSearch}_${categoryFilter}`);
  const currentFilterKey = `${deferredSearch}_${categoryFilter}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

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
            Electronic payouts & bank transfers
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
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => (
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
                    <td className="py-3 px-4 text-muted-foreground">
                      {exp.user?.name || 'Staff'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpense(exp);
                          setShowCreateModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredExpenses.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Create Modal */}
      <CreateExpenseModal
        isOpen={showCreateModal}
        expenseToEdit={editingExpense}
        onClose={() => {
          setShowCreateModal(false);
          setEditingExpense(null);
        }}
        onSuccess={() => loadExpenses(true)}
      />
    </div>
  );
}
