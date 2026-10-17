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
        `• ${it.productName} — ${it.qty} ${it.unit || 'unit'}${it.warehouseName ? ` (${it.warehouseName})` : ''}`,
    )
    .join('\n');

  const msg =
    `📦 *DELIVERY ASSIGNMENT*\n\n` +
    `• *Customer:* ${partyName || 'Customer'} (${partyPhone || 'N/A'})\n` +
    `• *Destination:* ${partyAddress || 'Counter Pickup / Direct Delivery'}\n\n` +
    `*Items to Collect & Deliver:*\n${itemsText || '• Items as per invoice'}\n\n` +
    `💰 *Cash to Collect:* ₹${amountToCollect.toFixed(2)}\n\n` +
    `_Instructions: Collect items and verify with assigned dispatch supervisor(s) before departure._`;

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
    `🧾 *TAX INVOICE #${invoiceNo}*\n\n` +
    `Dear ${customerName || 'Customer'},\n` +
    `Thank you for your purchase with *Shree Om Tiles*!\n\n` +
    `• *Invoice No:* ${invoiceNo}\n` +
    `• *Total Amount:* ₹${totalAmount.toFixed(2)}\n` +
    `• *Amount Paid:* ₹${paidAmount.toFixed(2)}\n` +
    (balanceDue > 0 ? `• *Balance Due:* ₹${balanceDue.toFixed(2)}\n\n` : `• *Status:* Fully Paid ✓\n\n`) +
    `For any queries or delivery assistance, please reach out to us.`;

  const cleanPhone = cleanPhoneNumber(customerPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
