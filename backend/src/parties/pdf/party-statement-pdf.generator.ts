import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
    phone: string;
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

  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightBorder = rgb(0.7, 0.7, 0.7);
  const headerBg = rgb(0.95, 0.95, 0.95);
  const brandNavy = rgb(0.08, 0.18, 0.42);
  const emerald = rgb(0.06, 0.6, 0.35);
  const rose = rgb(0.85, 0.15, 0.15);

  const leftMargin = 36;
  const rightMargin = width - 36;
  const contentWidth = rightMargin - leftMargin;

  const companyName = process.env.COMPANY_NAME || 'SHREE OM TILES';
  const companyAddress =
    process.env.COMPANY_ADDRESS ||
    'Shop no 3, Ashok Vihar palam vihar Road Gurgaon';
  const companyPhone = process.env.COMPANY_PHONE || '9212953538';

  let currentY = height - 32;

  // Header Banner
  page.drawRectangle({
    x: leftMargin,
    y: currentY - 54,
    width: contentWidth,
    height: 54,
    color: brandNavy,
  });

  page.drawText(safePdfText(companyName), {
    x: leftMargin + 12,
    y: currentY - 20,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safePdfText(companyAddress), {
    x: leftMargin + 12,
    y: currentY - 34,
    size: 8,
    font: fontRegular,
    color: rgb(0.85, 0.88, 0.95),
  });
  page.drawText(
    safePdfText(`Phone: ${companyPhone} | Email: shreeomtiles@gmail.com`),
    {
      x: leftMargin + 12,
      y: currentY - 46,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.88, 0.95),
    },
  );

  const stTitle = 'ACCOUNT STATEMENT';
  const stw = fontBold.widthOfTextAtSize(stTitle, 12);
  page.drawText(stTitle, {
    x: rightMargin - 12 - stw,
    y: currentY - 22,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  const dateRangeStr = `${data.startDate || 'All Time'} to ${data.endDate || 'Present'}`;
  const dsw = fontRegular.widthOfTextAtSize(dateRangeStr, 8);
  page.drawText(dateRangeStr, {
    x: rightMargin - 12 - dsw,
    y: currentY - 38,
    size: 8,
    font: fontRegular,
    color: rgb(0.85, 0.88, 0.95),
  });

  currentY -= 54;

  // Customer Details Box
  const custBoxHeight = 52;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - custBoxHeight,
    width: contentWidth,
    height: custBoxHeight,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  page.drawText('CUSTOMER DETAILS', {
    x: leftMargin + 10,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText(safePdfText(data.party.name.toUpperCase()), {
    x: leftMargin + 10,
    y: currentY - 28,
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
      y: currentY - 42,
      size: 8,
      font: fontRegular,
      color: darkGray,
    },
  );
  if (data.party.gstin) {
    page.drawText(safePdfText(`GSTIN: ${data.party.gstin}`), {
      x: rightMargin - 120,
      y: currentY - 28,
      size: 8,
      font: fontBold,
      color: brandNavy,
    });
  }

  currentY -= custBoxHeight;

  // Khata Metric Cards
  const kpiBoxHeight = 44;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - kpiBoxHeight,
    width: contentWidth,
    height: kpiBoxHeight,
    color: headerBg,
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const kpiColW = contentWidth / 4;

  // Col 1: Total Billed
  page.drawText('TOTAL BILLED', {
    x: leftMargin + 10,
    y: currentY - 14,
    size: 7,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(`Rs. ${data.totalBilled.toLocaleString('en-IN')}`, {
    x: leftMargin + 10,
    y: currentY - 32,
    size: 10,
    font: fontBold,
    color: black,
  });

  // Col 2: Total Received
  page.drawText('PAYMENTS RECEIVED', {
    x: leftMargin + kpiColW + 10,
    y: currentY - 14,
    size: 7,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(`Rs. ${data.totalPaid.toLocaleString('en-IN')}`, {
    x: leftMargin + kpiColW + 10,
    y: currentY - 32,
    size: 10,
    font: fontBold,
    color: emerald,
  });

  // Col 3: Total Returns
  page.drawText('RETURNS / CREDITS', {
    x: leftMargin + kpiColW * 2 + 10,
    y: currentY - 14,
    size: 7,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(`Rs. ${data.totalReturns.toLocaleString('en-IN')}`, {
    x: leftMargin + kpiColW * 2 + 10,
    y: currentY - 32,
    size: 10,
    font: fontBold,
    color: darkGray,
  });

  // Col 4: Outstanding Balance
  page.drawText('NET OUTSTANDING', {
    x: leftMargin + kpiColW * 3 + 10,
    y: currentY - 14,
    size: 7,
    font: fontBold,
    color: darkGray,
  });
  const balSuffix = data.closingBalance >= 0 ? 'Dr (Due)' : 'Cr (Advance)';
  page.drawText(
    `Rs. ${Math.abs(data.closingBalance).toLocaleString('en-IN')} ${balSuffix}`,
    {
      x: leftMargin + kpiColW * 3 + 10,
      y: currentY - 32,
      size: 9.5,
      font: fontBold,
      color: data.closingBalance > 0 ? rose : emerald,
    },
  );

  currentY -= kpiBoxHeight;

  // Ledger Table Header
  const tableHeaderHeight = 20;
  page.drawRectangle({
    x: leftMargin,
    y: currentY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: rgb(0.9, 0.92, 0.96),
    borderColor: lightBorder,
    borderWidth: 1,
  });

  const cDate = leftMargin;
  const cType = leftMargin + 65;
  const cRef = leftMargin + 140;
  const cPart = leftMargin + 225;
  const cDr = leftMargin + 355;
  const cCr = leftMargin + 435;
  const cBal = leftMargin + 515;

  const lthY = currentY - 14;
  page.drawText('Date', {
    x: cDate + 6,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Voucher Type', {
    x: cType + 6,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Ref No.', {
    x: cRef + 6,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Particulars', {
    x: cPart + 6,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Debit (Dr)', {
    x: cDr - 15,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Credit (Cr)', {
    x: cCr - 15,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });
  page.drawText('Balance', {
    x: cBal - 20,
    y: lthY,
    size: 7.5,
    font: fontBold,
    color: brandNavy,
  });

  currentY -= tableHeaderHeight;

  const rowH = 18;

  for (const entry of data.entries) {
    if (currentY - rowH < 40) {
      page = doc.addPage([595.28, 841.89]);
      currentY = height - 40;

      // Repeat table header on subsequent pages
      page.drawRectangle({
        x: leftMargin,
        y: currentY - tableHeaderHeight,
        width: contentWidth,
        height: tableHeaderHeight,
        color: rgb(0.9, 0.92, 0.96),
        borderColor: lightBorder,
        borderWidth: 1,
      });
      const nthY = currentY - 14;
      page.drawText('Date', {
        x: cDate + 6,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Voucher Type', {
        x: cType + 6,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Ref No.', {
        x: cRef + 6,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Particulars', {
        x: cPart + 6,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Debit (Dr)', {
        x: cDr - 15,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Credit (Cr)', {
        x: cCr - 15,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      page.drawText('Balance', {
        x: cBal - 20,
        y: nthY,
        size: 7.5,
        font: fontBold,
        color: brandNavy,
      });
      currentY -= tableHeaderHeight;
    }

    page.drawRectangle({
      x: leftMargin,
      y: currentY - rowH,
      width: contentWidth,
      height: rowH,
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
      x: cDate + 6,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: black,
    });
    page.drawText(safePdfText(entry.voucherType.slice(0, 14)), {
      x: cType + 6,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: black,
    });
    page.drawText(safePdfText(entry.refNo.slice(0, 14)), {
      x: cRef + 6,
      y: lrY,
      size: 7,
      font: fontBold,
      color: black,
    });
    page.drawText(safePdfText(entry.particulars.slice(0, 24)), {
      x: cPart + 6,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: darkGray,
    });

    const drStr =
      entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString('en-IN')}` : '—';
    const crStr =
      entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString('en-IN')}` : '—';
    const balStr = `${Math.abs(entry.balance).toLocaleString('en-IN')} ${entry.balance >= 0 ? 'Dr' : 'Cr'}`;

    page.drawText(drStr, {
      x: cDr - 15,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: entry.debit > 0 ? rose : darkGray,
    });
    page.drawText(crStr, {
      x: cCr - 15,
      y: lrY,
      size: 7,
      font: fontRegular,
      color: entry.credit > 0 ? emerald : darkGray,
    });
    page.drawText(balStr, {
      x: cBal - 20,
      y: lrY,
      size: 7,
      font: fontBold,
      color: black,
    });

    currentY -= rowH;
  }

  const pdfBytes = await doc.save();
  const cleanName = data.party.name.replace(/[^a-zA-Z0-9]/g, '_');
  return { pdfBytes, filename: `Statement_${cleanName}.pdf` };
}
