import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(prewarm?: boolean) {
    let dbStatus = 'skipped';
    let dbLatencyMs: number | undefined;

    if (prewarm) {
      const start = Date.now();
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
        dbLatencyMs = Date.now() - start;
      } catch (err: unknown) {
        dbStatus = `error: ${(err as Error).message}`;
      }
    }

    return {
      status: 'ok',
      service: 'Shree Om Tiles Backend API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      ...(prewarm ? { database: dbStatus, dbLatencyMs } : {}),
    };
  }
}
