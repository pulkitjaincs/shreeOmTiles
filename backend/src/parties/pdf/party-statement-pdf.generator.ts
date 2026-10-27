import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { safePdfText } from '../../invoices/pdf/pdf-utils';

export interface StatementItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export interface StatementEntry {
  date: Date;
  txnType: string;
  refNo: string;
  status: string;
  totalAmount: number;
  receivedAmount: number;
  txnBalance: number;
  receivableBalance: number | null;
  payableBalance: number | null;
  paymentType?: string | null;
  items?: StatementItem[];
  subtotal?: number;
  shipping?: number;
  discount?: number;
  tax?: number;
  roundOff?: number;
}

export interface PartyStatementPayload {
  party: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  entries: StatementEntry[];
}

export async function generatePartyStatementPdf(
  data: PartyStatementPayload,
): Promise<{ pdfBytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Palette
  const black = rgb(0.08, 0.08, 0.08);
  const darkGray = rgb(0.28, 0.3, 0.34);
  const lightGray = rgb(0.55, 0.58, 0.62);
  const lightBorder = rgb(0.82, 0.84, 0.88);
  const tableHeaderBg = rgb(0.94, 0.95, 0.97);
  const itemHeaderBg = rgb(0.96, 0.97, 0.98);

  const leftMargin = 18;
  const rightMargin = width - 18; // 577.28
  const contentWidth = rightMargin - leftMargin; // ~559.28 pt

  const companyName = 'SHREE OM TILES';
  const companyAddress =
    process.env.COMPANY_ADDRESS ||
    'Shop no 3, Ashok Vihar palam vihar Road Gurgaon';
  const companyPhone = process.env.COMPANY_PHONE || '9212953538';
  const companyEmail = process.env.COMPANY_EMAIL || 'shreeomtiles@gmail.com';
  const companyState = 'State: 06-Haryana';

  let currentY = height - 28;

  // 1. Company Header
  const drawCompanyHeader = (targetPage: PDFPage, topY: number): number => {
    let y = topY;
    const nameWidth = fontBold.widthOfTextAtSize(companyName, 13);
    targetPage.drawText(companyName, {
      x: rightMargin - nameWidth,
      y,
      size: 13,
      font: fontBold,
      color: black,
    });
    y -= 14;

    const addrWidth = fontRegular.widthOfTextAtSize(companyAddress, 7.5);
    targetPage.drawText(companyAddress, {
      x: rightMargin - addrWidth,
      y,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    });
    y -= 11;

    const contactStr = `Phone no.: ${companyPhone}  Email: ${companyEmail}`;
    const contactWidth = fontRegular.widthOfTextAtSize(contactStr, 7.5);
    targetPage.drawText(contactStr, {
      x: rightMargin - contactWidth,
      y,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    });
    y -= 11;

    const stateWidth = fontRegular.widthOfTextAtSize(companyState, 7.5);
    targetPage.drawText(companyState, {
      x: rightMargin - stateWidth,
      y,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    });
    y -= 16;

    return y;
  };

  currentY = drawCompanyHeader(page, currentY);

  // Divider above Title
  page.drawLine({
    start: { x: leftMargin, y: currentY },
    end: { x: rightMargin, y: currentY },
    thickness: 0.6,
    color: lightBorder,
  });
  currentY -= 14;

  // 2. Centered "Party Statement" Title
  const titleText = 'Party Statement';
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 12);
  const titleX = leftMargin + (contentWidth - titleWidth) / 2;
  page.drawText(titleText, {
    x: titleX,
    y: currentY,
    size: 12,
    font: fontBold,
    color: black,
  });
  page.drawLine({
    start: { x: titleX, y: currentY - 2 },
    end: { x: titleX + titleWidth, y: currentY - 2 },
    thickness: 0.8,
    color: black,
  });
  currentY -= 20;

  // 3. Party Details Block
  const pName = `Party name: ${data.party.name.toUpperCase()}`;
  page.drawText(safePdfText(pName), {
    x: leftMargin,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: black,
  });
  currentY -= 12;

  const pPhone = `Contact no.: ${data.party.phone || '—'}`;
  page.drawText(safePdfText(pPhone), {
    x: leftMargin,
    y: currentY,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  currentY -= 11;

  const pAddr = `Address: ${data.party.address || 'Counter'}${data.party.gstin ? ` | GSTIN: ${data.party.gstin}` : ''}`;
  page.drawText(safePdfText(pAddr), {
    x: leftMargin,
    y: currentY,
    size: 7.5,
    font: fontRegular,
    color: darkGray,
  });
  currentY -= 13;

  const durationStr = `Duration: From ${data.startDate} to ${data.endDate}`;
  page.drawText(safePdfText(durationStr), {
    x: leftMargin,
    y: currentY,
    size: 8,
    font: fontBold,
    color: black,
  });
  currentY -= 14;

  // 4. 9-Column Geometry
  // Columns:
  // Date: 46
  // Txn Type: 56
  // Invoice/ Bill No.: 62
  // Status: 40
  // Total Amount: 68
  // Received/ Paid Amount: 75
  // Txn Balance: 68
  // Receivable Balance: 72
  // Payable Balance: 72
  // Total: 559 pt
  const colW = {
    date: 46,
    txnType: 56,
    refNo: 62,
    status: 40,
    total: 68,
    received: 75,
    txnBal: 68,
    receivable: 72,
    payable: 72,
  };

  const colX = {
    date: leftMargin,
    txnType: leftMargin + colW.date,
    refNo: leftMargin + colW.date + colW.txnType,
    status: leftMargin + colW.date + colW.txnType + colW.refNo,
    total: leftMargin + colW.date + colW.txnType + colW.refNo + colW.status,
    received:
      leftMargin +
      colW.date +
      colW.txnType +
      colW.refNo +
      colW.status +
      colW.total,
    txnBal:
      leftMargin +
      colW.date +
      colW.txnType +
      colW.refNo +
      colW.status +
      colW.total +
      colW.received,
    receivable:
      leftMargin +
      colW.date +
      colW.txnType +
      colW.refNo +
      colW.status +
      colW.total +
      colW.received +
      colW.txnBal,
    payable:
      leftMargin +
      colW.date +
      colW.txnType +
      colW.refNo +
      colW.status +
      colW.total +
      colW.received +
      colW.txnBal +
      colW.receivable,
  };

  const tableHeaderHeight = 22;

  const drawTableHeader = (targetPage: PDFPage, targetY: number) => {
    targetPage.drawRectangle({
      x: leftMargin,
      y: targetY - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: tableHeaderBg,
      borderColor: lightBorder,
      borderWidth: 0.6,
    });

    const thY = targetY - 14;

    targetPage.drawText('Date', {
      x: colX.date + 3,
      y: thY,
      size: 7,
      font: fontBold,
      color: black,
    });
    targetPage.drawText('Txn Type', {
      x: colX.txnType + 3,
      y: thY,
      size: 7,
      font: fontBold,
      color: black,
    });
    targetPage.drawText('Bill of Supply', {
      x: colX.refNo + 3,
      y: thY + 3,
      size: 6,
      font: fontBold,
      color: black,
    });
    targetPage.drawText('No.', {
      x: colX.refNo + 3,
      y: thY - 4,
      size: 6.5,
      font: fontBold,
      color: black,
    });
    targetPage.drawText('Status', {
      x: colX.status + 3,
      y: thY,
      size: 7,
      font: fontBold,
      color: black,
    });

    // Right-aligned numeric headers
    const drawThRight = (txt: string, rightEdge: number, yPos = thY) => {
      const w = fontBold.widthOfTextAtSize(txt, 7);
      targetPage.drawText(txt, {
        x: rightEdge - 4 - w,
        y: yPos,
        size: 7,
        font: fontBold,
        color: black,
      });
    };

    drawThRight('Total Amount', colX.total + colW.total);
    drawThRight('Received/ Paid', colX.received + colW.received, thY + 3);
    const amtSubW = fontBold.widthOfTextAtSize('Amount', 6.5);
    targetPage.drawText('Amount', {
      x: colX.received + colW.received - 4 - amtSubW,
      y: thY - 4,
      size: 6.5,
      font: fontBold,
      color: black,
    });

    drawThRight('Txn Balance', colX.txnBal + colW.txnBal);

    drawThRight('Receivable', colX.receivable + colW.receivable, thY + 3);
    const recBalW = fontBold.widthOfTextAtSize('Balance', 6.5);
    targetPage.drawText('Balance', {
      x: colX.receivable + colW.receivable - 4 - recBalW,
      y: thY - 4,
      size: 6.5,
      font: fontBold,
      color: black,
    });

    drawThRight('Payable', colX.payable + colW.payable, thY + 3);
    const payBalW = fontBold.widthOfTextAtSize('Balance', 6.5);
    targetPage.drawText('Balance', {
      x: colX.payable + colW.payable - 4 - payBalW,
      y: thY - 4,
      size: 6.5,
      font: fontBold,
      color: black,
    });
  };

  const addContinuationPage = (): { newPage: PDFPage; nextY: number } => {
    const newPage = doc.addPage([595.28, 841.89]);
    let topY = height - 26;

    const contBrand = `${companyName} · Party Statement: ${safePdfText(data.party.name)} (Continued)`;
    newPage.drawText(contBrand, {
      x: leftMargin,
      y: topY,
      size: 7,
      font: fontBold,
      color: darkGray,
    });

    const pageNumText = `Page ${doc.getPageCount()}`;
    const pnw = fontRegular.widthOfTextAtSize(pageNumText, 7);
    newPage.drawText(pageNumText, {
      x: rightMargin - pnw,
      y: topY,
      size: 7,
      font: fontRegular,
      color: lightGray,
    });

    topY -= 12;
    drawTableHeader(newPage, topY);
    return { newPage, nextY: topY - tableHeaderHeight };
  };

  drawTableHeader(page, currentY);
  currentY -= tableHeaderHeight;

  const formatAmt = (amt: number | null | undefined): string => {
    if (amt === null || amt === undefined) return '';
    if (Math.abs(amt) < 0.005) return 'Rs. 0';
    return `Rs. ${Math.round(amt).toLocaleString('en-IN')}`;
  };

  const drawRightCell = (
    targetPage: PDFPage,
    text: string,
    rightEdge: number,
    yPos: number,
    isBold = false,
    fontSize = 7,
  ) => {
    if (!text) return;
    const font = isBold ? fontBold : fontRegular;
    const safe = safePdfText(text);
    const tw = font.widthOfTextAtSize(safe, fontSize);
    targetPage.drawText(safe, {
      x: rightEdge - 4 - tw,
      y: yPos,
      size: fontSize,
      font,
      color: black,
    });
  };

  // 5. Draw Entries Loop
  for (const entry of data.entries) {
    const isBeginning =
      entry.txnType.includes('Beginning Balance') ||
      entry.txnType.includes('Opening Balance');

    // Calculate block height needed
    const mainRowH = 16;
    const hasItems = entry.items && entry.items.length > 0;
    const itemRowH = 12;
    const itemSubTableH = hasItems
      ? 16 + (entry.items?.length || 0) * itemRowH + 14 + 14 * 3
      : 0;
    const paymentNoteH = entry.paymentType ? 14 : 0;
    const totalBlockH = mainRowH + itemSubTableH + paymentNoteH + 6;

    if (currentY - totalBlockH < 40) {
      const { newPage, nextY } = addContinuationPage();
      page = newPage;
      currentY = nextY;
    }

    // Top border for entry
    page.drawLine({
      start: { x: leftMargin, y: currentY },
      end: { x: rightMargin, y: currentY },
      thickness: 0.5,
      color: lightBorder,
    });

    const rowY = currentY - 11;
    const dStr = new Date(entry.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    page.drawText(dStr, {
      x: colX.date + 3,
      y: rowY,
      size: 6.8,
      font: fontRegular,
      color: black,
    });

    page.drawText(safePdfText(entry.txnType), {
      x: colX.txnType + 3,
      y: rowY,
      size: 6.8,
      font: isBeginning ? fontBold : fontRegular,
      color: black,
    });

    if (entry.refNo && entry.refNo !== '—') {
      page.drawText(safePdfText(entry.refNo), {
        x: colX.refNo + 3,
        y: rowY,
        size: 6.8,
        font: fontBold,
        color: black,
      });
    }

    if (entry.status && entry.status !== '—') {
      page.drawText(safePdfText(entry.status), {
        x: colX.status + 3,
        y: rowY,
        size: 6.8,
        font: fontRegular,
        color: darkGray,
      });
    }

    if (!isBeginning) {
      drawRightCell(
        page,
        formatAmt(entry.totalAmount),
        colX.total + colW.total,
        rowY,
        false,
      );
      drawRightCell(
        page,
        formatAmt(entry.receivedAmount),
        colX.received + colW.received,
        rowY,
        false,
      );
      drawRightCell(
        page,
        formatAmt(entry.txnBalance),
        colX.txnBal + colW.txnBal,
        rowY,
        false,
      );
    }

    if (entry.receivableBalance !== null) {
      drawRightCell(
        page,
        formatAmt(entry.receivableBalance),
        colX.receivable + colW.receivable,
        rowY,
        true,
      );
    }

    if (entry.payableBalance !== null) {
      drawRightCell(
        page,
        formatAmt(entry.payableBalance),
        colX.payable + colW.payable,
        rowY,
        true,
      );
    }

    currentY -= mainRowH;

    // Item Sub-Table
    if (hasItems && entry.items) {
      const subX = colX.date + 12;
      const subW = contentWidth - 24;

      // Sub-table columns: S.NO(28), ITEM NAME(220), Quantity(54), Unit(44), PRICE(65), TOTAL AMOUNT(remain)
      const sw = {
        sno: 28,
        name: 210,
        qty: 54,
        unit: 44,
        price: 65,
        total: subW - (28 + 210 + 54 + 44 + 65),
      };

      const sx = {
        sno: subX,
        name: subX + sw.sno,
        qty: subX + sw.sno + sw.name,
        unit: subX + sw.sno + sw.name + sw.qty,
        price: subX + sw.sno + sw.name + sw.qty + sw.unit,
        total: subX + sw.sno + sw.name + sw.qty + sw.unit + sw.price,
      };

      const subHdrH = 14;
      page.drawRectangle({
        x: subX,
        y: currentY - subHdrH,
        width: subW,
        height: subHdrH,
        color: itemHeaderBg,
        borderColor: lightBorder,
        borderWidth: 0.5,
      });

      const shy = currentY - 10;
      page.drawText('S.NO', {
        x: sx.sno + 3,
        y: shy,
        size: 6,
        font: fontBold,
        color: darkGray,
      });
      page.drawText('ITEM NAME', {
        x: sx.name + 3,
        y: shy,
        size: 6,
        font: fontBold,
        color: darkGray,
      });
      page.drawText('Quantity', {
        x: sx.qty + 3,
        y: shy,
        size: 6,
        font: fontBold,
        color: darkGray,
      });
      page.drawText('Unit', {
        x: sx.unit + 3,
        y: shy,
        size: 6,
        font: fontBold,
        color: darkGray,
      });

      const drawSubThRight = (txt: string, rightEdge: number) => {
        const w = fontBold.widthOfTextAtSize(txt, 6);
        page.drawText(txt, {
          x: rightEdge - 4 - w,
          y: shy,
          size: 6,
          font: fontBold,
          color: darkGray,
        });
      };

      drawSubThRight('PRICE', sx.price + sw.price);
      drawSubThRight('TOTAL AMOUNT', sx.total + sw.total);

      currentY -= subHdrH;

      let itemIndex = 1;
      let totalQty = 0;
      let itemsTotalSum = 0;

      for (const it of entry.items) {
        if (currentY - itemRowH < 35) {
          const { newPage, nextY } = addContinuationPage();
          page = newPage;
          currentY = nextY;
        }

        const iy = currentY - 9;
        page.drawText(String(itemIndex), {
          x: sx.sno + 3,
          y: iy,
          size: 6.5,
          font: fontRegular,
          color: black,
        });

        // Truncate item name if too wide
        let iName = safePdfText(it.name);
        while (
          iName.length > 0 &&
          fontRegular.widthOfTextAtSize(iName, 6.5) > sw.name - 6
        ) {
          iName = iName.slice(0, -1);
        }
        page.drawText(iName, {
          x: sx.name + 3,
          y: iy,
          size: 6.5,
          font: fontRegular,
          color: black,
        });

        page.drawText(String(it.quantity), {
          x: sx.qty + 3,
          y: iy,
          size: 6.5,
          font: fontRegular,
          color: black,
        });

        page.drawText(safePdfText(it.unit || 'Box'), {
          x: sx.unit + 3,
          y: iy,
          size: 6.5,
          font: fontRegular,
          color: darkGray,
        });

        drawRightCell(
          page,
          formatAmt(it.price),
          sx.price + sw.price,
          iy,
          false,
          6.5,
        );
        drawRightCell(
          page,
          formatAmt(it.total),
          sx.total + sw.total,
          iy,
          false,
          6.5,
        );

        totalQty += it.quantity;
        itemsTotalSum += it.total;
        itemIndex++;
        currentY -= itemRowH;
      }

      // Total Row under items
      page.drawLine({
        start: { x: subX, y: currentY },
        end: { x: subX + subW, y: currentY },
        thickness: 0.5,
        color: lightBorder,
      });

      const totY = currentY - 10;
      page.drawText('Total', {
        x: sx.name + 3,
        y: totY,
        size: 6.5,
        font: fontBold,
        color: black,
      });
      page.drawText(String(totalQty), {
        x: sx.qty + 3,
        y: totY,
        size: 6.5,
        font: fontBold,
        color: black,
      });
      drawRightCell(
        page,
        formatAmt(itemsTotalSum),
        sx.total + sw.total,
        totY,
        true,
        6.5,
      );

      currentY -= 14;

      // Subtotals & Adjustments Breakdown (Right Aligned)
      const summaryRightEdge = sx.total + sw.total;
      const drawSummaryLine = (lbl: string, valStr: string) => {
        const sy = currentY - 9;
        const lw = fontRegular.widthOfTextAtSize(lbl, 6.5);
        page.drawText(lbl, {
          x: summaryRightEdge - 80 - lw,
          y: sy,
          size: 6.5,
          font: fontRegular,
          color: darkGray,
        });
        drawRightCell(page, valStr, summaryRightEdge, sy, false, 6.5);
        currentY -= 11;
      };

      if (entry.subtotal !== undefined) {
        drawSummaryLine('Sub Total:', formatAmt(entry.subtotal));
      }
      if (entry.shipping && entry.shipping > 0) {
        drawSummaryLine('Shipping / Cartage:', formatAmt(entry.shipping));
      }
      if (entry.discount && entry.discount > 0) {
        drawSummaryLine('Discount:', `- ${formatAmt(entry.discount)}`);
      }
      if (entry.tax && entry.tax > 0) {
        drawSummaryLine('Tax:', formatAmt(entry.tax));
      }
      if (entry.roundOff && Math.abs(entry.roundOff) > 0.005) {
        const sign = entry.roundOff > 0 ? '+ ' : '- ';
        drawSummaryLine('Round off:', `${sign}${formatAmt(Math.abs(entry.roundOff))}`);
      }
    }

    // Payment Type footer note
    if (entry.paymentType) {
      const py = currentY - 9;
      page.drawText(safePdfText(`Payment Type: ${entry.paymentType}`), {
        x: colX.date + 12,
        y: py,
        size: 6.8,
        font: fontBold,
        color: darkGray,
      });
      currentY -= 13;
    }

    currentY -= 4;
  }

  // 6. Statement Footer (Closing Balance)
  if (currentY - 35 < 30) {
    const { newPage, nextY } = addContinuationPage();
    page = newPage;
    currentY = nextY;
  }

  page.drawLine({
    start: { x: leftMargin, y: currentY },
    end: { x: rightMargin, y: currentY },
    thickness: 1,
    color: black,
  });
  currentY -= 16;

  const closingLabel =
    data.closingBalance > 0.005
      ? `Total Receivable balance: Rs. ${Math.round(data.closingBalance).toLocaleString('en-IN')}`
      : data.closingBalance < -0.005
        ? `Total Payable balance: Rs. ${Math.round(Math.abs(data.closingBalance)).toLocaleString('en-IN')}`
        : 'Total Balance: Rs. 0 (Settled)';

  page.drawText(closingLabel, {
    x: leftMargin,
    y: currentY,
    size: 9.5,
    font: fontBold,
    color: black,
  });

  // Footer Branding & Page numbers on every page
  const totalPages = doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = doc.getPage(i);
    const pNumStr = `Page ${i + 1}`;
    const pnw = fontRegular.widthOfTextAtSize(pNumStr, 7);
    p.drawText(pNumStr, {
      x: (width - pnw) / 2,
      y: 15,
      size: 7,
      font: fontRegular,
      color: lightGray,
    });
  }

  const pdfBytes = await doc.save();
  const cleanName = data.party.name.replace(/[^a-zA-Z0-9]/g, '_');
  return { pdfBytes, filename: `Statement_${cleanName}.pdf` };
}
