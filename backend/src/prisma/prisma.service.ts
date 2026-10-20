import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: 10, // Safe connection limit for Neon connection pooler
      idleTimeoutMillis: 1800000, // 30 minutes keep-alive to avoid frequent SSL handshake churn
      connectionTimeoutMillis: 10000, // 10s timeout to allow Neon serverless compute wake-up
    });

    // Handle unexpected idle client errors (e.g. Neon compute sleep / SSL disconnects)
    // to prevent Node.js from terminating the process on unhandled EventEmitter error
    pool.on('error', (err) => {
      this.logger.warn(`PostgreSQL idle client disconnected: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
