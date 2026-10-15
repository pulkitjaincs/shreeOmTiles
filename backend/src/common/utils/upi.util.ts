import * as QRCode from 'qrcode';

export interface GenerateUpiQrOptions {
  vpa: string;
  merchantName: string;
  amount: number | string;
  transactionRef: string;
  transactionNote?: string;
}

export interface UpiQrResult {
  vpa: string;
  merchantName: string;
  amount: number;
  upiUri: string;
  qrDataUrl: string;
}

/**
 * Standard NPCI UPI Intent URI and QR code generator
 */
export async function generateUpiIntentQr(
  options: GenerateUpiQrOptions,
): Promise<UpiQrResult> {
  const amtNum =
    typeof options.amount === 'number'
      ? options.amount
      : parseFloat(options.amount) || 0;
  const amtStr = amtNum.toFixed(2);
  const note = options.transactionNote || `Payment ${options.transactionRef}`;
  const noteParam = encodeURIComponent(note);
  const pnParam = encodeURIComponent(options.merchantName || 'Merchant');
  const upiUri = `upi://pay?pa=${options.vpa}&pn=${pnParam}&am=${amtStr}&tr=${options.transactionRef}&tn=${noteParam}&cu=INR`;
  const qrDataUrl = await QRCode.toDataURL(upiUri, { width: 300, margin: 2 });

  return {
    vpa: options.vpa,
    merchantName: options.merchantName,
    amount: amtNum,
    upiUri,
    qrDataUrl,
  };
}
