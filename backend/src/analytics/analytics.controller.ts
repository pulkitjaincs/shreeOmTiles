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
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  getDashboard(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
  ) {
    return this.analyticsService.getDashboard({ from, to, preset }, req.user);
  }

  @Get('summary')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getSummary() {
    return this.analyticsService.getSummary();
  }

  @Get('transactions')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getTransactions() {
    return this.analyticsService.getRecentTransactions(15);
  }

  @Get('category-split')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getCategorySplit() {
    return this.analyticsService.getCategorySplit();
  }

  @Get('payment-split')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getPaymentSplit() {
    return this.analyticsService.getPaymentSplit();
  }

  @Get('salesmen')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getSalesmen() {
    return this.analyticsService.getSalesmanPerformance();
  }

  @Get('day-book')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  getDayBook(@Query('date') date?: string) {
    return this.analyticsService.getDayBook(date);
  }

  @Get('gst-reports')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  getGstReports(@Query('month') month?: string, @Query('year') year?: string) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.analyticsService.getGstReports(m, y);
  }
}
