import {
  PDFDocument,
  PDFPage,
  PDFFont,
  Color,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { safePdfText } from '../../invoices/pdf/pdf-utils';

export interface LedgerEntry {
  date: Date;
  voucherType: string;
  refNo: string;
  particulars: string;
  debit: number; // Dr
  credit: number; // Cr
  balance: number; // Running balance (Dr if > 0, Cr if < 0)
}

export interface PartyStatementPayload {
  party: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  startDate?: string;
  endDate?: string;
  openingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalReturns: number;
  closingBalance: number;
  entries: LedgerEntry[];
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
  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.35, 0.38, 0.42);
  const lightGray = rgb(0.55, 0.58, 0.62);
  const lightBorder = rgb(0.8, 0.83, 0.88);
  const headerBg = rgb(0.95, 0.96, 0.98);
  const zebraBg = rgb(0.985, 0.99, 1.0);
  const brandNavy = rgb(0.08, 0.18, 0.42);
  const emerald = rgb(0.06, 0.58, 0.32);
  const rose = rgb(0.85, 0.15, 0.15);

  const leftMargin = 36;
  const rightMargin = width - 36; // 559.28
  const contentWidth = rightMargin - leftMargin; // 523.28

  const companyName = process.env.COMPANY_NAME || 'SHREE OM TILES';
  const companyAddress =
    process.env.COMPANY_ADDRESS ||
    'Shop no 3, Ashok Vihar palam vihar Road Gurgaon';
  const companyPhone = process.env.COMPANY_PHONE || '9212953538';

  let currentY = height - 32;

  // 1. Clean Header Banner
  const bannerHeight = 56;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - bannerHeight,
    width: contentWidth,
    height: bannerHeight,
    color: brandNavy,
  });

  page.drawText(safePdfText(companyName), {
    x: leftMargin + 12,
    y: currentY - 20,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safePdfText(companyAddress), {
    x: leftMargin + 12,
    y: currentY - 34,
    size: 8,
    font: fontRegular,
    color: rgb(0.86, 0.9, 0.96),
  });
  page.drawText(
    safePdfText(`Phone: ${companyPhone} | Email: shreeomtiles@gmail.com`),
    {
      x: leftMargin + 12,
      y: currentY - 46,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.86, 0.9, 0.96),
    },
  );

  const stTitle = 'ACCOUNT STATEMENT';
  const stw = fontBold.widthOfTextAtSize(stTitle, 12);
  page.drawText(stTitle, {
    x: rightMargin - 12 - stw,
    y: currentY - 20,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const dateRangeStr = `Period: ${data.startDate || 'All Time'} to ${data.endDate || 'Present'}`;
  const dsw = fontRegular.widthOfTextAtSize(dateRangeStr, 7.5);
  page.drawText(dateRangeStr, {
    x: rightMargin - 12 - dsw,
    y: currentY - 34,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.86, 0.9, 0.96),
  });

  const genDateStr = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const gdw = fontRegular.widthOfTextAtSize(genDateStr, 7);
  page.drawText(genDateStr, {
    x: rightMargin - 12 - gdw,
    y: currentY - 46,
    size: 7,
    font: fontRegular,
    color: rgb(0.75, 0.8, 0.9),
  });

  currentY -= bannerHeight;

  // 2. Customer Details Card
  const custBoxHeight = 46;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - custBoxHeight,
    width: contentWidth,
    height: custBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
    color: rgb(0.99, 0.995, 1.0),
  });

  page.drawText('STATEMENT FOR (PARTY DETAILS)', {
    x: leftMargin + 10,
    y: currentY - 13,
    size: 7,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText(safePdfText(data.party.name.toUpperCase()), {
    x: leftMargin + 10,
    y: currentY - 26,
    size: 9.5,
    font: fontBold,
    color: black,
  });
  page.drawText(
    safePdfText(
      `Phone: ${data.party.phone}  |  Address: ${data.party.address || 'Counter'}`,
    ),
    {
      x: leftMargin + 10,
      y: currentY - 38,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    },
  );

  const statusStr =
    data.closingBalance > 0
      ? 'Status: Debit Due (Receivable)'
      : data.closingBalance < 0
        ? 'Status: Credit Balance (Advance)'
        : 'Status: Settled (Zero Balance)';
  const ssw = fontBold.widthOfTextAtSize(statusStr, 7.5);
  page.drawText(statusStr, {
    x: rightMargin - 10 - ssw,
    y: currentY - 26,
    size: 7.5,
    font: fontBold,
    color: data.closingBalance > 0 ? rose : emerald,
  });

  if (data.party.gstin) {
    const gstinStr = safePdfText(`GSTIN: ${data.party.gstin}`);
    const gstw = fontRegular.widthOfTextAtSize(gstinStr, 7.5);
    page.drawText(gstinStr, {
      x: rightMargin - 10 - gstw,
      y: currentY - 38,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    });
  }

  currentY -= custBoxHeight;

  // 3. Structured Financial KPI Cards (Opening, Invoiced, Returns/Credits, Paid, Closing Balance)
  const kpiBoxHeight = 46;
  const kpiColW = contentWidth / 5; // ~104.65 pt

  page.drawRectangle({
    x: leftMargin,
    y: currentY - kpiBoxHeight,
    width: contentWidth,
    height: kpiBoxHeight,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  // Vertical dividers between the 5 cards
  for (let i = 1; i < 5; i++) {
    page.drawLine({
      start: { x: leftMargin + kpiColW * i, y: currentY },
      end: { x: leftMargin + kpiColW * i, y: currentY - kpiBoxHeight },
      thickness: 0.75,
      color: lightBorder,
    });
  }

  const openingDueFromEntries = data.entries
    .filter((e) => e.voucherType === 'Opening Balance' && e.refNo !== 'B/F')
    .reduce((sum, e) => sum + (e.debit - e.credit), 0);
  const displayOpening =
    data.openingBalance !== 0 ? data.openingBalance : openingDueFromEntries;

  const kpis = [
    {
      title: 'OPENING',
      value: `Rs. ${Math.abs(displayOpening).toLocaleString('en-IN')}`,
      marker:
        displayOpening > 0
          ? 'Dr (Due)'
          : displayOpening < 0
            ? 'Cr (Advance)'
            : 'Nil',
      markerColor: displayOpening > 0 ? rose : emerald,
    },
    {
      title: 'INVOICED',
      value: `Rs. ${data.totalBilled.toLocaleString('en-IN')}`,
      marker: 'Debit (+)',
      markerColor: rose,
    },
    {
      title: 'RETURNS / CREDITS',
      value: `Rs. ${data.totalReturns.toLocaleString('en-IN')}`,
      marker: 'Credit (-)',
      markerColor: emerald,
    },
    {
      title: 'PAID',
      value: `Rs. ${data.totalPaid.toLocaleString('en-IN')}`,
      marker: 'Credit (-)',
      markerColor: emerald,
    },
    {
      title: 'CLOSING BALANCE',
      value: `Rs. ${Math.abs(data.closingBalance).toLocaleString('en-IN')}`,
      marker:
        data.closingBalance > 0
          ? 'Dr (Net Due)'
          : data.closingBalance < 0
            ? 'Cr (Advance)'
            : 'Settled',
      markerColor: data.closingBalance > 0 ? rose : emerald,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = leftMargin + kpiColW * idx + 8;
    const maxValW = kpiColW - 14;
    let valSize = 9;
    if (fontBold.widthOfTextAtSize(kpi.value, valSize) > maxValW) {
      valSize = 8;
      if (fontBold.widthOfTextAtSize(kpi.value, valSize) > maxValW) {
        valSize = 7;
      }
    }
    // Title
    page.drawText(kpi.title, {
      x: cardX,
      y: currentY - 13,
      size: 6.5,
      font: fontBold,
      color: darkGray,
    });
    // Amount
    page.drawText(kpi.value, {
      x: cardX,
      y: currentY - 26,
      size: valSize,
      font: fontBold,
      color: black,
    });
    // Dr/Cr Marker
    page.drawText(kpi.marker, {
      x: cardX,
      y: currentY - 38,
      size: 6.5,
      font: fontBold,
      color: kpi.markerColor,
    });
  });

  currentY -= kpiBoxHeight;

  // 4. Organized Ledger Table with Clear Dr/Cr Markers
  // Column Geometry:
  // Date: 50 pt
  // Voucher Type: 72 pt
  // Ref No.: 70 pt
  // Particulars: 125 pt
  // Debit (Dr): 68 pt
  // Credit (Cr): 68 pt
  // Balance: 70.28 pt
  // Total = 523.28 pt
  const wDate = 50;
  const wType = 72;
  const wRef = 70;
  const wPart = 125;
  const wDr = 68;
  const wCr = 68;
  const wBal = contentWidth - (wDate + wType + wRef + wPart + wDr + wCr);

  const colDate = leftMargin;
  const colType = colDate + wDate;
  const colRef = colType + wType;
  const colPart = colRef + wRef;
  const colDr = colPart + wPart;
  const colCr = colDr + wDr;
  const colBal = colCr + wCr;

  const tableHeaderHeight = 20;

  const drawTableHeader = (targetPage: PDFPage, targetY: number) => {
    targetPage.drawRectangle({
      x: leftMargin,
      y: targetY - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: rgb(0.91, 0.93, 0.97),
      borderColor: lightBorder,
      borderWidth: 1,
    });

    const thY = targetY - 14;
    targetPage.drawText('Date', {
      x: colDate + 4,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });
    targetPage.drawText('Voucher Type', {
      x: colType + 4,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });
    targetPage.drawText('Ref No.', {
      x: colRef + 4,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });
    targetPage.drawText('Particulars', {
      x: colPart + 4,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });

    // Numeric Headers with Dr / Cr indicators
    const drHdr = 'Debit (Dr)';
    const drHw = fontBold.widthOfTextAtSize(drHdr, 7.5);
    targetPage.drawText(drHdr, {
      x: colDr + wDr - 4 - drHw,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });

    const crHdr = 'Credit (Cr)';
    const crHw = fontBold.widthOfTextAtSize(crHdr, 7.5);
    targetPage.drawText(crHdr, {
      x: colCr + wCr - 4 - crHw,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });

    const balHdr = 'Balance';
    const balHw = fontBold.widthOfTextAtSize(balHdr, 7.5);
    targetPage.drawText(balHdr, {
      x: colBal + wBal - 4 - balHw,
      y: thY,
      size: 7.5,
      font: fontBold,
      color: brandNavy,
    });
  };

  const formatBalance = (bal: number) => {
    if (Math.abs(bal) < 0.005) {
      return 'Rs. 0';
    }
    return `Rs. ${Math.abs(bal).toLocaleString('en-IN')} ${bal > 0 ? 'Dr' : 'Cr'}`;
  };

  const getBalanceColor = (bal: number) => {
    if (Math.abs(bal) < 0.005) {
      return darkGray;
    }
    return bal > 0 ? rose : emerald;
  };

  const fitColumnText = (
    text: string,
    maxWidth: number,
    font: PDFFont,
    fontSize: number,
  ) => {
    const safe = safePdfText(text);
    if (font.widthOfTextAtSize(safe, fontSize) <= maxWidth) {
      return safe;
    }
    let truncated = safe;
    while (
      truncated.length > 0 &&
      font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth
    ) {
      truncated = truncated.slice(0, -1);
    }
    return truncated ? truncated + '...' : '';
  };

  const drawRightText = (
    targetPage: PDFPage,
    text: string,
    rightEdge: number,
    yPos: number,
    font: PDFFont,
    size: number,
    color: Color,
    maxW?: number,
  ) => {
    const safe = safePdfText(text);
    let finalSize = size;
    if (maxW && font.widthOfTextAtSize(safe, finalSize) > maxW) {
      finalSize = Math.max(5.5, finalSize - 1);
      if (font.widthOfTextAtSize(safe, finalSize) > maxW) {
        finalSize = 5.5;
      }
    }
    const textW = font.widthOfTextAtSize(safe, finalSize);
    targetPage.drawText(safe, {
      x: rightEdge - textW,
      y: yPos,
      size: finalSize,
      font,
      color,
    });
  };

  const addContinuationPage = () => {
    const newPage = doc.addPage([595.28, 841.89]);
    let topY = height - 28;
    const contBrand = safePdfText(
      `${companyName} · Account Statement: ${data.party.name} (Continued)`,
    );
    newPage.drawText(contBrand, {
      x: leftMargin,
      y: topY,
      size: 7,
      font: fontBold,
      color: brandNavy,
    });
    const pageNumText = `Page ${doc.getPageCount()}`;
    const pnw = fontRegular.widthOfTextAtSize(pageNumText, 7);
    newPage.drawText(pageNumText, {
      x: rightMargin - pnw,
      y: topY,
      size: 7,
      font: fontRegular,
      color: darkGray,
    });
    topY -= 10;
    drawTableHeader(newPage, topY);
    return { newPage, nextY: topY - tableHeaderHeight };
  };

  drawTableHeader(page, currentY);
  currentY -= tableHeaderHeight;

  const rowH = 18;

  // Opening Balance Row
  page.drawRectangle({
    x: leftMargin,
    y: currentY - rowH,
    width: contentWidth,
    height: rowH,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: lightBorder,
    borderWidth: 0.5,
  });

  const opRowY = currentY - 13;
  page.drawText(safePdfText(data.startDate || '—'), {
    x: colDate + 4,
    y: opRowY,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('Opening', {
    x: colType + 4,
    y: opRowY,
    size: 7,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('—', {
    x: colRef + 4,
    y: opRowY,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });
  page.drawText('Opening Balance B/F', {
    x: colPart + 4,
    y: opRowY,
    size: 7,
    font: fontBold,
    color: black,
  });

  if (data.openingBalance > 0) {
    drawRightText(
      page,
      `Rs. ${data.openingBalance.toLocaleString('en-IN')}`,
      colDr + wDr - 4,
      opRowY,
      fontBold,
      7,
      rose,
      wDr - 6,
    );
    drawRightText(page, '—', colCr + wCr - 4, opRowY, fontRegular, 7, darkGray);
  } else if (data.openingBalance < 0) {
    drawRightText(page, '—', colDr + wDr - 4, opRowY, fontRegular, 7, darkGray);
    drawRightText(
      page,
      `Rs. ${Math.abs(data.openingBalance).toLocaleString('en-IN')}`,
      colCr + wCr - 4,
      opRowY,
      fontBold,
      7,
      emerald,
      wCr - 6,
    );
  } else {
    drawRightText(page, '—', colDr + wDr - 4, opRowY, fontRegular, 7, darkGray);
    drawRightText(page, '—', colCr + wCr - 4, opRowY, fontRegular, 7, darkGray);
  }

  const opBalStr = formatBalance(data.openingBalance);
  drawRightText(
    page,
    opBalStr,
    colBal + wBal - 4,
    opRowY,
    fontBold,
    7,
    getBalanceColor(data.openingBalance),
    wBal - 6,
  );

  currentY -= rowH;

  // Entries loop
  let rowIndex = 0;
  for (const entry of data.entries || []) {
    if (currentY - rowH < 45) {
      const { newPage, nextY } = addContinuationPage();
      page = newPage;
      currentY = nextY;
    }

    const isEven = rowIndex % 2 === 1;
    page.drawRectangle({
      x: leftMargin,
      y: currentY - rowH,
      width: contentWidth,
      height: rowH,
      color: isEven ? zebraBg : rgb(1, 1, 1),
      borderColor: lightBorder,
      borderWidth: 0.5,
    });

    const dStr = new Date(entry.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const lrY = currentY - 13;

    page.drawText(dStr, {
      x: colDate + 4,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: black,
    });

    page.drawText(fitColumnText(entry.voucherType, wType - 8, fontRegular, 7), {
      x: colType + 4,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: black,
    });

    page.drawText(fitColumnText(entry.refNo, wRef - 8, fontBold, 7), {
      x: colRef + 4,
      y: lrY,
      size: 7,
      font: fontBold,
      color: black,
    });

    page.drawText(fitColumnText(entry.particulars, wPart - 8, fontRegular, 7), {
      x: colPart + 4,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: darkGray,
    });

    if (entry.debit > 0) {
      drawRightText(
        page,
        `Rs. ${entry.debit.toLocaleString('en-IN')}`,
        colDr + wDr - 4,
        lrY,
        fontBold,
        7,
        rose,
        wDr - 6,
      );
    } else {
      drawRightText(page, '—', colDr + wDr - 4, lrY, fontRegular, 7, darkGray);
    }

    if (entry.credit > 0) {
      drawRightText(
        page,
        `Rs. ${entry.credit.toLocaleString('en-IN')}`,
        colCr + wCr - 4,
        lrY,
        fontBold,
        7,
        emerald,
        wCr - 6,
      );
    } else {
      drawRightText(page, '—', colCr + wCr - 4, lrY, fontRegular, 7, darkGray);
    }

    const balStr = formatBalance(entry.balance);
    drawRightText(
      page,
      balStr,
      colBal + wBal - 4,
      lrY,
      fontBold,
      7,
      getBalanceColor(entry.balance),
      wBal - 6,
    );

    currentY -= rowH;
    rowIndex++;
  }

  // Summary Row (Closing Totals)
  if (currentY - rowH < 45) {
    const { newPage, nextY } = addContinuationPage();
    page = newPage;
    currentY = nextY;
  }

  page.drawRectangle({
    x: leftMargin,
    y: currentY - rowH,
    width: contentWidth,
    height: rowH,
    color: rgb(0.93, 0.95, 0.98),
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const totY = currentY - 13;
  page.drawText('Total / Closing Balance', {
    x: colPart + 4,
    y: totY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });

  const totalDr =
    (data.openingBalance > 0 ? data.openingBalance : 0) +
    (data.entries || []).reduce((sum, e) => sum + Number(e.debit || 0), 0);
  const totalCr =
    (data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0) +
    (data.entries || []).reduce((sum, e) => sum + Number(e.credit || 0), 0);

  drawRightText(
    page,
    `Rs. ${totalDr.toLocaleString('en-IN')}`,
    colDr + wDr - 4,
    totY,
    fontBold,
    7,
    rose,
    wDr - 6,
  );
  drawRightText(
    page,
    `Rs. ${totalCr.toLocaleString('en-IN')}`,
    colCr + wCr - 4,
    totY,
    fontBold,
    7,
    emerald,
    wCr - 6,
  );

  const closingBalStr = formatBalance(data.closingBalance);
  drawRightText(
    page,
    closingBalStr,
    colBal + wBal - 4,
    totY,
    fontBold,
    7.5,
    getBalanceColor(data.closingBalance),
    wBal - 6,
  );

  currentY -= rowH;

  // Signatory & Notes Footer
  if (currentY - 35 < 25) {
    page = doc.addPage([595.28, 841.89]);
    currentY = height - 40;
  }

  currentY -= 15;
  page.drawText(
    'Note: Dr (Debit) indicates amount receivable from customer. Cr (Credit) indicates payment received or store credit.',
    {
      x: leftMargin,
      y: currentY,
      size: 6.5,
      font: fontRegular,
      color: lightGray,
    },
  );

  page.drawText(
    'This is a computer generated account statement and does not require a physical signature.',
    {
      x: leftMargin,
      y: currentY - 10,
      size: 6.5,
      font: fontRegular,
      color: lightGray,
    },
  );

  const sigBrand = `For : ${companyName}`;
  const sigW = fontBold.widthOfTextAtSize(sigBrand, 7.5);
  page.drawText(safePdfText(sigBrand), {
    x: rightMargin - sigW,
    y: currentY,
    size: 7.5,
    font: fontBold,
    color: black,
  });

  const sigLabel = 'Authorized Signatory';
  const sigLW = fontRegular.widthOfTextAtSize(sigLabel, 7);
  page.drawText(sigLabel, {
    x: rightMargin - sigLW,
    y: currentY - 14,
    size: 7,
    font: fontRegular,
    color: darkGray,
  });

  const pdfBytes = await doc.save();
  const cleanName = data.party.name.replace(/[^a-zA-Z0-9]/g, '_');
  return { pdfBytes, filename: `Statement_${cleanName}.pdf` };
}
