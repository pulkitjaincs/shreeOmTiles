import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { UpdateUpiDto } from './dto/update-upi.dto';
import { AddUpiAccountDto } from './dto/add-upi-account.dto';
import { Prisma } from '@prisma/client';

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName: string;
  isPrimary: boolean;
  createdAt: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private parseUpiAccounts(
    raw: unknown,
    fallbackUpi?: string | null,
    fallbackMerchant?: string | null,
  ): UpiAccount[] {
    const accounts: UpiAccount[] = [];
    if (Array.isArray(raw)) {
      for (let idx = 0; idx < raw.length; idx++) {
        const item: unknown = raw[idx];
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const upiId =
            typeof record.upiId === 'string' ? record.upiId.trim() : '';
          if (upiId.length > 0) {
            const id =
              typeof record.id === 'string' && record.id.trim().length > 0
                ? record.id.trim()
                : `upi_${idx + 1}`;
            const merchantName =
              typeof record.merchantName === 'string' &&
              record.merchantName.trim().length > 0
                ? record.merchantName.trim()
                : fallbackMerchant?.trim() || 'Shree Om Tiles';
            const isPrimary = Boolean(record.isPrimary);
            const createdAt =
              typeof record.createdAt === 'string' &&
              record.createdAt.trim().length > 0
                ? record.createdAt.trim()
                : new Date().toISOString();
            accounts.push({
              id,
              upiId,
              merchantName,
              isPrimary,
              createdAt,
            });
          }
        }
      }
    }

    // If accounts is empty but a single upiId exists, bootstrap it
    if (accounts.length === 0 && fallbackUpi && fallbackUpi.trim().length > 0) {
      accounts.push({
        id: 'upi_default',
        upiId: fallbackUpi.trim(),
        merchantName: fallbackMerchant?.trim() || 'Shree Om Tiles',
        isPrimary: true,
        createdAt: new Date().toISOString(),
      });
    }

    // Ensure at least one is primary if accounts exist
    if (accounts.length > 0 && !accounts.some((a) => a.isPrimary)) {
      accounts[0].isPrimary = true;
    }

    return accounts;
  }

  async getSettings() {
    // Settings cache: 3 hours (10800 seconds)
    return this.cacheService.wrap('settings:default', 10800, async () => {
      let setting = await this.prisma.companySetting.findUnique({
        where: { id: 'default' },
      });

      if (!setting) {
        setting = await this.prisma.companySetting.create({
          data: {
            id: 'default',
            upiId: process.env.UPI_VPA || null,
            merchantName: process.env.UPI_MERCHANT_NAME || 'Shree Om Tiles',
            upiAccounts: process.env.UPI_VPA
              ? [
                  {
                    id: 'upi_default',
                    upiId: process.env.UPI_VPA,
                    merchantName:
                      process.env.UPI_MERCHANT_NAME || 'Shree Om Tiles',
                    isPrimary: true,
                    createdAt: new Date().toISOString(),
                  },
                ]
              : [],
          },
        });
      }

      const accounts = this.parseUpiAccounts(
        setting.upiAccounts,
        setting.upiId,
        setting.merchantName,
      );
      const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;

      return {
        upiId: primary?.upiId || setting.upiId || null,
        merchantName:
          primary?.merchantName || setting.merchantName || 'Shree Om Tiles',
        isConfigured: accounts.length > 0 || Boolean(setting.upiId),
        upiAccounts: accounts,
        updatedAt: setting.updatedAt,
      };
    });
  }

  async addUpiAccount(dto: AddUpiAccountDto) {
    const cleanUpi = dto.upiId.trim();
    if (!cleanUpi.includes('@')) {
      throw new BadRequestException(
        'Please enter a valid UPI ID (e.g. yourname@bank or 9876543210@paytm)',
      );
    }

    const cleanMerchant =
      dto.merchantName && dto.merchantName.trim().length > 0
        ? dto.merchantName.trim()
        : 'Shree Om Tiles';

    const currentSettings = await this.getSettings();
    const existingAccounts = currentSettings.upiAccounts;

    // Check for duplicate UPI ID
    if (
      existingAccounts.some(
        (a) => a.upiId.toLowerCase() === cleanUpi.toLowerCase(),
      )
    ) {
      throw new BadRequestException(`UPI ID "${cleanUpi}" is already added.`);
    }

    const isFirstOrPrimary =
      Boolean(dto.isPrimary) || existingAccounts.length === 0;

    const newAccount: UpiAccount = {
      id: `upi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      upiId: cleanUpi,
      merchantName: cleanMerchant,
      isPrimary: isFirstOrPrimary,
      createdAt: new Date().toISOString(),
    };

    const updatedAccounts = existingAccounts.map((a) =>
      isFirstOrPrimary ? { ...a, isPrimary: false } : a,
    );
    updatedAccounts.push(newAccount);

    const primaryAccount =
      updatedAccounts.find((a) => a.isPrimary) || newAccount;

    const saved = await this.prisma.companySetting.upsert({
      where: { id: 'default' },
      update: {
        upiId: primaryAccount.upiId,
        merchantName: primaryAccount.merchantName,
        upiAccounts: updatedAccounts as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: 'default',
        upiId: primaryAccount.upiId,
        merchantName: primaryAccount.merchantName,
        upiAccounts: updatedAccounts as unknown as Prisma.InputJsonValue,
      },
    });

    this.cacheService.invalidatePrefix('settings:');
    return {
      success: true,
      message: `✓ Added UPI ID ${newAccount.upiId} successfully`,
      newAccount,
      upiAccounts: updatedAccounts,
      activeUpiId: saved.upiId,
      merchantName: saved.merchantName,
    };
  }

  async deleteUpiAccount(id: string) {
    const currentSettings = await this.getSettings();
    const existingAccounts = currentSettings.upiAccounts;

    const targetIndex = existingAccounts.findIndex((a) => a.id === id);
    if (targetIndex === -1) {
      throw new NotFoundException(`UPI account with ID "${id}" not found.`);
    }

    const removed = existingAccounts[targetIndex];
    let updatedAccounts = existingAccounts.filter((a) => a.id !== id);

    // If removed account was primary, nominate next account as primary
    if (removed.isPrimary && updatedAccounts.length > 0) {
      updatedAccounts = updatedAccounts.map((a, i) =>
        i === 0 ? { ...a, isPrimary: true } : a,
      );
    }

    const newPrimary = updatedAccounts.find((a) => a.isPrimary) || null;

    const saved = await this.prisma.companySetting.upsert({
      where: { id: 'default' },
      update: {
        upiId: newPrimary?.upiId || null,
        merchantName: newPrimary?.merchantName || 'Shree Om Tiles',
        upiAccounts: updatedAccounts as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: 'default',
        upiId: newPrimary?.upiId || null,
        merchantName: newPrimary?.merchantName || 'Shree Om Tiles',
        upiAccounts: updatedAccounts as unknown as Prisma.InputJsonValue,
      },
    });

    this.cacheService.invalidatePrefix('settings:');
    return {
      success: true,
      message: `✓ Removed UPI ID ${removed.upiId}`,
      upiAccounts: updatedAccounts,
      activeUpiId: saved.upiId,
    };
  }

  async setPrimaryUpiAccount(id: string) {
    const currentSettings = await this.getSettings();
    const existingAccounts = currentSettings.upiAccounts;

    const target = existingAccounts.find((a) => a.id === id);
    if (!target) {
      throw new NotFoundException(`UPI account with ID "${id}" not found.`);
    }

    const updatedAccounts = existingAccounts.map((a) => ({
      ...a,
      isPrimary: a.id === id,
    }));

    const saved = await this.prisma.companySetting.upsert({
      where: { id: 'default' },
      update: {
        upiId: target.upiId,
        merchantName: target.merchantName,
        upiAccounts: updatedAccounts,
      },
      create: {
        id: 'default',
        upiId: target.upiId,
        merchantName: target.merchantName,
        upiAccounts: updatedAccounts,
      },
    });

    this.cacheService.invalidatePrefix('settings:');
    return {
      success: true,
      message: `✓ Primary UPI ID set to ${target.upiId}`,
      upiAccounts: updatedAccounts,
      activeUpiId: saved.upiId,
    };
  }

  async updateUpi(dto: UpdateUpiDto) {
    const cleanUpi =
      dto.upiId && dto.upiId.trim().length > 0 ? dto.upiId.trim() : null;
    const cleanMerchant =
      dto.merchantName && dto.merchantName.trim().length > 0
        ? dto.merchantName.trim()
        : 'Shree Om Tiles';

    if (cleanUpi) {
      return this.addUpiAccount({
        upiId: cleanUpi,
        merchantName: cleanMerchant,
        isPrimary: true,
      });
    }

    // If null/empty upiId passed: clear all accounts
    const setting = await this.prisma.companySetting.upsert({
      where: { id: 'default' },
      update: {
        upiId: null,
        merchantName: cleanMerchant,
        upiAccounts: [],
      },
      create: {
        id: 'default',
        upiId: null,
        merchantName: cleanMerchant,
        upiAccounts: [],
      },
    });

    this.cacheService.invalidatePrefix('settings:');
    return {
      success: true,
      message: 'Store UPI ID removed',
      upiId: setting.upiId,
      merchantName: setting.merchantName,
      isConfigured: false,
      upiAccounts: [],
    };
  }
}
