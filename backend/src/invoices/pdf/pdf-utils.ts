import { Prisma } from '@prisma/client';

export interface TaxBreakupData {
  rate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  isInterState?: boolean;
}

export interface GeneratedPdfResult {
  pdfBytes: Uint8Array;
  invoiceNo: string;
}

export type InvoicePdfPayload = Prisma.InvoiceGetPayload<{
  include: {
    party: true;
    salesman: { select: { id: true; name: true; phone: true } };
    items: { include: { product: true; warehouse: true } };
    payments: true;
    refundInvoices: { include: { items: true } };
  };
}>;

export type RefundInvoicePdfPayload = Prisma.RefundInvoiceGetPayload<{
  include: {
    originalInvoice: true;
    party: true;
    createdBy: { select: { id: true; name: true; phone: true } };
    items: { include: { product: true; warehouse: true } };
    payments: true;
  };
}>;

export function safePdfText(str: unknown): string {
  if (str === null || str === undefined) return '';
  const text =
    typeof str === 'string' ? str : typeof str === 'number' ? String(str) : '';
  return text
    .replace(/₹/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u0100-\uFFFF]/g, '');
}
