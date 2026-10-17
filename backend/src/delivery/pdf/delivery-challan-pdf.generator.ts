import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { safePdfText } from '../../invoices/pdf/pdf-utils';

export interface DeliveryChallanPayload {
  id: string;
  invoice: {
    invoiceNo: string;
    createdAt: Date | string;
    party?: {
      name?: string;
      phone?: string;
      address?: string;
      gstin?: string;
    } | null;
  };
  driver?: {
    name?: string;
    phone?: string;
  } | null;
  trips?: Array<{
    vehicle?: string | null;
    tripNo?: number;
  }>;
  supervisors?: Array<{
    supervisor?: {
      name?: string;
      phone?: string;
    } | null;
  }>;
  items: Array<{
    productName?: string;
    batchNo?: string;
    warehouseName?: string;
    qty?: number;
    unit?: string;
  }>;
  createdAt: Date | string;
}

export async function generateDeliveryChallanPdf(
  delivery: DeliveryChallanPayload,
): Promise<{ pdfBytes: Uint8Array; invoiceNo: string }> {
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

  const dateObj = delivery.createdAt
    ? new Date(delivery.createdAt)
    : new Date();
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const latestVehicle =
    delivery.trips && delivery.trips.length > 0
      ? delivery.trips[delivery.trips.length - 1].vehicle || 'Store Vehicle'
      : 'Store Vehicle';

  let currentY = height - 32;

  // 1. Header Box
  page.drawRectangle({
    x: leftMargin,
    y: currentY - 50,
    width: contentWidth,
    height: 50,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const headerTitle = 'DELIVERY CHALLAN & GODOWN GATE PASS';
  const hw = fontBold.widthOfTextAtSize(headerTitle, 13);
  page.drawText(headerTitle, {
    x: leftMargin + (contentWidth - hw) / 2,
    y: currentY - 20,
    size: 13,
    font: fontBold,
    color: brandNavy,
  });

  const subTitle =
    'DHRA ( A UNIT OF SHREE OM TILES ) — NON-PRICED MATERIAL DISPATCH';
  const sw = fontRegular.widthOfTextAtSize(subTitle, 8.5);
  page.drawText(subTitle, {
    x: leftMargin + (contentWidth - sw) / 2,
    y: currentY - 36,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
  });

  currentY -= 50;

  // 2. Metadata Grid (Bill/Ship Address, Driver, Vehicle, Supervisor)
  const metaBoxHeight = 92;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const colW = contentWidth / 2;
  page.drawLine({
    start: { x: leftMargin + colW, y: currentY },
    end: { x: leftMargin + colW, y: currentY - metaBoxHeight },
    thickness: 1,
    color: lightBorder,
  });

  // Left: Destination / Customer
  const cX = leftMargin + 8;
  page.drawText('DISPATCH DESTINATION & CUSTOMER', {
    x: cX,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText(
    safePdfText(
      (delivery.invoice.party?.name || 'Customer').toUpperCase().slice(0, 36),
    ),
    { x: cX, y: currentY - 28, size: 9, font: fontBold, color: black },
  );
  page.drawText(
    safePdfText(
      (delivery.invoice.party?.address || 'Site Delivery').slice(0, 42),
    ),
    { x: cX, y: currentY - 42, size: 8, font: fontRegular, color: darkGray },
  );
  page.drawText(
    safePdfText(`Phone: ${delivery.invoice.party?.phone || 'N/A'}`),
    { x: cX, y: currentY - 56, size: 8, font: fontRegular, color: darkGray },
  );

  // Right: Gate Pass & Transport Details
  const supervisorNames = (delivery.supervisors || [])
    .map((s) => s.supervisor?.name)
    .filter(Boolean)
    .join(', ');
  const supervisorText = supervisorNames
    ? `Supervisor: ${supervisorNames}`
    : 'Supervisor: Direct Dispatch';

  const tX = leftMargin + colW + 8;
  page.drawText('LOGISTICS & DISPATCH METADATA', {
    x: tX,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText(`Invoice Ref: #${delivery.invoice.invoiceNo}`, {
    x: tX,
    y: currentY - 26,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  page.drawText(`Challan Date: ${dateStr}`, {
    x: tX,
    y: currentY - 39,
    size: 8,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText(
    safePdfText(
      `Driver: ${delivery.driver?.name || 'Unassigned'} (${delivery.driver?.phone || '—'})`,
    ),
    { x: tX, y: currentY - 52, size: 8, font: fontRegular, color: black },
  );
  page.drawText(safePdfText(`Vehicle Reg: ${latestVehicle}`), {
    x: tX,
    y: currentY - 65,
    size: 8,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(safePdfText(supervisorText.slice(0, 42)), {
    x: tX,
    y: currentY - 78,
    size: 8,
    font: fontBold,
    color: brandNavy,
  });

  currentY -= metaBoxHeight;

  // 3. Rate-Masked Dispatched Items Table
  const tableHeaderHeight = 22;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const colSNo = leftMargin;
  const colName = leftMargin + 35;
  const colBatch = leftMargin + 300;
  const colQty = leftMargin + 420;

  const thY = currentY - 15;
  page.drawText('S.No', {
    x: colSNo + 4,
    y: thY,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText('Product Description', {
    x: colName + 6,
    y: thY,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText('Batch / Shade #', {
    x: colBatch + 6,
    y: thY,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawText('Dispatched Qty', {
    x: colQty + 6,
    y: thY,
    size: 8,
    font: fontBold,
    color: black,
  });

  currentY -= tableHeaderHeight;

  let sNo = 1;
  let totalDispatchedQty = 0;
  const rowHeight = 22;

  for (const item of delivery.items || []) {
    const qty = Number(item.qty || 0);
    totalDispatchedQty += qty;

    page.drawRectangle({
      x: leftMargin,
      y: currentY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: lightBorder,
      borderWidth: 0.5,
    });

    const rY = currentY - 15;
    page.drawText(String(sNo), {
      x: colSNo + 8,
      y: rY,
      size: 8,
      font: fontRegular,
      color: black,
    });
    page.drawText(
      safePdfText((item.productName || 'Item').toUpperCase().slice(0, 48)),
      {
        x: colName + 6,
        y: rY,
        size: 8,
        font: fontBold,
        color: black,
      },
    );
    page.drawText(safePdfText(item.batchNo || 'Standard Lot'), {
      x: colBatch + 6,
      y: rY,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });
    page.drawText(`${qty} ${item.unit || 'unit'}`, {
      x: colQty + 6,
      y: rY,
      size: 8.5,
      font: fontBold,
      color: black,
    });

    currentY -= rowHeight;
    sNo++;
  }

  // Total Quantity Row
  page.drawRectangle({
    x: leftMargin,
    y: currentY - 22,
    width: contentWidth,
    height: 22,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: lightBorder,
    borderWidth: 1,
  });
  page.drawText('TOTAL DISPATCHED MATERIAL:', {
    x: colName + 6,
    y: currentY - 15,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  page.drawText(`${totalDispatchedQty} units`, {
    x: colQty + 6,
    y: currentY - 15,
    size: 9,
    font: fontBold,
    color: brandNavy,
  });

  currentY -= 22;

  // Rate-Masked Notice Box
  currentY -= 14;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - 32,
    width: contentWidth,
    height: 32,
    color: rgb(0.98, 0.98, 0.94),
    borderColor: rgb(0.85, 0.82, 0.6),
    borderWidth: 0.75,
  });
  page.drawText(
    'NOTICE: This document is a non-commercial transport gate pass for material transit and godown verification only.',
    {
      x: leftMargin + 8,
      y: currentY - 13,
      size: 7.5,
      font: fontBold,
      color: rgb(0.5, 0.4, 0.1),
    },
  );
  page.drawText(
    'All monetary charges and tax values are masked. Official Tax Invoice/Bill of Supply is provided directly to the party.',
    {
      x: leftMargin + 8,
      y: currentY - 24,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.4, 0.1),
    },
  );

  currentY -= 32;

  // 4. Signatures Box
  currentY -= 20;
  const sigBoxHeight = 85;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - sigBoxHeight,
    width: contentWidth,
    height: sigBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const sigColW = contentWidth / 3;

  // Godown In-Charge
  page.drawText('Godown In-Charge', {
    x: leftMargin + 12,
    y: currentY - 18,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawLine({
    start: { x: leftMargin + 12, y: currentY - 55 },
    end: { x: leftMargin + sigColW - 12, y: currentY - 55 },
    thickness: 0.75,
    color: lightBorder,
  });
  page.drawText('Material Dispatched By', {
    x: leftMargin + 12,
    y: currentY - 68,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });

  // Driver Sign
  const dX = leftMargin + sigColW + 12;
  page.drawText('Driver / Transporter', {
    x: dX,
    y: currentY - 18,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawLine({
    start: { x: dX, y: currentY - 55 },
    end: { x: dX + sigColW - 24, y: currentY - 55 },
    thickness: 0.75,
    color: lightBorder,
  });
  page.drawText('Received Goods in Intact Condition', {
    x: dX,
    y: currentY - 68,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });

  // Customer / Receiver Sign
  const rX = leftMargin + sigColW * 2 + 12;
  page.drawText('Receiver / Site Seal & Sign', {
    x: rX,
    y: currentY - 18,
    size: 8,
    font: fontBold,
    color: black,
  });
  page.drawLine({
    start: { x: rX, y: currentY - 55 },
    end: { x: rightMargin - 12, y: currentY - 55 },
    thickness: 0.75,
    color: lightBorder,
  });
  page.drawText('Acknowledged Material Received', {
    x: rX,
    y: currentY - 68,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });

  const pdfBytes = await doc.save();
  return { pdfBytes, invoiceNo: delivery.invoice.invoiceNo };
}
