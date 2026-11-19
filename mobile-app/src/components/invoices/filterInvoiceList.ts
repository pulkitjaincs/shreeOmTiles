import { InvoiceListEntry } from './types';

export interface InvoiceListFilterValues {
  search: string;
  status: string;
  paymentMode: string;
  createdById?: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
}

export function filterInvoiceList(
  invoices: InvoiceListEntry[],
  filters: InvoiceListFilterValues,
  now = new Date(),
): InvoiceListEntry[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const normalizedPhoneSearch = normalizedSearch.replace(/\D/g, '');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const endOfYesterday = new Date(startOfToday.getTime() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const customStart = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
  const customEnd = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;

  return invoices.filter((invoice) => {
    const matchesSearch =
      !normalizedSearch ||
      String(invoice.invoiceNo || '').toLowerCase().includes(normalizedSearch) ||
      String(invoice.party?.name || '').toLowerCase().includes(normalizedSearch) ||
      (normalizedPhoneSearch.length > 0 &&
        String(invoice.party?.phone || '').replace(/\D/g, '').includes(normalizedPhoneSearch));

    const matchesStatus =
      filters.status === 'ALL' ||
      (filters.status === 'REFUNDED'
        ? invoice.status === 'REFUNDED' || (Array.isArray(invoice.refundInvoices) && invoice.refundInvoices.length > 0)
        : invoice.status === filters.status);
    const matchesMode =
      filters.paymentMode === 'ALL' ||
      invoice.paymentMode === filters.paymentMode ||
      (invoice.paymentMode === 'SPLIT' &&
        Array.isArray(invoice.payments) &&
        invoice.payments.some((p: any) => p.mode === filters.paymentMode));
    const date = new Date(invoice.invoiceDate || invoice.createdAt);
    const matchesPreset =
      filters.datePreset === 'ALL' ||
      (filters.datePreset === 'TODAY' && date >= startOfToday && date <= endOfToday) ||
      (filters.datePreset === 'YESTERDAY' && date >= startOfYesterday && date <= endOfYesterday) ||
      (filters.datePreset === 'THIS_WEEK' && date >= startOfWeek && date <= endOfWeek) ||
      (filters.datePreset === 'THIS_MONTH' && date >= startOfMonth && date <= endOfMonth);
    const matchesCustom =
      filters.datePreset !== 'CUSTOM' ||
      ((!customStart || (Number.isFinite(customStart.getTime()) && date >= customStart)) &&
        (!customEnd || (Number.isFinite(customEnd.getTime()) && date <= customEnd)));

    const matchesCreator =
      !filters.createdById ||
      filters.createdById === 'ALL' ||
      invoice.salesmanId === filters.createdById ||
      (invoice as any).createdById === filters.createdById;

    return matchesSearch && matchesStatus && matchesMode && matchesCreator && matchesPreset && matchesCustom;
  });
}
