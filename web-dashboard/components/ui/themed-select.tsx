'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface ThemedSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
  id,
  searchable,
  searchPlaceholder = 'Search...',
}: ThemedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-enable search if searchable is explicitly true or if options count is large (> 6)
  const isSearchActive = searchable ?? (options.length > 6);

  const selectedOption = options.find((opt) => opt.value === value);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isSearchActive) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, isSearchActive]);

  const filteredOptions = useMemo(() => {
    if (!isSearchActive || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)),
    );
  }, [options, isSearchActive, searchQuery]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-[0.75rem] border border-input bg-background/90 hover:bg-background px-3 py-2 text-[0.8125rem] text-foreground font-medium flex items-center justify-between gap-2 transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-left">
          {selectedOption ? (
            <span className="flex items-center gap-1.5 truncate">
              <span>{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">
                  {selectedOption.badge}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-[0.875rem] border border-border bg-card shadow-xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-64">
          {/* Integrated Search Box */}
          {isSearchActive && (
            <div className="p-1.5 border-b border-border/60 bg-card shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-[0.5rem] bg-muted/50 pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground border border-input focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                      setSearchQuery('');
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    title="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options Scroll Container */}
          <div className="overflow-y-auto p-1 space-y-0.5 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {searchQuery ? `No options matching "${searchQuery}"` : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[0.625rem] text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                        : 'text-foreground hover:bg-muted/80'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-medium">{opt.label}</div>
                      {opt.subLabel && (
                        <div
                          className={`text-[0.6875rem] truncate ${
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          }`}
                        >
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && !isSelected && (
                        <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-mono">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </div>
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
