import type { Party } from './types';

/**
 * Pure (React free) helpers for the Customer & Supplier directory.
 *
 * The directory can contain thousands of accounts (saved customers plus every
 * walk-in). The previous implementation recomputed dues/payables for every party
 * three to five times per render and rebuilt the whole search haystack on every
 * keystroke. Here everything is derived exactly ONCE per data load
 * (`buildPartyRows`) and filtering afterwards is plain string/number comparison.
 */

export type PartyDueFilter = 'ALL' | 'DUES' | 'PAYABLES' | 'CLEARED';
export type PartyRegFilter = 'ALL' | 'REGISTERED' | 'UNREGISTERED';

export interface PartyRow {
  party: Party;
  /** receivables minus payables over unsettled ledgers (positive: customer owes us) */
  due: number;
  /** sum of unsettled PAYABLE ledgers (store owes the party) */
  payable: number;
  isWalkIn: boolean;
  nameLower: string;
  gstinLower: string;
  addressLower: string;
  phone: string;
  phoneDigits: string;
}

export interface PartyRowCounts {
  total: number;
  dues: number;
  payables: number;
  cleared: number;
  registered: number;
  unregistered: number;
}

const EPSILON = 0.01;

export function getPartyDue(party: Party): number {
  let due = 0;
  for (const c of party.creditLedgers || []) {
    if (c.status === 'SETTLED') continue;
    const amt = Number(c.amountDue || 0);
    due += c.type === 'RECEIVABLE' ? amt : -amt;
  }
  return due;
}

export function getPartyPayable(party: Party): number {
  let payable = 0;
  for (const c of party.creditLedgers || []) {
    if (c.status !== 'SETTLED' && c.type === 'PAYABLE') {
      payable += Number(c.amountDue || 0);
    }
  }
  return payable;
}

export function buildPartyRows(parties: Party[] | null | undefined): PartyRow[] {
  if (!Array.isArray(parties)) return [];
  const rows: PartyRow[] = [];
  for (const party of parties) {
    // Defensive: a malformed entry must never take the whole screen down.
    if (!party || typeof party !== 'object') continue;
    const phone = typeof party.phone === 'string' ? party.phone : '';
    rows.push({
      party,
      due: getPartyDue(party),
      payable: getPartyPayable(party),
      isWalkIn: party.isSaved === false,
      nameLower: String(party.name || '').toLowerCase(),
      gstinLower: String(party.gstin || '').toLowerCase(),
      addressLower: String(party.address || '').toLowerCase(),
      phone,
      phoneDigits: phone.replace(/\D/g, ''),
    });
  }
  return rows;
}

export function matchesDueFilter(row: PartyRow, filter: PartyDueFilter): boolean {
  switch (filter) {
    case 'DUES':
      return row.due > EPSILON;
    case 'PAYABLES':
      return row.due < -EPSILON || row.payable > EPSILON;
    case 'CLEARED':
      return Math.abs(row.due) <= EPSILON && row.payable <= EPSILON;
    default:
      return true;
  }
}

export function countRows(rows: PartyRow[]): PartyRowCounts {
  const counts: PartyRowCounts = {
    total: rows.length,
    dues: 0,
    payables: 0,
    cleared: 0,
    registered: 0,
    unregistered: 0,
  };
  for (const row of rows) {
    if (matchesDueFilter(row, 'DUES')) counts.dues += 1;
    if (matchesDueFilter(row, 'PAYABLES')) counts.payables += 1;
    if (matchesDueFilter(row, 'CLEARED')) counts.cleared += 1;
    if (row.isWalkIn) counts.unregistered += 1;
    else counts.registered += 1;
  }
  return counts;
}

function matchesSearch(row: PartyRow, q: string, qDigits: string): boolean {
  if (!q) return true;
  if (row.nameLower.includes(q) || row.gstinLower.includes(q) || row.addressLower.includes(q)) {
    return true;
  }
  if (row.phone.includes(q)) return true;

  if (qDigits.length >= 3 && row.phoneDigits.length > 0) {
    if (row.phoneDigits.includes(qDigits) || qDigits.includes(row.phoneDigits)) return true;
    if (qDigits.length >= 10 && row.phoneDigits.includes(qDigits.slice(-10))) return true;
  }
  return false;
}

export function filterPartyRows(
  rows: PartyRow[],
  options: { search: string; dueFilter: PartyDueFilter; regFilter: PartyRegFilter },
): PartyRow[] {
  const q = options.search.toLowerCase().trim();
  const qDigits = q.replace(/\D/g, '');

  return rows.filter((row) => {
    if (!matchesSearch(row, q, qDigits)) return false;
    if (options.regFilter === 'REGISTERED' && row.isWalkIn) return false;
    if (options.regFilter === 'UNREGISTERED' && !row.isWalkIn) return false;
    return matchesDueFilter(row, options.dueFilter);
  });
}
