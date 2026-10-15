import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN)
  getDashboard(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
  ) {
    return this.analyticsService.getDashboard({ from, to, preset }, req.user);
  }

  @Get('summary')
  @Roles(Role.OWNER, Role.ADMIN)
  getSummary() {
    return this.analyticsService.getSummary();
  }

  @Get('transactions')
  @Roles(Role.OWNER, Role.ADMIN)
  getTransactions() {
    return this.analyticsService.getRecentTransactions(15);
  }

  @Get('category-split')
  @Roles(Role.OWNER, Role.ADMIN)
  getCategorySplit() {
    return this.analyticsService.getCategorySplit();
  }

  @Get('payment-split')
  @Roles(Role.OWNER, Role.ADMIN)
  getPaymentSplit() {
    return this.analyticsService.getPaymentSplit();
  }

  @Get('salesmen')
  @Roles(Role.OWNER, Role.ADMIN)
  getSalesmen() {
    return this.analyticsService.getSalesmanPerformance();
  }
}
