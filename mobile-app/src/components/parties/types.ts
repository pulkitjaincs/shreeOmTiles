export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  createdAt?: string;
}

export interface StatementInvoice {
  id: string;
  invoiceNo: string;
  total: number;
  status: string;
  paymentMode?: string;
  createdAt: string;
  items?: { id: string; quantity: number }[];
  payments?: { id: string; amount: number; status: string }[];
}

export interface StatementCreditLedger {
  id: string;
  amountDue: number;
  status: string;
  dueDate?: string;
  invoice?: {
    invoiceNo: string;
  };
}

export interface PartyStatementData {
  party: Party;
  invoices: StatementInvoice[];
  creditLedgers: StatementCreditLedger[];
}
