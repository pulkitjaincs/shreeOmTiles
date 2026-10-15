export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'SALESMAN' | 'DRIVER' | 'OWNER';
  active: boolean;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName?: string;
  isPrimary: boolean;
}

export interface SystemSettings {
  companyName: string;
  taxRate: number;
  upiAccounts: UpiAccount[];
}
