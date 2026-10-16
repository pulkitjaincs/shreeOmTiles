import { Request } from 'express';
import { Role } from '@prisma/client';

export interface RequestWithUser extends Request {
  user: {
    id: string;
    role: Role;
    phone?: string;
    name?: string;
  };
}
