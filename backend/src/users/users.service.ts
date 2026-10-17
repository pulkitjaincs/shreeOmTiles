import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (existing) {
      throw new BadRequestException(
        'A user with this mobile number already exists',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    return this.prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        role: data.role,
        scope: data.scope,
        passwordHash,
      },
    });
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If mobile number changed, ensure no duplicate
    if (data.phone && data.phone !== user.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          'A user with this mobile number already exists',
        );
      }
    }

    // Protect business director role
    if (user.role === Role.OWNER && data.role && data.role !== Role.OWNER) {
      throw new BadRequestException(
        'Cannot change the role of the business director',
      );
    }

    let passwordHash = user.passwordHash;
    if (data.password && data.password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.scope !== undefined ? { scope: data.scope } : {}),
        ...(data.password ? { passwordHash } : {}),
      },
    });
  }

  async updatePassword(
    id: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!newPassword || newPassword.trim().length < 6) {
      throw new BadRequestException(
        'Password must be at least 6 characters long',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async updateStatus(id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Director cannot be marked inactive
    if (user.role === Role.OWNER && !isActive) {
      throw new BadRequestException(
        'The business director account cannot be marked inactive',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async updatePushToken(
    id: string,
    pushToken: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id },
      data: { pushToken: pushToken || null },
    });
    return { success: true };
  }

  async remove(
    id: string,
    actorId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Requirement: Cannot remove the director themselves
    if (user.role === Role.OWNER) {
      throw new BadRequestException('The business director cannot be removed');
    }

    if (user.id === actorId) {
      throw new BadRequestException(
        'You cannot remove your own active account',
      );
    }

    try {
      // Try hard delete if user has no foreign key relations (invoices, deliveries, payments)
      await this.prisma.user.delete({ where: { id } });
      return { success: true, message: 'Staff member removed successfully' };
    } catch {
      // If historical audit records exist (invoices, past deliveries), safely deactivate and soft-delete
      const timestamp = Date.now();
      await this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          phone: `${user.phone}-del-${timestamp}`,
          name: `[Removed] ${user.name}`,
        },
      });
      return {
        success: true,
        message: 'Staff member removed and archived successfully',
      };
    }
  }

  async findOne(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAll(query?: { role?: Role; isActive?: boolean }) {
    const where: Prisma.UserWhereInput = {
      phone: { not: { contains: '-del-' } },
    };

    if (query?.role) {
      where.role = query.role;
    }
    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        scope: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(): Promise<number> {
    return this.prisma.user.count({
      where: { phone: { not: { contains: '-del-' } } },
    });
  }
}
