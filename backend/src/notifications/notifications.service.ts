import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save or update an Expo Push Token for a user
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { pushToken: token },
      });
      this.logger.log(`Updated push token for user: ${userId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to save push token for user ${userId}`, msg);
    }
  }

  /**
   * Send a raw push notification via Expo Push API
   */
  async sendExpoPush(payload: PushPayload): Promise<boolean> {
    if (!payload.to || !payload.to.startsWith('ExponentPushToken[')) {
      this.logger.debug(
        `Skipping invalid or missing push token: ${payload.to}`,
      );
      return false;
    }

    try {
      const res = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sound: 'default',
          priority: 'high',
          ...payload,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Expo push failed with status: ${res.status}`);
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send push notification to ${payload.to}`,
        msg,
      );
      return false;
    }
  }

  /**
   * Notify a specific user by their User ID
   */
  async notifyUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { pushToken: true, isActive: true },
      });

      if (user && user.isActive && user.pushToken) {
        await this.sendExpoPush({
          to: user.pushToken,
          title,
          body,
          data,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error notifying user ${userId}`, msg);
    }
  }

  /**
   * Broadcast a notification to all active users with specific roles (e.g. OWNER, ADMIN)
   */
  async notifyRoles(
    roles: Role[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          role: { in: roles },
          isActive: true,
          pushToken: { not: null },
        },
        select: { pushToken: true },
      });

      for (const u of users) {
        if (u.pushToken) {
          await this.sendExpoPush({
            to: u.pushToken,
            title,
            body,
            data,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error notifying roles ${roles.join(',')}`, msg);
    }
  }

  /**
   * Convenience method to notify Owner and Admins
   */
  async notifyAdmins(
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    return this.notifyRoles([Role.OWNER, Role.ADMIN], title, body, data);
  }
}
