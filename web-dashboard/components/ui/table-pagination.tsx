'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className = '',
}: TablePaginationProps) {
  const [jumpInput, setJumpInput] = useState('');
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  if (totalItems === 0) return null;

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate numbered pages with ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (safePage < totalPages - 2) pages.push('ellipsis');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-border/80 bg-card/60 backdrop-blur-sm text-xs text-muted-foreground rounded-b-2xl ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-center sm:text-left">
        <div>
          Showing <strong className="text-foreground font-semibold">{startItem}</strong> to{' '}
          <strong className="text-foreground font-semibold">{endItem}</strong> of{' '}
          <strong className="text-foreground font-semibold">{totalItems}</strong> entries
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border/80">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="h-[28px] px-2 rounded-lg border border-border/80 bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition"
              aria-label="Select rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Jump to first */}
          {totalPages > 5 && (
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(1)}
              className="p-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="First Page"
              aria-label="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Previous */}
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="px-2.5 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-1"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span key={`ell-${idx}`} className="px-1 text-muted-foreground select-none">
                    …
                  </span>
                );
              }
              const isActive = p === safePage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-[30px] h-[30px] px-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/80 bg-background hover:bg-muted text-foreground'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next */}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="px-2.5 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-1"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Jump to last */}
          {totalPages > 5 && (
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="p-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Last Page"
              aria-label="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Direct Jump to Page */}
          {totalPages > 3 && (
            <form onSubmit={handleJump} className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border/80">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder={String(safePage)}
                className="w-12 h-[30px] px-1 text-center rounded-lg border border-border/80 bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title={`Enter page number (1-${totalPages}) and press Enter`}
                aria-label="Go to page number"
              />
              <button
                type="submit"
                className="px-2 h-[30px] rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium transition"
              >
                Go
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
