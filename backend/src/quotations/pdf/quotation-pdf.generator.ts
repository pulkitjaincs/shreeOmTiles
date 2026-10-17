import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { safePdfText, numberToWordsIndian } from '../../invoices/pdf/pdf-utils';

export interface QuotationPdfPayload {
  id: string;
  quotationNo: string;
  createdAt: Date | string;
  validUntil?: Date | string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  party?: {
    name?: string;
    phone?: string;
    address?: string | null;
    gstin?: string | null;
  } | null;
  createdBy?: {
    name?: string;
  } | null;
  subtotal: any;
  taxRate: any;
  tax: any;
  transportCost: any;
  transportGstRate: any;
  total: any;
  notes?: string | null;
  items: Array<{
    product?: {
      name?: string;
      unit?: string;
    } | null;
    qty: number;
    unitPrice: any;
    discount?: any;
    total: any;
  }>;
}

export async function generateQuotationPdf(
  quotation: QuotationPdfPayload,
): Promise<{ pdfBytes: Uint8Array; quotationNo: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightBorder = rgb(0.7, 0.7, 0.7);
  const headerBg = rgb(0.95, 0.95, 0.95);
  const brandNavy = rgb(0.08, 0.18, 0.42);

  const leftMargin = 36;
  const rightMargin = width - 36;
  const contentWidth = rightMargin - leftMargin;

  const dateObj = quotation.createdAt
    ? new Date(quotation.createdAt)
    : new Date();
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const subtotal = Number(quotation.subtotal);
  const tax = Number(quotation.tax);
  const transportCost = Number(quotation.transportCost);
  const total = Number(quotation.total);

  let currentY = height - 32;

  // Header Box
  page.drawRectangle({
    x: leftMargin,
    y: currentY - 24,
    width: contentWidth,
    height: 24,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const headerTitle = 'ESTIMATE / PROFORMA QUOTATION';
  const hw = fontBold.widthOfTextAtSize(headerTitle, 11);
  page.drawText(headerTitle, {
    x: leftMargin + (contentWidth - hw) / 2,
    y: currentY - 16,
    size: 11,
    font: fontBold,
    color: brandNavy,
  });

  currentY -= 24;

  // Shop Details & Quotation Info
  const shopBoxH = 68;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - shopBoxH,
    width: contentWidth,
    height: shopBoxH,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const colW = contentWidth * 0.65;
  page.drawLine({
    start: { x: leftMargin + colW, y: currentY },
    end: { x: leftMargin + colW, y: currentY - shopBoxH },
    thickness: 1,
    color: lightBorder,
  });

  page.drawText('SHREE OM TILES', {
    x: leftMargin + 8,
    y: currentY - 16,
    size: 11,
    font: fontBold,
    color: black,
  });
  page.drawText(
    'Shop no 3, Ashok Vihar palam vihar Road Gurgaon | Phone: 9212953538',
    {
      x: leftMargin + 8,
      y: currentY - 30,
      size: 8,
      font: fontRegular,
      color: darkGray,
    },
  );
  page.drawText('Email: shreeomtiles@gmail.com | State: 06-Haryana', {
    x: leftMargin + 8,
    y: currentY - 44,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });

  // Quotation Meta
  const metaX = leftMargin + colW + 8;
  page.drawText(`Quotation #: ${quotation.quotationNo}`, {
    x: metaX,
    y: currentY - 18,
    size: 9,
    font: fontBold,
    color: black,
  });
  page.drawText(`Date: ${dateStr}`, {
    x: metaX,
    y: currentY - 32,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText(`Validity: 15 Days`, {
    x: metaX,
    y: currentY - 46,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });

  currentY -= shopBoxH;

  // Customer Box
  const custH = 48;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - custH,
    width: contentWidth,
    height: custH,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const clientName =
    quotation.party?.name || quotation.customerName || 'Prospective Customer';
  const clientPhone =
    quotation.party?.phone || quotation.customerPhone || 'N/A';
  const clientAddress =
    quotation.party?.address || quotation.customerAddress || 'Local Gurgaon';

  page.drawText('ESTIMATE PREPARED FOR:', {
    x: leftMargin + 8,
    y: currentY - 13,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText(safePdfText(clientName.toUpperCase()), {
    x: leftMargin + 8,
    y: currentY - 26,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  page.drawText(
    safePdfText(`Phone: ${clientPhone}  |  Address: ${clientAddress}`),
    {
      x: leftMargin + 8,
      y: currentY - 38,
      size: 8,
      font: fontRegular,
      color: darkGray,
    },
  );

  currentY -= custH;

  // Items Table Header
  const tableHdrH = 20;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - tableHdrH,
    width: contentWidth,
    height: tableHdrH,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const colSNo = leftMargin;
  const colItem = leftMargin + 35;
  const colQty = leftMargin + 270;
  const colUnit = leftMargin + 330;
  const colPrice = leftMargin + 380;
  const colTotal = leftMargin + 445;

  const thY = currentY - 14;
  page.drawText('S.NO', {
    x: colSNo + 4,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('ITEM DESCRIPTION', {
    x: colItem + 6,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('QUANTITY', {
    x: colQty + 6,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('UNIT', {
    x: colUnit + 6,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('PRICE (RS.)', {
    x: colPrice + 6,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });
  page.drawText('AMOUNT (RS.)', {
    x: colTotal + 6,
    y: thY,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  currentY -= tableHdrH;

  let sNo = 1;
  const rowH = 20;
  for (const item of quotation.items) {
    page.drawRectangle({
      x: leftMargin,
      y: currentY - rowH,
      width: contentWidth,
      height: rowH,
      borderColor: lightBorder,
      borderWidth: 0.5,
    });

    const rY = currentY - 14;
    page.drawText(String(sNo), {
      x: colSNo + 8,
      y: rY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(
      safePdfText((item.product?.name || 'Item').toUpperCase().slice(0, 38)),
      {
        x: colItem + 6,
        y: rY,
        size: 8,
        font: fontBold,
        color: black,
      },
    );
    page.drawText(String(item.qty), {
      x: colQty + 12,
      y: rY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(safePdfText(item.product?.unit || 'Bag'), {
      x: colUnit + 6,
      y: rY,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });
    page.drawText(Number(item.unitPrice).toLocaleString('en-IN'), {
      x: colPrice + 6,
      y: rY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(Number(item.total).toLocaleString('en-IN'), {
      x: colTotal + 6,
      y: rY,
      size: 8,
      font: fontBold,
      color: black,
    });

    currentY -= rowH;
    sNo++;
  }

  // Summary Box
  const sumH = 80;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - sumH,
    width: contentWidth,
    height: sumH,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const sumSplit = leftMargin + contentWidth * 0.6;
  page.drawLine({
    start: { x: sumSplit, y: currentY },
    end: { x: sumSplit, y: currentY - sumH },
    thickness: 1,
    color: lightBorder,
  });

  // Left: Words
  page.drawText('Estimate Total in Words:', {
    x: leftMargin + 8,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: darkGray,
  });
  const words = numberToWordsIndian(total);
  page.drawText(safePdfText(words.slice(0, 42)), {
    x: leftMargin + 8,
    y: currentY - 28,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  if (words.length > 42) {
    page.drawText(safePdfText(words.slice(42)), {
      x: leftMargin + 8,
      y: currentY - 40,
      size: 8.5,
      font: fontBold,
      color: black,
    });
  }

  // Right: Numerical Summary
  const rX = sumSplit + 8;
  const rvX = rightMargin - 8;
  let sY = currentY - 14;

  function drawSum(label: string, val: string, bold: boolean = false) {
    page.drawText(label, {
      x: rX,
      y: sY,
      size: 8,
      font: bold ? fontBold : fontRegular,
      color: black,
    });
    const vw = (bold ? fontBold : fontRegular).widthOfTextAtSize(val, 8);
    page.drawText(val, {
      x: rvX - vw,
      y: sY,
      size: 8,
      font: bold ? fontBold : fontRegular,
      color: black,
    });
    sY -= 13;
  }

  drawSum('Subtotal:', `Rs. ${subtotal.toLocaleString('en-IN')}`);
  if (transportCost > 0)
    drawSum('Cartage:', `Rs. ${transportCost.toLocaleString('en-IN')}`);
  if (tax > 0) drawSum('GST:', `Rs. ${tax.toLocaleString('en-IN')}`);
  drawSum('Grand Total:', `Rs. ${total.toLocaleString('en-IN')}`, true);

  currentY -= sumH;

  // Signatory
  currentY -= 20;
  page.drawText('For : SHREE OM TILES', {
    x: rightMargin - 180,
    y: currentY - 10,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText('[ Authorized Signatory ]', {
    x: rightMargin - 150,
    y: currentY - 45,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });

  const pdfBytes = await doc.save();
  return { pdfBytes, quotationNo: quotation.quotationNo };
}
