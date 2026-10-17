export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'SALESMAN' | 'DRIVER' | 'OWNER' | 'DIRECTOR' | 'SUPERVISOR';
  scope?: string | null;
  active: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName?: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface SystemSettings {
  id?: string;
  companyName?: string;
  merchantName?: string;
  upiId?: string;
  taxRate?: number;
  upiAccounts: UpiAccount[];
  [key: string]: any;
}
