import { Prisma } from '@prisma/client';

export interface TaxBreakupSubItem {
  rate?: number;
  taxable?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax?: number;
}

export interface TaxBreakupData {
  rate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  isInterState?: boolean;
  totalTax?: number;
  items?: TaxBreakupSubItem;
  transport?: TaxBreakupSubItem;
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
}> & {
  previousBalance?: number;
};

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

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)];
    n %= 10;
    if (n > 0) str += ` ${ONES[n]}`;
  } else if (n > 0) {
    str += ONES[n];
  }
  return str;
}

export function numberToWordsIndian(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'Zero Rupees only';
  }

  const absAmount = Math.abs(amount);
  let integerPart = Math.floor(absAmount);
  const paise = Math.round((absAmount - integerPart) * 100);

  let words = '';

  const chunks: Array<{ value: number; label: string }> = [];

  // 1. Hundreds & units (0-999)
  const hundredAndBelow = integerPart % 1000;
  integerPart = Math.floor(integerPart / 1000);
  if (hundredAndBelow > 0) {
    chunks.push({ value: hundredAndBelow, label: '' });
  }

  // 2. Thousands (0-99)
  const thousands = integerPart % 100;
  integerPart = Math.floor(integerPart / 100);
  if (thousands > 0) {
    chunks.push({ value: thousands, label: 'Thousand' });
  }

  // 3. Lakhs (0-99)
  const lakhs = integerPart % 100;
  integerPart = Math.floor(integerPart / 100);
  if (lakhs > 0) {
    chunks.push({ value: lakhs, label: 'Lakh' });
  }

  // 4. Crores (>= 1)
  if (integerPart > 0) {
    chunks.push({ value: integerPart, label: 'Crore' });
  }

  const parts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const { value, label } = chunks[i];
    const chunkWords = convertLessThanThousand(value);
    if (chunkWords) {
      parts.push(label ? `${chunkWords} ${label}` : chunkWords);
    }
  }

  const rupeesStr = parts.join(' ').trim();
  const paiseStr = paise > 0 ? convertLessThanThousand(paise).trim() : '';

  if (rupeesStr && paiseStr) {
    words = `${rupeesStr} Rupees and ${paiseStr} Paise only`;
  } else if (rupeesStr) {
    words = `${rupeesStr} Rupees only`;
  } else if (paiseStr) {
    words = `${paiseStr} Paise only`;
  } else {
    words = 'Zero Rupees only';
  }

  return words;
}
