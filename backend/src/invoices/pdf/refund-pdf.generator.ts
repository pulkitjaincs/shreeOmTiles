import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  GeneratedPdfResult,
  RefundInvoicePdfPayload,
  safePdfText,
  TaxBreakupData,
} from './pdf-utils';

export async function generateRefundInvoicePdf(
  refund: RefundInvoicePdfPayload,
): Promise<GeneratedPdfResult> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Credit Note / Refund Theme Palette
  const accentRed = rgb(0.72, 0.12, 0.16); // Refined Ruby / Crimson
  const primaryDark = rgb(0.12, 0.18, 0.32);
  const textColor = rgb(0.12, 0.14, 0.18);
  const grayColor = rgb(0.45, 0.48, 0.53);
  const lightGray = rgb(0.94, 0.95, 0.97);
  const lineGray = rgb(0.85, 0.88, 0.92);
  const boxBg = rgb(0.99, 0.98, 0.98);
  const boxBorder = rgb(0.92, 0.82, 0.83);

  const companyName = process.env.COMPANY_NAME || 'SHREE OM TILES';
  const companyAddress =
    process.env.COMPANY_ADDRESS ||
    'Shop 1-3, Main Commercial Complex, Ring Road';
  const companyGstin = process.env.COMPANY_GSTIN || '07AAAAA0000A1Z5';
  const companyPhone = process.env.COMPANY_PHONE || '+91 9876543210';

  const leftMargin = 40;
  const rightMargin = width - 40; // 555.28
  const contentWidth = rightMargin - leftMargin; // 515.28

  // 1. Header (Company Info & Credit Note Badge)
  const topY = height - 38;

  page.drawText(safePdfText(companyName), {
    x: leftMargin,
    y: topY,
    size: 16,
    font: fontBold,
    color: primaryDark,
  });
  page.drawText(safePdfText('Premium Tiles & Marbles'), {
    x: leftMargin,
    y: topY - 14,
    size: 8,
    font: fontBold,
    color: accentRed,
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

  // Credit Note Details Badge (Right Side)
  const metaX = 310;
  page.drawText('CREDIT NOTE / REFUND VOUCHER', {
    x: metaX,
    y: topY,
    size: 12,
    font: fontBold,
    color: accentRed,
  });
  page.drawText(safePdfText(`Credit Note #: ${refund.refundNo}`), {
    x: metaX,
    y: topY - 14,
    size: 9.5,
    font: fontBold,
    color: textColor,
  });
  const refDateStr =
    refund.createdAt instanceof Date
      ? refund.createdAt.toISOString().slice(0, 10)
      : String(refund.createdAt).slice(0, 10);
  page.drawText(safePdfText(`Date: ${refDateStr}`), {
    x: metaX,
    y: topY - 26,
    size: 8,
    font: fontRegular,
    color: grayColor,
  });
  page.drawText(
    safePdfText(
      `Against Invoice: ${refund.originalInvoice?.invoiceNo || 'Direct Return'}`,
    ),
    {
      x: metaX,
      y: topY - 37,
      size: 8,
      font: fontBold,
      color: primaryDark,
    },
  );

  // Header separator line
  page.drawLine({
    start: { x: leftMargin, y: topY - 56 },
    end: { x: rightMargin, y: topY - 56 },
    thickness: 0.75,
    color: lineGray,
  });

  // 2. Structured Metadata Boxes (Customer & Refund Info - Spacious)
  const cardTopY = topY - 66;
  const cardH = 72;
  const cardW = (contentWidth - 14) / 2;

  // Left Box: Customer Details
  page.drawRectangle({
    x: leftMargin,
    y: cardTopY - cardH,
    width: cardW,
    height: cardH,
    color: boxBg,
    borderColor: boxBorder,
    borderWidth: 0.75,
  });
  page.drawText('CUSTOMER DETAILS', {
    x: leftMargin + 10,
    y: cardTopY - 14,
    size: 7.5,
    font: fontBold,
    color: accentRed,
  });
  page.drawText(
    safePdfText((refund.party?.name || 'Walk-in Customer').slice(0, 36)),
    {
      x: leftMargin + 10,
      y: cardTopY - 28,
      size: 9,
      font: fontBold,
      color: textColor,
    },
  );
  page.drawText(safePdfText(`Mobile: ${refund.party?.phone || 'N/A'}`), {
    x: leftMargin + 10,
    y: cardTopY - 41,
    size: 8,
    font: fontRegular,
    color: grayColor,
  });
  const custAddr = (refund.party?.address || 'Counter Return').slice(0, 38);
  page.drawText(safePdfText(`Address: ${custAddr}`), {
    x: leftMargin + 10,
    y: cardTopY - 54,
    size: 7.5,
    font: fontRegular,
    color: grayColor,
  });
  if (refund.party?.gstin) {
    page.drawText(safePdfText(`GSTIN: ${refund.party.gstin}`), {
      x: leftMargin + 10,
      y: cardTopY - 65,
      size: 7,
      font: fontRegular,
      color: grayColor,
    });
  }

  // Right Box: Refund Settlement Details
  const rightBoxX = leftMargin + cardW + 14;
  page.drawRectangle({
    x: rightBoxX,
    y: cardTopY - cardH,
    width: cardW,
    height: cardH,
    color: boxBg,
    borderColor: boxBorder,
    borderWidth: 0.75,
  });
  page.drawText('SETTLEMENT & AUDIT', {
    x: rightBoxX + 10,
    y: cardTopY - 14,
    size: 7.5,
    font: fontBold,
    color: accentRed,
  });
  page.drawText(safePdfText(`Refund Settlement Mode: ${refund.refundMode}`), {
    x: rightBoxX + 10,
    y: cardTopY - 28,
    size: 8.5,
    font: fontBold,
    color: textColor,
  });
  page.drawText(
    safePdfText(
      `Processed By: ${refund.createdBy?.name || 'Authorized Staff'}`,
    ),
    {
      x: rightBoxX + 10,
      y: cardTopY - 41,
      size: 8,
      font: fontRegular,
      color: grayColor,
    },
  );
  page.drawText(
    safePdfText(
      `Return Reason: ${(refund.reason || 'Customer Sales Return').slice(0, 36)}`,
    ),
    {
      x: rightBoxX + 10,
      y: cardTopY - 54,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    },
  );
  page.drawText(
    safePdfText(`Stock Disposition: Restocked to inventory ledgers`),
    {
      x: rightBoxX + 10,
      y: cardTopY - 65,
      size: 7,
      font: fontRegular,
      color: accentRed,
    },
  );

  // 3. Line Items Table Header
  const tableHeaderY = cardTopY - cardH - 14;
  const headerHeight = 20;
  page.drawRectangle({
    x: leftMargin,
    y: tableHeaderY - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: rgb(0.98, 0.93, 0.94),
    borderColor: rgb(0.9, 0.78, 0.8),
    borderWidth: 0.75,
  });

  const headerY = tableHeaderY - 13;
  page.drawText('#', {
    x: leftMargin + 6,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });
  page.drawText('Returned Item', {
    x: leftMargin + 25,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });
  page.drawText('Restocked Godown', {
    x: leftMargin + 200,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });
  page.drawText('Batch Lot', {
    x: leftMargin + 310,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });

  const qtyHdr = 'Qty';
  const qtyHdrW = fontBold.widthOfTextAtSize(qtyHdr, 8);
  page.drawText(qtyHdr, {
    x: leftMargin + 395 - qtyHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });

  const rateHdr = 'Rate (Rs.)';
  const rateHdrW = fontBold.widthOfTextAtSize(rateHdr, 8);
  page.drawText(rateHdr, {
    x: leftMargin + 460 - rateHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });

  const totalHdr = 'Credit (Rs.)';
  const totalHdrW = fontBold.widthOfTextAtSize(totalHdr, 8);
  page.drawText(totalHdr, {
    x: rightMargin - 8 - totalHdrW,
    y: headerY,
    size: 8,
    font: fontBold,
    color: accentRed,
  });

  // 4. Line Items Rows (22pt row height)
  let y = tableHeaderY - headerHeight - 16;
  const rowHeight = 22;
  let idx = 1;

  for (const item of refund.items) {
    const idxStr = String(idx).padStart(2, '0');
    const prodName = (
      item.product?.name ||
      item.customItemName ||
      'Item'
    ).slice(0, 32);
    const whName = (item.warehouse?.name || 'Showroom').slice(0, 22);
    const batch = item.batchNo || 'Standard';
    const qtyStr = `${Number(item.qty)} ${item.product?.unit || 'unit'}`;
    const rateStr = Number(item.unitPrice).toFixed(2);
    const lineTotalStr = Number(item.total).toFixed(2);

    page.drawText(idxStr, {
      x: leftMargin + 6,
      y,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });
    page.drawText(safePdfText(prodName), {
      x: leftMargin + 25,
      y,
      size: 8.5,
      font: fontBold,
      color: textColor,
    });
    page.drawText(safePdfText(whName), {
      x: leftMargin + 200,
      y,
      size: 8,
      font: fontRegular,
      color: textColor,
    });
    page.drawText(safePdfText(batch), {
      x: leftMargin + 310,
      y,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });

    const qw = fontRegular.widthOfTextAtSize(qtyStr, 8);
    page.drawText(safePdfText(qtyStr), {
      x: leftMargin + 395 - qw,
      y,
      size: 8,
      font: fontRegular,
      color: textColor,
    });

    const rw = fontRegular.widthOfTextAtSize(rateStr, 8.5);
    page.drawText(safePdfText(rateStr), {
      x: leftMargin + 460 - rw,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });

    const lineTotalW = fontBold.widthOfTextAtSize(lineTotalStr, 8.5);
    page.drawText(safePdfText(lineTotalStr), {
      x: rightMargin - 8 - lineTotalW,
      y,
      size: 8.5,
      font: fontBold,
      color: textColor,
    });

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

  // 5. Financial Summary Box (Explicit GST Reversal & Total Refund)
  const sumBoxW = 220;
  const sumBoxX = rightMargin - sumBoxW;
  const subtotalStr = Number(refund.subtotal).toFixed(2);
  const taxStr = Number(refund.tax).toFixed(2);
  const totalStr = Number(refund.total).toFixed(2);
  const taxBreakup = (refund.taxBreakup as unknown as TaxBreakupData) || {};
  const taxRate = taxBreakup.rate || 18;

  // Subtotal line
  page.drawText('Return Subtotal:', {
    x: sumBoxX,
    y,
    size: 8.5,
    font: fontRegular,
    color: grayColor,
  });
  const subW = fontRegular.widthOfTextAtSize(`Rs. ${subtotalStr}`, 8.5);
  page.drawText(`Rs. ${subtotalStr}`, {
    x: rightMargin - subW,
    y,
    size: 8.5,
    font: fontRegular,
    color: textColor,
  });
  y -= 14;

  if (taxBreakup.isInterState) {
    page.drawText(`Reversed IGST (${taxRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const igstW = fontRegular.widthOfTextAtSize(`Rs. ${taxStr}`, 8.5);
    page.drawText(`Rs. ${taxStr}`, {
      x: rightMargin - igstW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;
  } else {
    const halfTax = (Number(refund.tax) / 2).toFixed(2);
    const halfRate = taxRate / 2;
    page.drawText(`Reversed CGST (${halfRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const cgstW = fontRegular.widthOfTextAtSize(`Rs. ${halfTax}`, 8.5);
    page.drawText(`Rs. ${halfTax}`, {
      x: rightMargin - cgstW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;

    page.drawText(`Reversed SGST (${halfRate}%):`, {
      x: sumBoxX,
      y,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });
    const sgstW = fontRegular.widthOfTextAtSize(`Rs. ${halfTax}`, 8.5);
    page.drawText(`Rs. ${halfTax}`, {
      x: rightMargin - sgstW,
      y,
      size: 8.5,
      font: fontRegular,
      color: textColor,
    });
    y -= 14;
  }

  // Grand Total Refund Box
  const grandBoxH = 24;
  page.drawRectangle({
    x: sumBoxX - 8,
    y: y - 6,
    width: sumBoxW + 8,
    height: grandBoxH,
    color: rgb(0.98, 0.93, 0.94),
    borderColor: rgb(0.88, 0.72, 0.74),
    borderWidth: 0.75,
  });

  page.drawText('TOTAL REFUND / CREDIT:', {
    x: sumBoxX,
    y: y + 2,
    size: 9.5,
    font: fontBold,
    color: accentRed,
  });
  const totalVal = `Rs. ${totalStr}`;
  const totalValW = fontBold.widthOfTextAtSize(totalVal, 10.5);
  page.drawText(totalVal, {
    x: rightMargin - totalValW,
    y: y + 2,
    size: 10.5,
    font: fontBold,
    color: accentRed,
  });

  // 6. Footer Notes & Authorized Signatory
  const footerY = 56;
  page.drawLine({
    start: { x: leftMargin, y: footerY + 16 },
    end: { x: rightMargin, y: footerY + 16 },
    thickness: 0.75,
    color: lineGray,
  });

  page.drawText('Important Note:', {
    x: leftMargin,
    y: footerY + 5,
    size: 7.5,
    font: fontBold,
    color: accentRed,
  });
  page.drawText(
    '1. This document is a formal Credit Note / Refund Voucher issued under GST rules for sales return.',
    {
      x: leftMargin,
      y: footerY - 6,
      size: 6.5,
      font: fontRegular,
      color: grayColor,
    },
  );
  page.drawText(
    '2. Restocked inventory has been verified and returned to showroom/godown ledger.',
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
  return { pdfBytes, invoiceNo: refund.refundNo };
}
