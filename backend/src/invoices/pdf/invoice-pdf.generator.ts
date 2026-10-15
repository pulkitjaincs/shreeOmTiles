import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';
import {
  GeneratedPdfResult,
  InvoicePdfPayload,
  safePdfText,
  TaxBreakupData,
} from './pdf-utils';

export async function generateInvoicePdf(
  invoice: InvoicePdfPayload,
): Promise<GeneratedPdfResult> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 Standard
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Elegant Design Palette
  const primaryColor = rgb(0.08, 0.18, 0.42); // Deep Navy
  const secondaryColor = rgb(0.18, 0.35, 0.65);
  const textColor = rgb(0.12, 0.14, 0.18);
  const grayColor = rgb(0.45, 0.48, 0.53);
  const lightGray = rgb(0.94, 0.95, 0.97);
  const lineGray = rgb(0.84, 0.87, 0.92);
  const cardBg = rgb(0.98, 0.985, 0.995);
  const cardBorder = rgb(0.85, 0.88, 0.93);

  const companyName = process.env.COMPANY_NAME || 'SHREE OM TILES';
  const companyAddress =
    process.env.COMPANY_ADDRESS ||
    'Shop 1-3, Main Commercial Complex, Ring Road';
  const companyGstin = process.env.COMPANY_GSTIN || '07AAAAA0000A1Z5';
  const companyPhone = process.env.COMPANY_PHONE || '+91 9876543210';

  // Compact Return QR payload
  const qrPayload = JSON.stringify({
    inv: invoice.invoiceNo,
    id: invoice.id,
    date:
      invoice.createdAt instanceof Date
        ? invoice.createdAt.toISOString().slice(0, 10)
        : String(invoice.createdAt).slice(0, 10),
    total: Number(invoice.total),
    action: 'shreeom://return',
  });
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    width: 140,
    margin: 1,
  });
  const qrImage = await doc.embedPng(qrBuffer);

  const leftMargin = 40;
  const rightMargin = width - 40; // 555.28
  const contentWidth = rightMargin - leftMargin; // 515.28

  // 1. Header (Brand, Invoice Info, and Return QR)
  const topY = height - 38;

  // Company Brand Name & Subtitle
  page.drawText(safePdfText(companyName), {
    x: leftMargin,
    y: topY,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(safePdfText('Premium Tiles, Marbles & Sanitaryware'), {
    x: leftMargin,
    y: topY - 14,
    size: 8,
    font: fontBold,
    color: secondaryColor,
  });
  page.drawText(safePdfText(companyAddress), {
    x: leftMargin,
    y: topY - 25,
    size: 8,
    font: fontRegular,
    color: grayColor,
  });
  page.drawText(
    safePdfText(`GSTIN: ${companyGstin}   |   Phone: ${companyPhone}`),
    {
      x: leftMargin,
      y: topY - 36,
      size: 8,
      font: fontRegular,
      color: grayColor,
    },
  );

  // Tax Invoice Metadata Badge (Center-Right)
  const metaX = 330;
  page.drawText('TAX INVOICE', {
    x: metaX,
    y: topY,
    size: 13,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(safePdfText(`Invoice #: ${invoice.invoiceNo}`), {
    x: metaX,
    y: topY - 14,
    size: 9.5,
    font: fontBold,
    color: textColor,
  });
  const invDateStr =
    invoice.createdAt instanceof Date
      ? invoice.createdAt.toISOString().slice(0, 10)
      : String(invoice.createdAt).slice(0, 10);
  page.drawText(safePdfText(`Date: ${invDateStr}`), {
    x: metaX,
    y: topY - 26,
    size: 8,
    font: fontRegular,
    color: grayColor,
  });
  page.drawText(safePdfText(`Place of Supply: Delhi (07)`), {
    x: metaX,
    y: topY - 37,
    size: 8,
    font: fontRegular,
    color: grayColor,
  });

  // Verification & Return QR Box
  const qrSize = 52;
  const qrX = rightMargin - qrSize;
  const qrY = topY - 44;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const qrLabel = 'Scan for Return';
  const qrLabelW = fontRegular.widthOfTextAtSize(qrLabel, 6.5);
  page.drawText(qrLabel, {
    x: qrX + (qrSize - qrLabelW) / 2,
    y: qrY - 8,
    size: 6.5,
    font: fontRegular,
    color: grayColor,
  });

  // Header separator line
  page.drawLine({
    start: { x: leftMargin, y: topY - 56 },
    end: { x: rightMargin, y: topY - 56 },
    thickness: 0.75,
    color: lineGray,
  });

  // 2. Structured Dual Metadata Cards (Spacious, No Overlaps)
  const cardTopY = topY - 66;
  const cardH = 72; // Generous height to prevent any line crowding
  const cardW = (contentWidth - 14) / 2; // 250.64 each

  // Buyer Details Box (Left)
  page.drawRectangle({
    x: leftMargin,
    y: cardTopY - cardH,
    width: cardW,
    height: cardH,
    color: cardBg,
    borderColor: cardBorder,
    borderWidth: 0.75,
  });
  page.drawText('BILL TO (BUYER DETAILS)', {
    x: leftMargin + 10,
    y: cardTopY - 14,
    size: 7.5,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(
    safePdfText((invoice.party?.name || 'Walk-in Customer').slice(0, 36)),
    {
      x: leftMargin + 10,
      y: cardTopY - 28,
      size: 9,
      font: fontBold,
      color: textColor,
    },
  );
  page.drawText(safePdfText(`Mobile: ${invoice.party?.phone || 'N/A'}`), {
    x: leftMargin + 10,
    y: cardTopY - 41,
    size: 8,
    font: fontRegular,
    color: textColor,
  });
  const partyAddr = (invoice.party?.address || 'Counter Billing').slice(0, 38);
  page.drawText(safePdfText(`Address: ${partyAddr}`), {
    x: leftMargin + 10,
    y: cardTopY - 54,
    size: 7.5,
    font: fontRegular,
    color: grayColor,
  });
  if (invoice.party?.gstin) {
    page.drawText(safePdfText(`GSTIN: ${invoice.party.gstin}`), {
      x: leftMargin + 10,
      y: cardTopY - 65,
      size: 7,
      font: fontRegular,
      color: grayColor,
    });
  }

  // Dispatch & Payment Details Box (Right)
  const rightBoxX = leftMargin + cardW + 14;
  page.drawRectangle({
    x: rightBoxX,
    y: cardTopY - cardH,
    width: cardW,
    height: cardH,
    color: cardBg,
    borderColor: cardBorder,
    borderWidth: 0.75,
  });
  page.drawText('DISPATCH & PAYMENT DETAILS', {
    x: rightBoxX + 10,
    y: cardTopY - 14,
    size: 7.5,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(
    safePdfText(`Sales Advisor: ${invoice.salesman?.name || 'Store Cashier'}`),
    {
      x: rightBoxX + 10,
      y: cardTopY - 28,
      size: 8,
      font: fontRegular,
      color: textColor,
    },
  );
  page.drawText(safePdfText(`Payment Mode: ${invoice.paymentMode || 'CASH'}`), {
    x: rightBoxX + 10,
    y: cardTopY - 41,
    size: 8,
    font: fontRegular,
    color: textColor,
  });
  page.drawText(safePdfText(`Billing Status: ${invoice.status}`), {
    x: rightBoxX + 10,
    y: cardTopY - 54,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(
    safePdfText(
      `Notes: ${(invoice.notes || 'Goods dispatched in good condition').slice(0, 36)}`,
    ),
    {
      x: rightBoxX + 10,
      y: cardTopY - 65,
      size: 7,
      font: fontRegular,
      color: grayColor,
    },
  );

  // 3. Line Items Table Header (Neat, Crisp & Well Spaced)
  const tableHeaderY = cardTopY - cardH - 14;
  const headerHeight = 20;
  page.drawRectangle({
    x: leftMargin,
    y: tableHeaderY - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: rgb(0.92, 0.94, 0.98),
    borderColor: rgb(0.78, 0.83, 0.92),
    borderWidth: 0.75,
  });

  const headerY = tableHeaderY - 13;
  page.drawText('#', {
    x: leftMargin + 6,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText('Item Description', {
    x: leftMargin + 25,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText('HSN', {
    x: leftMargin + 195,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText('Godown / Lot', {
    x: leftMargin + 245,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });

  const qtyHdr = 'Qty';
  const qtyHdrW = fontBold.widthOfTextAtSize(qtyHdr, 8);
  page.drawText(qtyHdr, {
    x: leftMargin + 375 - qtyHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });

  const rateHdr = 'Rate (Rs.)';
  const rateHdrW = fontBold.widthOfTextAtSize(rateHdr, 8);
  page.drawText(rateHdr, {
    x: leftMargin + 445 - rateHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });

  const totalHdr = 'Amount (Rs.)';
  const totalHdrW = fontBold.widthOfTextAtSize(totalHdr, 8);
  page.drawText(totalHdr, {
    x: rightMargin - 8 - totalHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });

  // 4. Line Items Rows (Spacious 22pt row height, Zero Overlaps)
  let y = tableHeaderY - headerHeight - 16;
  const rowHeight = 22;
  let idx = 1;

  for (const item of invoice.items || []) {
    const idxStr = String(idx).padStart(2, '0');
    const hsn = item.product?.hsnCode || '-';
    const whBatch = `${item.warehouse?.name || 'Showroom'}${item.batchNo ? ` (${item.batchNo})` : ''}`;
    const qtyStr = `${item.qty} ${item.product?.unit || 'unit'}`;
    const rateStr = Number(item.unitPrice).toFixed(2);
    const lineTotalStr = Number(item.total).toFixed(2);

    page.drawText(idxStr, {
      x: leftMargin + 6,
      y,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });

    page.drawText(safePdfText((item.product?.name || 'Item').slice(0, 32)), {
      x: leftMargin + 25,
      y,
      size: 8.5,
      font: fontBold,
      color: textColor,
    });

    page.drawText(safePdfText(hsn), {
      x: leftMargin + 195,
      y,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });

    page.drawText(safePdfText(whBatch.slice(0, 20)), {
      x: leftMargin + 245,
      y,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });

    // Right-aligned numerical columns
    const qw = fontRegular.widthOfTextAtSize(qtyStr, 8);
    page.drawText(safePdfText(qtyStr), {
      x: leftMargin + 375 - qw,
      y,
      size: 8,
      font: fontRegular,
      color: textColor,
    });

    const rw = fontRegular.widthOfTextAtSize(rateStr, 8.5);
    page.drawText(safePdfText(rateStr), {
      x: leftMargin + 445 - rw,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });

    const tw = fontBold.widthOfTextAtSize(lineTotalStr, 8.5);
    page.drawText(safePdfText(lineTotalStr), {
      x: rightMargin - 8 - tw,
      y,
      size: 8.5,
      font: fontBold,
      color: textColor,
    });

    // Subtle row divider line
    page.drawLine({
      start: { x: leftMargin, y: y - 6 },
      end: { x: rightMargin, y: y - 6 },
      thickness: 0.5,
      color: lightGray,
    });

    y -= rowHeight;
    idx++;
  }

  y -= 8;

  // 5. Financial Summary Box (Explicit GST Tax Breakup & Grand Total)
  const taxBreakup = (invoice.taxBreakup as unknown as TaxBreakupData) || {};
  const subtotalStr = Number(invoice.subtotal).toFixed(2);
  const taxStr = Number(invoice.tax).toFixed(2);
  const totalStr = Number(invoice.total).toFixed(2);
  const taxRate = taxBreakup.rate ?? 18;

  const sumBoxW = 220;
  const sumBoxX = rightMargin - sumBoxW;

  // Subtotal line
  page.drawText('Subtotal (Taxable Value):', {
    x: sumBoxX,
    y,
    size: 8.5,
    font: fontRegular,
    color: grayColor,
  });
  const subVal = `Rs. ${subtotalStr}`;
  const subValW = fontRegular.widthOfTextAtSize(subVal, 8.5);
  page.drawText(subVal, {
    x: rightMargin - subValW,
    y,
    size: 8.5,
    font: fontRegular,
    color: textColor,
  });
  y -= 14;

  // Tax breakdown with explicit percentage
  if (taxBreakup.isInterState) {
    page.drawText(`Integrated GST (IGST ${taxRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const igstVal = `Rs. ${taxStr}`;
    const igstValW = fontRegular.widthOfTextAtSize(igstVal, 8.5);
    page.drawText(igstVal, {
      x: rightMargin - igstValW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;
  } else {
    const halfTax = (Number(invoice.tax) / 2).toFixed(2);
    const halfRate = taxRate / 2;
    page.drawText(`Central GST (CGST ${halfRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const cgstVal = `Rs. ${halfTax}`;
    const cgstValW = fontRegular.widthOfTextAtSize(cgstVal, 8.5);
    page.drawText(cgstVal, {
      x: rightMargin - cgstValW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;

    page.drawText(`State GST (SGST ${halfRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const sgstVal = `Rs. ${halfTax}`;
    const sgstValW = fontRegular.widthOfTextAtSize(sgstVal, 8.5);
    page.drawText(sgstVal, {
      x: rightMargin - sgstValW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;
  }

  // Grand Total Card Box
  const grandBoxH = 24;
  page.drawRectangle({
    x: sumBoxX - 8,
    y: y - 6,
    width: sumBoxW + 8,
    height: grandBoxH,
    color: rgb(0.92, 0.95, 0.99),
    borderColor: rgb(0.72, 0.8, 0.92),
    borderWidth: 0.75,
  });

  page.drawText('GRAND TOTAL:', {
    x: sumBoxX,
    y: y + 2,
    size: 9.5,
    font: fontBold,
    color: primaryColor,
  });
  const totalVal = `Rs. ${totalStr}`;
  const totalValW = fontBold.widthOfTextAtSize(totalVal, 10.5);
  page.drawText(totalVal, {
    x: rightMargin - totalValW,
    y: y + 2,
    size: 10.5,
    font: fontBold,
    color: primaryColor,
  });

  // 6. Bottom Terms & Conditions & Signatory Section
  const footerY = 56;
  page.drawLine({
    start: { x: leftMargin, y: footerY + 16 },
    end: { x: rightMargin, y: footerY + 16 },
    thickness: 0.75,
    color: lineGray,
  });

  page.drawText('Terms & Conditions:', {
    x: leftMargin,
    y: footerY + 5,
    size: 7.5,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(
    '1. Unbroken, undamaged full boxes returnable within 7 days with this invoice QR code.',
    {
      x: leftMargin,
      y: footerY - 6,
      size: 6.5,
      font: fontRegular,
      color: grayColor,
    },
  );
  page.drawText(
    '2. Please inspect shade, size and batch lot prior to laying tiles. No claims accepted after installation.',
    {
      x: leftMargin,
      y: footerY - 16,
      size: 6.5,
      font: fontRegular,
      color: grayColor,
    },
  );

  // Signatory Box
  const sigX = rightMargin - 160;
  page.drawText(`For ${companyName}`, {
    x: sigX,
    y: footerY + 5,
    size: 8,
    font: fontBold,
    color: textColor,
  });
  page.drawLine({
    start: { x: sigX, y: footerY - 8 },
    end: { x: rightMargin, y: footerY - 8 },
    thickness: 0.5,
    color: lineGray,
  });
  page.drawText('[ Authorized Signatory ]', {
    x: sigX + 18,
    y: footerY - 18,
    size: 6.5,
    font: fontRegular,
    color: grayColor,
  });

  const pdfBytes = await doc.save();
  return { pdfBytes, invoiceNo: invoice.invoiceNo };
}
