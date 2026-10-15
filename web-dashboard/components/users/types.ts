export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  scope?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  drivers: number;
}
