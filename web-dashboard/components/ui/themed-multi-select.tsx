'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, CheckSquare, Square, Search, X } from 'lucide-react';

export interface ThemedMultiSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface ThemedMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: ThemedMultiSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  showTags?: boolean;
}

export function ThemedMultiSelect({
  values,
  onChange,
  options,
  placeholder = 'Select options...',
  className = '',
  disabled = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  showTags = true,
}: ThemedMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  const toggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredVals = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...values, ...allFilteredVals]));
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Trigger label text
  const triggerLabel = useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) {
      const match = options.find((o) => o.value === values[0]);
      return match ? match.label : '1 selected';
    }
    const firstMatch = options.find((o) => o.value === values[0]);
    return `${firstMatch ? firstMatch.label : '1 item'} + ${values.length - 1} more (${values.length} selected)`;
  }, [values, options, placeholder]);

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between text-left text-xs rounded-xl border border-input bg-background text-foreground py-2 px-3 transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${
          disabled ? 'opacity-50 cursor-not-allowed bg-muted/40' : 'hover:border-foreground/40 cursor-pointer'
        } ${className}`}
      >
        <span className={`truncate mr-2 ${values.length === 0 ? 'text-muted-foreground' : 'font-medium'}`}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {/* Selected tags below trigger */}
      {showTags && values.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {values.map((val) => {
            const opt = options.find((o) => o.value === val);
            if (!opt) return null;
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[0.6875rem] font-semibold"
              >
                <span>{opt.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(val);
                    }}
                    className="hover:text-destructive transition-colors ml-0.5"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden flex flex-col animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search bar & quick actions */}
          <div className="p-2 border-b border-border bg-muted/30 space-y-1.5">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-[0.6875rem] px-1 font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:text-primary transition"
              >
                Select All
              </button>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-destructive transition text-muted-foreground"
                >
                  Clear Selection ({values.length})
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-48 p-1 divide-y divide-border/30">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground italic">
                No matching supervisors found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleOption(opt.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="block text-[0.6875rem] text-muted-foreground font-normal">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    {opt.badge && (
                      <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0 ml-1">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
