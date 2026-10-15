import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

export interface AuthUserData {
  id: string;
  name: string;
  phone: string;
  role: Role;
  scope?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    phone: string,
    pass: string,
  ): Promise<AuthUserData | null> {
    const user = await this.usersService.findOne(phone);
    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      return null;
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated by the owner. You cannot log into the application.',
      );
    }
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      scope: user.scope,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  login(user: AuthUserData) {
    const payload = {
      phone: user.phone,
      sub: user.id,
      name: user.name,
      role: user.role,
      scope: user.scope,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        scope: user.scope,
      },
    };
  }
}
