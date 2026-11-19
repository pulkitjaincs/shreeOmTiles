import { cleanPhoneNumber, formatINR } from './formatters';

export interface DispatchItemInfo {
  productName: string;
  qty: number;
  unit?: string;
  warehouseName?: string;
}

/**
 * Builds customer dues payment reminder WhatsApp URL.
 */
export function buildCustomerDuesReminderUrl(params: {
  phone?: string | null;
  name: string;
  amount: number;
  invoiceNo?: string;
}): string {
  const { phone, name, amount, invoiceNo } = params;
  const refText = invoiceNo ? ` (Ref #${invoiceNo})` : '';
  const msg =
    `Dear *${name || 'Customer'}*,\n\n` +
    `This is a friendly payment reminder from *Shree Om Tiles* regarding your outstanding balance of *${formatINR(amount)}*${refText}.\n\n` +
    `Kindly arrange payment clearance via UPI or Counter Cash at your convenience.\n\n` +
    `Thank you for your business! 🙏\n` +
    `*Shree Om Tiles*`;

  const clean = cleanPhoneNumber(phone);
  return clean
    ? `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Builds customer payment receipt WhatsApp message URL.
 */
export function buildPaymentReceiptShareUrl(params: {
  phone?: string | null;
  customerName: string;
  amount: number | string;
  mode: string;
  invoiceNo?: string;
  utr?: string | null;
  date?: string;
}): string {
  const { phone, customerName, amount, mode, invoiceNo, utr, date } = params;
  const amtFormatted = typeof amount === 'number' ? formatINR(amount) : formatINR(parseFloat(amount) || 0);

  const lines = [
    `🧾 *PAYMENT RECEIPT CONFIRMATION*`,
    ``,
    `Dear *${customerName || 'Customer'}*,`,
    `Thank you! We have received your payment:`,
    ``,
    `• *Amount Received:* ${amtFormatted}`,
    `• *Payment Mode:* ${mode || 'UPI / Cash'}`,
    date ? `• *Date:* ${date}` : null,
    invoiceNo ? `• *Against Invoice:* #${invoiceNo}` : null,
    utr ? `• *Transaction Ref / UTR:* ${utr}` : null,
    ``,
    `Your transaction has been recorded and settled in our system.`,
    ``,
    `*Shree Om Tiles*`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const clean = cleanPhoneNumber(phone);
  return clean
    ? `https://wa.me/91${clean}?text=${encodeURIComponent(lines)}`
    : `https://wa.me/?text=${encodeURIComponent(lines)}`;
}

/**
 * Builds customer account ledger statement WhatsApp message URL.
 */
export function buildPartyStatementShareUrl(params: {
  phone?: string | null;
  name: string;
  gstin?: string | null;
  address?: string | null;
  lifetimeTotal: number;
  totalReceived: number;
  totalDues: number;
  totalOrders: number;
}): string {
  const { phone, name, gstin, address, lifetimeTotal, totalReceived, totalDues, totalOrders } = params;
  const isDue = totalDues > 0.01;
  const isPayable = totalDues < -0.01;
  const payableAmt = Math.abs(totalDues);

  const msg =
    `*ACCOUNT STATEMENT — SHREE OM TILES*\n\n` +
    `Customer: *${name || 'Customer'}*\n` +
    (phone ? `Phone: ${phone}\n` : '') +
    (gstin ? `GSTIN: ${gstin}\n` : '') +
    (address ? `Address: ${address}\n` : '') +
    `\n*Financial Summary:*\n` +
    `• Lifetime Billing: ${formatINR(lifetimeTotal)}\n` +
    `• Total Received: ${formatINR(totalReceived)}\n` +
    (isDue
      ? `• *Current Balance Due: ${formatINR(totalDues)}*\n`
      : isPayable
      ? `• *Store Credit / Payable Available: ${formatINR(payableAmt)}*\n`
      : `• *Account Balance: ₹0.00 (All Clear)*\n`) +
    `• Total Orders: ${totalOrders}\n\n` +
    (isDue
      ? `Kindly arrange payment clearance of ${formatINR(totalDues)} at your earliest convenience.\n\n`
      : isPayable
      ? `You have an available store credit / payable balance of ${formatINR(payableAmt)} with Shree Om Tiles.\n\n`
      : `All accounts are currently in clear standing!\n\n`) +
    `*Shree Om Tiles*`;

  const clean = cleanPhoneNumber(phone);
  return clean
    ? `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Builds standard driver dispatch WhatsApp URL with formatted manifest.
 */
export function buildDriverDispatchUrl(
  driverPhone: string | null | undefined,
  partyName: string,
  partyPhone: string,
  partyAddress: string,
  items: DispatchItemInfo[],
  amountToCollect: number,
): string {
  const itemsText = items
    .map(
      (it) =>
        `• ${it.productName} — ${it.qty} ${it.unit || 'unit'}`,
    )
    .join('\n');

  const msg =
    `📦 *DELIVERY ASSIGNMENT*\n\n` +
    `• *Customer:* ${partyName || 'Customer'} (${partyPhone || 'N/A'})\n` +
    `• *Destination:* ${partyAddress || 'Counter Pickup / Direct Delivery'}\n\n` +
    `*Items to Collect & Deliver:*\n${itemsText || '• Items as per invoice'}\n\n` +
    `💰 *Cash to Collect:* ${formatINR(amountToCollect)}\n\n` +
    `_Instructions: Collect items and verify with assigned dispatch supervisor(s) before departure._\n\n` +
    `*Shree Om Tiles Logistics*`;

  const cleanPhone = cleanPhoneNumber(driverPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Builds standard customer invoice WhatsApp message URL.
 */
export function buildInvoiceShareUrl(
  customerPhone: string | null | undefined,
  invoiceNo: string,
  customerName: string,
  totalAmount: number,
  paidAmount: number,
  balanceDue: number,
): string {
  const msg =
    `🧾 *INVOICE #${invoiceNo}*\n\n` +
    `Dear *${customerName || 'Customer'}*,\n` +
    `Thank you for your purchase with *Shree Om Tiles*!\n\n` +
    `• *Invoice No:* ${invoiceNo}\n` +
    `• *Total Amount:* ${formatINR(totalAmount)}\n` +
    `• *Amount Paid:* ${formatINR(paidAmount)}\n` +
    (balanceDue > 0 ? `• *Balance Due:* ${formatINR(balanceDue)}\n\n` : `• *Status:* Fully Paid ✓\n\n`) +
    `For any queries or delivery assistance, please reach out to us.\n\n` +
    `*Shree Om Tiles*`;

  const cleanPhone = cleanPhoneNumber(customerPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function buildFullInvoiceMessage(invoice: any): string {
  const partyName = invoice.party?.name || invoice.partyName || 'Customer';
  const rawDate = invoice.invoiceDate || invoice.createdAt;
  const invDate = rawDate
    ? new Date(rawDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Today';
  const itemsList = (invoice.items || [])
    .map((item: any, index: number) => {
      const name = item.product?.name || item.productName || `Item #${index + 1}`;
      const qty = Number(item.qty || 1);
      const unit = item.product?.unit || 'units';
      const rate = Number(item.unitPrice || 0);
      const total = Number(item.total ?? qty * rate);
      return `  ${index + 1}. *${name}*\n     ${qty} ${unit} × ₹${rate.toFixed(2)} = *₹${total.toFixed(2)}*`;
    })
    .join('\n');
  const total = Number(invoice.total || 0);
  const explicitPaid = Number(invoice.paidAmount ?? invoice.amountPaid);
  const paid = Number.isFinite(explicitPaid)
    ? Math.max(0, explicitPaid)
    : (invoice.payments || [])
        .filter((payment: any) => payment.status === 'CONFIRMED' && payment.type !== 'OUTFLOW')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discountAmount || 0);
  const transport = Number(invoice.transportCost || 0);
  const transportTax = Number(invoice.transportTax || 0);
  const tax = Number(invoice.tax ?? invoice.taxAmount ?? 0);
  const itemTax = Math.max(0, tax - transportTax);
  const hasTax = tax > 0.005;
  const taxRate = Number(invoice.taxRate ?? invoice.taxBreakup?.rate ?? 0);
  const due = Math.max(0, total - paid);

  return [
    `*SHREE OM TILES*`,
    `📍Order Confirmation`,
    `----------------------------------------`,
    `📄 *Invoice No:* #${invoice.invoiceNo}`,
    `📅 *Date:* ${invDate}`,
    `👤 *Customer:* ${partyName}`,
    invoice.party?.phone ? `📞 *Phone:* ${invoice.party.phone}` : '',
    invoice.party?.address ? `🏠 *Address:* ${invoice.party.address}` : '',
    `----------------------------------------`,
    `📦 *ORDER ITEMS:*`,
    itemsList || `  • Standard Order (${formatINR(total)})`,
    `----------------------------------------`,
    subtotal > 0 ? `Items Subtotal: ₹${subtotal.toFixed(2)}` : '',
    discount > 0 ? `Bill Discount: -₹${discount.toFixed(2)}` : '',
    discount > 0 ? `Taxable Amount: ₹${Math.max(0, subtotal - discount).toFixed(2)}` : '',
    transport > 0 ? `Transport / Cartage: ₹${transport.toFixed(2)}` : '',
    hasTax && itemTax > 0 ? `GST on Taxable Bill (${taxRate}%): ₹${itemTax.toFixed(2)}` : '',
    hasTax && transportTax > 0 ? `Transport GST: ₹${transportTax.toFixed(2)}` : '',
    `*Grand Total: ₹${total.toFixed(2)}*`,
    `Paid: ₹${paid.toFixed(2)}`,
    due > 0 ? `*Balance Due: ₹${due.toFixed(2)}*` : `*Status: Fully Paid (✓)*`,
    invoice.notes ? `\n📝 Note: ${invoice.notes}` : '',
    `----------------------------------------`,
    `Thank you for your business! 🙏`,
  ].filter(Boolean).join('\n');
}

export function buildFullInvoiceShareUrl(invoice: any): string {
  const msg = buildFullInvoiceMessage(invoice);
  const cleanPhone = cleanPhoneNumber(invoice.party?.phone || invoice.partyPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
