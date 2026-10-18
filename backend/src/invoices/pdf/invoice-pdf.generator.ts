import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';
import {
  GeneratedPdfResult,
  InvoicePdfPayload,
  safePdfText,
  TaxBreakupData,
  numberToWordsIndian,
} from './pdf-utils';

interface CachedPdf {
  pdfBytes: Uint8Array;
  invoiceNo: string;
}

const pdfBufferCache = new Map<string, CachedPdf>();
const MAX_PDF_CACHE_SIZE = 50;

export async function generateInvoicePdf(
  invoice: InvoicePdfPayload,
): Promise<GeneratedPdfResult> {
  const totalReturns = (invoice.refundInvoices || []).reduce(
    (sum, rf) => sum + Number(rf.total || 0),
    0,
  );
  const totalReceived = Math.max(
    0,
    (invoice.payments || [])
      .filter((p) => p.status === 'CONFIRMED')
      .reduce(
        (sum, p) =>
          p.type === 'OUTFLOW'
            ? sum - Number(p.amount)
            : sum + Number(p.amount),
        0,
      ),
  );
  const cacheKey = `${invoice.id}:${invoice.updatedAt ? new Date(invoice.updatedAt).getTime() : 0}:${(invoice.refundInvoices || []).length}:${totalReturns}:${totalReceived}`;
  const cached = pdfBufferCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 Standard
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Colors
  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightBorder = rgb(0.7, 0.7, 0.7);
  const brandRed = rgb(0.85, 0.12, 0.12);
  const headerBg = rgb(0.95, 0.95, 0.95);
  const lightBg = rgb(0.98, 0.98, 0.98);

  const leftMargin = 36;
  const rightMargin = width - 36; // 559.28
  const contentWidth = rightMargin - leftMargin; // 523.28

  // Tax and amounts calculations
  const itemsTax = Number(invoice.itemsTax || 0);
  const transportCost = Number(invoice.transportCost || 0);
  const transportGstRate = Number(invoice.transportGstRate || 0);
  const transportTax = Number(invoice.transportTax || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const totalAmount = Number(invoice.total || 0);
  const taxRate = Number(invoice.taxRate || 0);

  const taxBreakup = (invoice.taxBreakup as unknown as TaxBreakupData) || {};
  const isInterState = Boolean(taxBreakup.isInterState);

  // If both items tax and transport tax are 0, it's Bill of Supply, and NO tax labels/rows appear.
  const hasTax = itemsTax > 0 || transportTax > 0;
  const docTitle = hasTax ? 'Tax Invoice' : 'Bill of Supply';

  const hasReturns = totalReturns > 0;
  const netPayable = Math.max(0, totalAmount - totalReturns);
  const netBalanceDue = Math.max(0, netPayable - totalReceived);
  const balance = hasReturns
    ? netBalanceDue
    : Math.max(0, totalAmount - totalReceived);
  const previousBalance = Number(invoice.previousBalance || 0);
  const currentBalance = previousBalance + balance;

  const createdAt = invoice.createdAt
    ? new Date(invoice.createdAt)
    : new Date();
  const dateStr = createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = createdAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Return QR code
  const qrPayload = JSON.stringify({
    inv: invoice.invoiceNo,
    id: invoice.id,
    date: dateStr,
    total: totalAmount,
  });
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    width: 120,
    margin: 1,
  });
  const qrImage = await doc.embedPng(qrBuffer);

  let currentY = height - 28;

  // 1. Top Document Title Header (Bordered box)
  const titleBoxHeight = 22;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - titleBoxHeight,
    width: contentWidth,
    height: titleBoxHeight,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const titleWidth = fontBold.widthOfTextAtSize(docTitle, 11);
  page.drawText(docTitle, {
    x: leftMargin + (contentWidth - titleWidth) / 2,
    y: currentY - 15,
    size: 11,
    font: fontBold,
    color: black,
  });

  currentY -= titleBoxHeight;

  // 2. Company Details (Left) + Invoice Metadata (Right)
  const shopBoxHeight = 74;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - shopBoxHeight,
    width: contentWidth,
    height: shopBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  // Vertical divider between Shop & Invoice metadata
  const shopColWidth = contentWidth * 0.65;
  page.drawLine({
    start: { x: leftMargin + shopColWidth, y: currentY },
    end: { x: leftMargin + shopColWidth, y: currentY - shopBoxHeight },
    thickness: 1,
    color: lightBorder,
  });

  // Shop details (Left side)
  const shopTextX = leftMargin + 8;
  page.drawText('SHREE OM TILES', {
    x: shopTextX,
    y: currentY - 16,
    size: 11,
    font: fontBold,
    color: black,
  });
  page.drawText('Shop no 3, Ashok Vihar palam vihar Road Gurgaon', {
    x: shopTextX,
    y: currentY - 30,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('Phone no.: 9212953538', {
    x: shopTextX,
    y: currentY - 42,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('Email: shreeomtiles@gmail.com', {
    x: shopTextX,
    y: currentY - 54,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('State: 06-Haryana', {
    x: shopTextX,
    y: currentY - 66,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });

  // Invoice metadata (Right side)
  const metaX = leftMargin + shopColWidth + 8;
  page.drawText('Invoice No.', {
    x: metaX,
    y: currentY - 16,
    size: 8.5,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(safePdfText(invoice.invoiceNo), {
    x: metaX,
    y: currentY - 30,
    size: 10,
    font: fontBold,
    color: black,
  });

  page.drawText('Date', {
    x: metaX + 85,
    y: currentY - 16,
    size: 8.5,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(`${dateStr},`, {
    x: metaX + 85,
    y: currentY - 30,
    size: 8,
    font: fontRegular,
    color: black,
  });
  page.drawText(timeStr, {
    x: metaX + 85,
    y: currentY - 42,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });

  currentY -= shopBoxHeight;

  // 3. Bill To / Ship To Grid
  const partyBoxHeight = 58;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - partyBoxHeight,
    width: contentWidth,
    height: partyBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const halfWidth = contentWidth / 2;
  page.drawLine({
    start: { x: leftMargin + halfWidth, y: currentY },
    end: { x: leftMargin + halfWidth, y: currentY - partyBoxHeight },
    thickness: 1,
    color: lightBorder,
  });

  // Bill To (Left)
  page.drawText('Bill To', {
    x: leftMargin + 8,
    y: currentY - 13,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  const customerName =
    invoice.isCashSale &&
    (!invoice.party?.name || invoice.party.name === 'Walk-in Customer')
      ? 'Cash Sale'
      : invoice.party?.name || 'Cash Customer';
  page.drawText(safePdfText(customerName.toUpperCase().slice(0, 35)), {
    x: leftMargin + 8,
    y: currentY - 26,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  const billAddress =
    invoice.address || invoice.party?.address || 'Counter Sale';
  page.drawText(safePdfText(billAddress.slice(0, 42)), {
    x: leftMargin + 8,
    y: currentY - 38,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText(safePdfText(`Contact No. : ${invoice.party?.phone || 'N/A'}`), {
    x: leftMargin + 8,
    y: currentY - 50,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });

  // Ship To (Right)
  page.drawText('Ship To', {
    x: leftMargin + halfWidth + 8,
    y: currentY - 13,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  const shipAddress = invoice.isCashSale
    ? 'Counter Pickup (Cash Sale)'
    : invoice.address ||
      invoice.party?.address ||
      invoice.party?.name ||
      'Counter Delivery';
  page.drawText(safePdfText(shipAddress.slice(0, 40)), {
    x: leftMargin + halfWidth + 8,
    y: currentY - 26,
    size: 8.5,
    font: fontRegular,
    color: black,
  });
  if (invoice.party?.gstin) {
    page.drawText(safePdfText(`GSTIN: ${invoice.party.gstin}`), {
      x: leftMargin + halfWidth + 8,
      y: currentY - 38,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });
  }

  currentY -= partyBoxHeight;

  // 4. Items Table Header
  const tableHeaderHeight = 20;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  // Columns:
  // S.NO: 0 -> 36
  // ITEM NAME: 36 -> 270
  // Quantity: 270 -> 330
  // Unit: 330 -> 380
  // PRICE: 380 -> 445
  // TOTAL AMOUNT: 445 -> contentWidth (523.28)
  const colSNo = leftMargin;
  const colItem = leftMargin + 36;
  const colQty = leftMargin + 270;
  const colUnit = leftMargin + 330;
  const colPrice = leftMargin + 380;
  const colTotal = leftMargin + 445;

  const headerY = currentY - 14;
  page.drawText('S.NO', {
    x: colSNo + 4,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('ITEM NAME', {
    x: colItem + 6,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('Quantity', {
    x: colQty + 6,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('Unit', {
    x: colUnit + 6,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('PRICE', {
    x: colPrice + 6,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('TOTAL AMOUNT', {
    x: colTotal + 6,
    y: headerY,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  currentY -= tableHeaderHeight;

  // Table Rows
  const rowHeight = 20;
  let totalQty = 0;
  let sNo = 1;

  for (const item of invoice.items || []) {
    totalQty += Number(item.qty);
    const itemTotal = Number(item.total);
    const itemPrice = Number(item.unitPrice);

    page.drawRectangle({
      x: leftMargin,
      y: currentY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: lightBorder,
      borderWidth: 0.5,
    });

    const rowTextY = currentY - 14;
    page.drawText(String(sNo), {
      x: colSNo + 8,
      y: rowTextY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(
      safePdfText((item.product?.name || 'Item').toUpperCase().slice(0, 38)),
      {
        x: colItem + 6,
        y: rowTextY,
        size: 8,
        font: fontBold,
        color: black,
      },
    );
    page.drawText(String(item.qty), {
      x: colQty + 12,
      y: rowTextY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(safePdfText(item.product?.unit || 'Bag'), {
      x: colUnit + 6,
      y: rowTextY,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });

    const priceStr = `Rs. ${itemPrice.toLocaleString('en-IN')}`;
    page.drawText(priceStr, {
      x: colPrice + 6,
      y: rowTextY,
      size: 8,
      font: fontRegular,
      color: black,
    });

    const totalStr = `Rs. ${itemTotal.toLocaleString('en-IN')}`;
    page.drawText(totalStr, {
      x: colTotal + 6,
      y: rowTextY,
      size: 8,
      font: fontBold,
      color: black,
    });

    currentY -= rowHeight;
    sNo++;
  }

  // Items Total Row
  const totalRowHeight = 20;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - totalRowHeight,
    width: contentWidth,
    height: totalRowHeight,
    color: lightBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const totRowY = currentY - 14;
  page.drawText('Total', {
    x: colItem + 6,
    y: totRowY,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  page.drawText(String(totalQty), {
    x: colQty + 12,
    y: totRowY,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  page.drawText(`Rs. ${subtotal.toLocaleString('en-IN')}`, {
    x: colTotal + 6,
    y: totRowY,
    size: 8.5,
    font: fontBold,
    color: black,
  });

  currentY -= totalRowHeight;

  // 5. Middle Financial Section (Amount in words on left, Amounts breakdown on right)
  const amountsBoxHeight = hasReturns ? 150 : 135;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - amountsBoxHeight,
    width: contentWidth,
    height: amountsBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const splitX = leftMargin + contentWidth * 0.58;
  page.drawLine({
    start: { x: splitX, y: currentY },
    end: { x: splitX, y: currentY - amountsBoxHeight },
    thickness: 1,
    color: lightBorder,
  });

  // LEFT SIDE: Words & Payment Mode & QR
  const wordsLeftX = leftMargin + 8;
  page.drawText('Invoice Amount in Words:', {
    x: wordsLeftX,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: darkGray,
  });

  const words = numberToWordsIndian(totalAmount);
  // Split words if longer than 40 chars
  const wordsLine1 = words.length > 42 ? words.slice(0, 42) : words;
  const wordsLine2 = words.length > 42 ? words.slice(42) : '';

  page.drawText(safePdfText(wordsLine1), {
    x: wordsLeftX,
    y: currentY - 26,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  if (wordsLine2) {
    page.drawText(safePdfText(wordsLine2), {
      x: wordsLeftX,
      y: currentY - 37,
      size: 8.5,
      font: fontBold,
      color: black,
    });
  }

  // Divider inside left box
  page.drawLine({
    start: { x: leftMargin, y: currentY - 50 },
    end: { x: splitX, y: currentY - 50 },
    thickness: 0.5,
    color: lightBorder,
  });

  page.drawText('Payment Breakdown / Options Used:', {
    x: wordsLeftX,
    y: currentY - 58,
    size: 7.5,
    font: fontBold,
    color: darkGray,
  });

  const formatModeLabel = (m: string) =>
    m === 'CARD'
      ? 'Card (POS Machine)'
      : m === 'BANK_TRANSFER' || m === 'BANK'
      ? 'Bank Transfer'
      : m === 'CASH'
      ? 'Cash in Hand'
      : m === 'UPI'
      ? 'UPI'
      : m === 'CREDIT'
      ? 'Credit'
      : m;

  const validPayments = (
    Array.isArray(invoice.payments) ? invoice.payments : []
  ).filter((p: any) => Number(p.amount) > 0);

  let payLineY = currentY - 69;
  const payLineHeight = 10;
  const maxLines = 4;
  let linesRendered = 0;

  if (validPayments.length > 0) {
    for (const p of validPayments as any[]) {
      if (linesRendered >= maxLines) break;
      const amtStr = `Rs. ${Math.round(Number(p.amount)).toLocaleString('en-IN')}`;
      const utrStr = p.upiUtr ? ` (UTR: ${p.upiUtr})` : '';
      const text = safePdfText(`• ${formatModeLabel(p.mode)}: ${amtStr}${utrStr}`);

      page.drawText(text, {
        x: wordsLeftX,
        y: payLineY,
        size: 7.5,
        font: fontBold,
        color: black,
      });
      payLineY -= payLineHeight;
      linesRendered++;
    }

    if (balance > 0 && linesRendered < maxLines) {
      page.drawText(
        safePdfText(
          `• Unpaid Credit Due: Rs. ${Math.round(balance).toLocaleString('en-IN')}`,
        ),
        {
          x: wordsLeftX,
          y: payLineY,
          size: 7,
          font: fontRegular,
          color: brandRed,
        },
      );
      payLineY -= payLineHeight;
    }
  } else {
    const modeLabel = formatModeLabel(invoice.paymentMode || 'CREDIT');
    const payText = safePdfText(
      balance > 0
        ? `• ${modeLabel}: Rs. ${Math.round(balance).toLocaleString('en-IN')} (Pay Later)`
        : `• ${modeLabel}`,
    );
    page.drawText(payText, {
      x: wordsLeftX,
      y: payLineY,
      size: 7.5,
      font: fontBold,
      color: black,
    });
    payLineY -= payLineHeight;
  }

  if (hasReturns) {
    const refundNos = (invoice.refundInvoices || [])
      .map((r) => r.refundNo)
      .filter(Boolean)
      .join(', ');
    const noteText = safePdfText(`Adj. Credit Notes: ${refundNos}`);
    const maxNoteW = splitX - 58 - wordsLeftX - 6;
    let displayNote = noteText;
    if (fontBold.widthOfTextAtSize(displayNote, 7) > maxNoteW) {
      while (
        displayNote.length > 0 &&
        fontBold.widthOfTextAtSize(displayNote + '...', 7) > maxNoteW
      ) {
        displayNote = displayNote.slice(0, -1);
      }
      displayNote += '...';
    }
    page.drawText(displayNote, {
      x: wordsLeftX,
      y: Math.max(payLineY, currentY - amountsBoxHeight + 8),
      size: 7,
      font: fontBold,
      color: brandRed,
    });
  }

  // QR Code on bottom left
  page.drawImage(qrImage, {
    x: splitX - 58,
    y: currentY - amountsBoxHeight + 8,
    width: 50,
    height: 50,
  });

  // RIGHT SIDE: Amounts Breakdown
  const rightLabelsX = splitX + 8;
  const rightValuesRightX = rightMargin - 8;

  let amtY = currentY - 13;
  const amtLineHeight = 12;

  function drawAmountLine(
    label: string,
    value: string,
    isBold: boolean = false,
    isHighlight: boolean = false,
  ) {
    const safeLabel = safePdfText(label);
    const safeVal = safePdfText(value);
    const fontToUse = isBold ? fontBold : fontRegular;
    page.drawText(safeLabel, {
      x: rightLabelsX,
      y: amtY,
      size: 7.5,
      font: fontToUse,
      color: isHighlight ? brandRed : isBold ? black : darkGray,
    });
    const valWidth = fontToUse.widthOfTextAtSize(safeVal, 7.5);
    page.drawText(safeVal, {
      x: rightValuesRightX - valWidth,
      y: amtY,
      size: 7.5,
      font: fontToUse,
      color: isHighlight ? brandRed : isBold ? black : darkGray,
    });
    amtY -= amtLineHeight;
  }

  drawAmountLine('Sub Total', `Rs. ${subtotal.toLocaleString('en-IN')}`);

  if (transportCost > 0) {
    drawAmountLine('CARTAGE:', `Rs. ${transportCost.toLocaleString('en-IN')}`);
  }

  // DYNAMIC TAX SUPPRESSION
  if (itemsTax > 0) {
    if (isInterState) {
      drawAmountLine(
        `IGST (${taxRate}%):`,
        `Rs. ${itemsTax.toLocaleString('en-IN')}`,
      );
    } else {
      const halfRate = taxRate / 2;
      const halfTax = itemsTax / 2;
      drawAmountLine(
        `CGST (${halfRate}%):`,
        `Rs. ${halfTax.toLocaleString('en-IN')}`,
      );
      drawAmountLine(
        `SGST (${halfRate}%):`,
        `Rs. ${halfTax.toLocaleString('en-IN')}`,
      );
    }
  }

  if (transportTax > 0) {
    drawAmountLine(
      `Cartage GST (${transportGstRate}%):`,
      `Rs. ${transportTax.toLocaleString('en-IN')}`,
    );
  }

  if (hasReturns) {
    drawAmountLine(
      'Total Billed',
      `Rs. ${totalAmount.toLocaleString('en-IN')}`,
      true,
    );
    drawAmountLine(
      'Returns / Refunds:',
      `-Rs. ${totalReturns.toLocaleString('en-IN')}`,
      false,
      true,
    );
    drawAmountLine('Received', `Rs. ${totalReceived.toLocaleString('en-IN')}`);
    drawAmountLine(
      'Net Balance Due',
      `Rs. ${netBalanceDue.toLocaleString('en-IN')}`,
      true,
      netBalanceDue > 0,
    );
  } else {
    drawAmountLine('Total', `Rs. ${totalAmount.toLocaleString('en-IN')}`, true);
    drawAmountLine('Received', `Rs. ${totalReceived.toLocaleString('en-IN')}`);
    drawAmountLine('Balance', `Rs. ${balance.toLocaleString('en-IN')}`, true);
  }

  drawAmountLine(
    'Previous Balance',
    `Rs. ${previousBalance.toLocaleString('en-IN')}`,
  );
  drawAmountLine(
    'Current Balance',
    `Rs. ${currentBalance.toLocaleString('en-IN')}`,
    true,
    currentBalance > 0,
  );

  currentY -= amountsBoxHeight;

  // 6. Terms & Conditions (Left) and Authorized Signatory (Right)
  const footerBoxHeight = 70;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - footerBoxHeight,
    width: contentWidth,
    height: footerBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  page.drawLine({
    start: { x: splitX, y: currentY },
    end: { x: splitX, y: currentY - footerBoxHeight },
    thickness: 1,
    color: lightBorder,
  });

  // Terms and conditions
  const termsX = leftMargin + 8;
  page.drawText('Terms and conditions', {
    x: termsX,
    y: currentY - 12,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('NO COMPANY WILL RESPONSIBLE AFTER LAYING OF TILE.', {
    x: termsX,
    y: currentY - 24,
    size: 6.5,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('NO RETURN AFTER 1 WEEK.', {
    x: termsX,
    y: currentY - 34,
    size: 6.5,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('2%-3% DAMAGE IN DELIVERY IS ACCEPTABLE.', {
    x: termsX,
    y: currentY - 44,
    size: 6.5,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('RETURN TIMING AFTER 2:00 PM.', {
    x: termsX,
    y: currentY - 54,
    size: 6.5,
    font: fontRegular,
    color: darkGray,
  });

  // Signatory Box
  const sigX = splitX + 8;
  page.drawText('For : SHREE OM TILES', {
    x: sigX,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('Authorized Signatory', {
    x: sigX + 45,
    y: currentY - 58,
    size: 7,
    font: fontBold,
    color: darkGray,
  });

  currentY -= footerBoxHeight;

  // 7. Tear-off Perforated Acknowledgement Slip
  currentY -= 14;

  // Perforation dashed line
  const dashWidth = 8;
  const dashGap = 6;
  let dashStartX = leftMargin;
  while (dashStartX < rightMargin) {
    const dashEndX = Math.min(dashStartX + dashWidth, rightMargin);
    page.drawLine({
      start: { x: dashStartX, y: currentY },
      end: { x: dashEndX, y: currentY },
      thickness: 0.75,
      color: lightBorder,
    });
    dashStartX += dashWidth + dashGap;
  }

  currentY -= 12;

  // Acknowledgement Box
  const ackBoxHeight = 84;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - ackBoxHeight,
    width: contentWidth,
    height: ackBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  // Centered Acknowledgement Heading
  const ackTitle = 'Acknowledgement';
  const ackW = fontBold.widthOfTextAtSize(ackTitle, 9.5);
  page.drawText(ackTitle, {
    x: leftMargin + (contentWidth - ackW) / 2,
    y: currentY - 14,
    size: 9.5,
    font: fontBold,
    color: black,
  });

  // Brand title in bold red
  const ackBrand = 'SHREE OM TILES';
  const ackBrandW = fontBold.widthOfTextAtSize(ackBrand, 9);
  page.drawText(ackBrand, {
    x: leftMargin + (contentWidth - ackBrandW) / 2,
    y: currentY - 26,
    size: 9,
    font: fontBold,
    color: brandRed,
  });

  // 3 Columns inside Acknowledgement
  const ackCol1 = leftMargin + 10;
  const ackCol2 = leftMargin + contentWidth * 0.4;
  const ackCol3 = leftMargin + contentWidth * 0.72;

  const ackContentY = currentY - 42;

  // Column 1: Invoice To
  page.drawText('Invoice To:', {
    x: ackCol1,
    y: ackContentY,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText(
    safePdfText(
      (invoice.party?.name || 'Walk-in Customer').toUpperCase().slice(0, 28),
    ),
    {
      x: ackCol1,
      y: ackContentY - 12,
      size: 8,
      font: fontBold,
      color: black,
    },
  );
  page.drawText(safePdfText((invoice.party?.address || '').slice(0, 32)), {
    x: ackCol1,
    y: ackContentY - 24,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });

  // Column 2: Invoice Details
  page.drawText('Invoice Details:', {
    x: ackCol2,
    y: ackContentY,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText(`Invoice No. : ${invoice.invoiceNo}`, {
    x: ackCol2,
    y: ackContentY - 12,
    size: 7.5,
    font: fontRegular,
    color: black,
  });
  page.drawText(`Invoice date : ${dateStr}`, {
    x: ackCol2,
    y: ackContentY - 22,
    size: 7.5,
    font: fontRegular,
    color: black,
  });
  page.drawText(`Invoice Amount : Rs. ${totalAmount.toLocaleString('en-IN')}`, {
    x: ackCol2,
    y: ackContentY - 32,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  // Column 3: Receiver's Seal & Sign
  page.drawLine({
    start: { x: ackCol3, y: ackContentY - 16 },
    end: { x: rightMargin - 15, y: ackContentY - 16 },
    thickness: 0.75,
    color: darkGray,
  });
  page.drawText("Receiver's Seal & Sign", {
    x: ackCol3 + 8,
    y: ackContentY - 28,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });

  const pdfBytes = await doc.save();
  const result: GeneratedPdfResult = { pdfBytes, invoiceNo: invoice.invoiceNo };

  if (pdfBufferCache.size >= MAX_PDF_CACHE_SIZE) {
    const oldestKey = Array.from(pdfBufferCache.keys())[0];
    if (oldestKey) pdfBufferCache.delete(oldestKey);
  }
  pdfBufferCache.set(cacheKey, result);

  return result;
}
