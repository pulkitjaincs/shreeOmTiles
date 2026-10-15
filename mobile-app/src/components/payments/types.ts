export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName?: string;
  isPrimary: boolean;
}

export interface UpiPreviewData {
  qrDataUrl: string;
  upiUri: string;
  amount: number;
  vpa: string;
  merchantName?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string;
  partyId?: string;
  amount: number;
  type: 'INFLOW' | 'OUTFLOW';
  mode: 'CASH' | 'UPI';
  status: string;
  upiTxnRef?: string;
  upiUtr?: string;
  notes?: string;
  createdAt: string;
  party?: Party;
  invoice?: {
    id: string;
    invoiceNo: string;
  };
}

export interface CreditRecord {
  partyId: string;
  partyName: string;
  partyPhone: string;
  totalDue: number;
  invoiceCount: number;
}

export interface PaymentStats {
  todayInflow: number;
  todayOutflow: number;
  todayNet: number;
  totalOutstandingCredit: number;
}
