import { Role } from '@prisma/client';

export interface RequestWithUser {
  user: {
    id: string;
    role: Role;
    phone?: string;
    name?: string;
  };
}
