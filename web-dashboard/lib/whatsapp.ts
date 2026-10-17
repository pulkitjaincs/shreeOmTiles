import { cleanPhoneNumber } from './formatters';

export interface DispatchItemInfo {
  productName: string;
  qty: number;
  unit?: string;
  warehouseName?: string;
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
