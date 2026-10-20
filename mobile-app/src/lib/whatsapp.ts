import { cleanPhoneNumber, formatINR, getInvoicePaidAmount } from './formatters';

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
 * Builds store payable debt communication WhatsApp URL.
 */
export function buildStorePayableInquiryUrl(params: {
  phone?: string | null;
  partyName: string;
  amount: number;
  debtRef?: string;
}): string {
  const { phone, partyName, amount, debtRef } = params;
  const refText = debtRef ? ` (Ref: ${debtRef})` : '';
  const msg =
    `Dear *${partyName || 'Party'}*,\n\n` +
    `Regarding the pending store disbursement of *${formatINR(amount)}*${refText} from *Shree Om Tiles*:\n\n` +
    `Please share your updated bank account or UPI VPA details for processing the payment transfer.\n\n` +
    `Thank you!\n` +
    `*Shree Om Tiles Accounts*`;

  const clean = cleanPhoneNumber(phone);
  return clean
    ? `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`
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
    (balanceDue > 0
      ? `• *Balance Due:* ${formatINR(balanceDue)}\n\n`
      : `• *Status:* Fully Paid ✓\n\n`) +
    `For any queries or delivery assistance, please reach out to us.\n\n` +
    `*Shree Om Tiles*`;

  const cleanPhone = cleanPhoneNumber(customerPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Builds itemized tax invoice WhatsApp URL with full line items, tax breakdown, and payments.
 */
export function buildFullInvoiceShareUrl(invoice: any): string {
  const phone = cleanPhoneNumber(invoice.party?.phone || invoice.partyPhone);
  const partyName = invoice.party?.name || invoice.partyName || 'Customer';
  const invDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Today';

  const itemsList = (invoice.items || [])
    .map((it: any, i: number) => {
      const name = it.product?.name || it.productName || `Item #${i + 1}`;
      const qty = it.qty || 1;
      const unit = it.product?.unit || 'units';
      const rate = Number(it.unitPrice || 0);
      const total = Number(it.total ?? (qty * rate - (it.discount || 0)));
      return `  ${i + 1}. *${name}*\n     ${qty} ${unit} × ₹${rate.toFixed(2)} = *₹${total.toFixed(2)}*`;
    })
    .join('\n');

  const totalVal = Number(invoice.total || 0).toFixed(2);
  const paidVal = getInvoicePaidAmount(invoice).toFixed(2);
  const dueVal = Math.max(0, Number(invoice.total || 0) - Number(paidVal)).toFixed(2);
  const subtotalVal = Number(invoice.subtotal || 0).toFixed(2);
  const transportCostVal = Number(invoice.transportCost || 0).toFixed(2);
  const transportTaxVal = Number(invoice.transportTax || 0).toFixed(2);
  const itemTaxVal = Math.max(
    0,
    Number(invoice.tax ?? invoice.taxAmount ?? 0) - Number(transportTaxVal),
  ).toFixed(2);
  const totalTax = Number(invoice.tax ?? invoice.taxAmount ?? 0);
  const taxRateNumber = Number(invoice.taxRate ?? invoice.taxBreakup?.rate ?? 0);
  const hasTax = totalTax > 0.005;
  const taxRateVal = `${taxRateNumber}%`;

  const msg = [
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
    itemsList || `  • Standard Order (${formatINR(invoice.total)})`,
    `----------------------------------------`,
    Number(subtotalVal) > 0 ? `Subtotal: ₹${subtotalVal}` : '',
    Number(transportCostVal) > 0 ? `Transport / Cartage: ₹${transportCostVal}` : '',
    hasTax && Number(itemTaxVal) > 0 ? `GST on Taxable Bill (${taxRateVal}): ₹${itemTaxVal}` : '',
    hasTax && Number(transportTaxVal) > 0 ? `Transport GST: ₹${transportTaxVal}` : '',
    `*Grand Total: ₹${totalVal}*`,
    `Paid: ₹${paidVal}`,
    Number(dueVal) > 0 ? `*Balance Due: ₹${dueVal}*` : `*Status: Fully Paid (✓)*`,
    invoice.notes ? `\n📝 Note: ${invoice.notes}` : '',
    `----------------------------------------`,
    `Thank you for your business! 🙏`,
  ]
    .filter(Boolean)
    .join('\n');

  return phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
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
        `• ${it.productName} — ${it.qty} ${it.unit || 'unit'} (${it.warehouseName || 'Warehouse'})`,
    )
    .join('\n');

  const msg =
    `📦 *DELIVERY ASSIGNMENT*\n\n` +
    `• *Customer:* ${partyName || 'Customer'} (${partyPhone || 'N/A'})\n` +
    `• *Destination:* ${partyAddress || 'Counter Pickup / Direct Delivery'}\n\n` +
    `*Items to Collect & Deliver:*\n${itemsText || '• Items as per invoice'}\n\n` +
    `💰 *Cash to Collect:* ${formatINR(amountToCollect)}\n\n` +
    `_Instructions: Collect items from warehouses and verify before delivery._\n\n` +
    `*Shree Om Tiles Logistics*`;

  const cleanPhone = cleanPhoneNumber(driverPhone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Builds full multi-warehouse delivery manifest WhatsApp URL directly from a Delivery record.
 */
export function buildFullDeliveryManifestShareUrl(delivery: any): string {
  const inv = delivery.invoice;
  const party = inv?.party;

  const rawItems =
    delivery.items && delivery.items.length > 0
      ? delivery.items
      : delivery.invoice?.items?.map((it: any) => ({
          productId: it.productId,
          productName: it.product?.name || 'Item',
          unit: it.product?.unit || 'units',
          warehouseName: it.warehouse?.name || 'Warehouse',
          warehouseAddress: it.warehouse?.address || '',
          batchNo: it.batchNo,
          qty: it.qty,
        })) || [];

  const itemsList = rawItems
    .map((item: any, idx: number) => {
      const whName = item.warehouseName || 'Warehouse';
      const whAddr = item.warehouseAddress ? ` (${item.warehouseAddress})` : '';
      const batch = item.batchNo ? ` [Lot/Batch: ${item.batchNo}]` : '';
      return `${idx + 1}. *${item.productName || 'Item'}* — *${item.qty} ${item.unit || 'units'}*\n   📍 *Pick from:* ${whName}${whAddr}${batch}`;
    })
    .join('\n\n');

  const toCollect = Number(delivery.amountToCollect || 0);
  const paymentLine =
    toCollect > 0
      ? `💵 *AMOUNT TO COLLECT FROM CUSTOMER:* *${formatINR(toCollect)}* (Collect from customer before handover)`
      : `💵 *PAYMENT:* Already Settled / Collect ₹0`;

  const msg =
    `📦 *DELIVERY ASSIGNMENT — DISPATCH RUN*\n` +
    `*Invoice:* #${inv?.invoiceNo || 'N/A'}\n\n` +
    `${paymentLine}\n\n` +
    `👤 *RECEIVER DETAILS:*\n` +
    `• *Customer Name:* ${party?.name || 'Customer'}\n` +
    `• *Phone:* ${party?.phone || 'N/A'}\n` +
    `• *Delivery Address:* ${party?.address || 'Counter Pickup / Direct Delivery'}\n\n` +
    `🏭 *ITEMS TO PICK UP FROM WAREHOUSES:*\n` +
    `${itemsList || '• Standard delivery items'}\n\n` +
    `⏰ *Next Steps:*\n` +
    `1. Reach respective warehouses and pick up each item.\n` +
    `2. Mark items as picked up on your mobile app.\n` +
    `3. Deliver to customer and collect specified payment.`;

  const cleanPhone = cleanPhoneNumber(delivery.driver?.phone);
  return cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
