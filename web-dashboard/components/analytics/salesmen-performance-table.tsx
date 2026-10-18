'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, Search } from 'lucide-react';
import { SalesmanPerformance } from './types';

interface SalesmenPerformanceTableProps {
  salesmenPerformance?: SalesmanPerformance[];
}

export function SalesmenPerformanceTable({
  salesmenPerformance,
}: SalesmenPerformanceTableProps) {
  const [salesmanSearch, setSalesmanSearch] = useState('');

  const formatCurrency = (val: number = 0) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const filteredSalesmen = useMemo(() => {
    if (!salesmenPerformance) return [];
    if (!salesmanSearch.trim()) return salesmenPerformance;
    const q = salesmanSearch.toLowerCase();
    return salesmenPerformance.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone.includes(q)
    );
  }, [salesmenPerformance, salesmanSearch]);

  const totalStaffSales = useMemo(() => {
    if (!salesmenPerformance) return 1;
    const sum = salesmenPerformance.reduce((acc, s) => acc + s.totalSales, 0);
    return sum > 0 ? sum : 1;
  }, [salesmenPerformance]);

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/75 backdrop-blur-xl space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Sales Staff Overview</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            All registered sales personnel, total invoices raised, cumulative sales volume, and ticket averages in the selected timeframe.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search staff..."
              value={salesmanSearch}
              onChange={(e) => setSalesmanSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-44 sm:w-48"
            />
          </div>
          <Link
            href="/dashboard/users"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Manage Staff &rarr;
          </Link>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-foreground">
          <thead className="bg-muted/50 font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/80">
            <tr>
              <th className="py-3 px-4">Sales Person</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4 text-center">Invoices Raised</th>
              <th className="py-3 px-4 text-right">Total Sales Volume</th>
              <th className="py-3 px-4 text-right">Avg Order Value</th>
              <th className="py-3 px-4">Sales Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {filteredSalesmen.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-muted-foreground">
                  No sales personnel match your criteria.
                </td>
              </tr>
            ) : (
              filteredSalesmen.map((salesman) => {
                const sharePct = Math.round((salesman.totalSales / totalStaffSales) * 100);
                return (
                  <tr key={salesman.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
                          {salesman.name.charAt(0).toUpperCase()}
                        </div>
                        <Link href={`/dashboard/invoices?createdById=${encodeURIComponent(salesman.id)}`} className="group">
                          <div className="font-semibold text-foreground group-hover:text-primary group-hover:underline">{salesman.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{salesman.phone}</div>
                        </Link>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground border border-border">
                        {salesman.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {salesman.invoiceCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      {formatCurrency(salesman.totalSales)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {formatCurrency(salesman.avgOrderValue)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden min-w-[50px]">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(3, sharePct))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                          {sharePct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
