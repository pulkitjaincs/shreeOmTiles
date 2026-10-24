import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  CreateCreditDto,
  UpdatePaymentDto,
} from './dto/create-payment.dto';
import { PreviewUpiQrDto } from '../invoices/dto/preview-upi-qr.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    if (req.user?.role === Role.SALESMAN) {
      if (createPaymentDto.type === 'OUTFLOW') {
        throw new ForbiddenException(
          'Salesmen are not permitted to disburse store payments or settle debts',
        );
      }
      if (!createPaymentDto.invoiceId) {
        throw new ForbiddenException(
          'Salesmen can only collect payments for specific invoices created by them',
        );
      }
    }
    return this.paymentsService.create(createPaymentDto, req.user);
  }

  @Get('stats')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  getStats(@Request() req: RequestWithUser) {
    return this.paymentsService.getStats(req.user);
  }

  @Get(['pending', 'pending-invoices'])
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  getPendingItems(@Request() req: RequestWithUser) {
    return this.paymentsService.getPendingItems(req.user);
  }

  @Get(['credits', 'credit'])
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  findAllCreditLedgers(@Request() req: RequestWithUser) {
    return this.paymentsService.findAllCreditLedgers(req.user);
  }

  @Post('credit')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  recordCredit(@Body() createCreditDto: CreateCreditDto) {
    return this.paymentsService.recordCredit(createCreditDto);
  }

  @Post('preview-upi-qr')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  previewUpiQr(@Body() dto: PreviewUpiQrDto) {
    return this.paymentsService.previewUpiQr(
      dto.amount,
      dto.note,
      dto.vpa,
      dto.merchantName,
    );
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Request() req?: RequestWithUser,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.paymentsService.findAll(
      { page: pageNum, limit: limitNum, search, dateFilter: { preset: preset as any, from, to } },
      req?.user,
    );
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  findOne(@Param('id') id: string, @Request() req?: RequestWithUser) {
    return this.paymentsService.findOne(id, req?.user);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.updateReceivedPayment(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.paymentsService.deletePayment(id, req.user.id);
  }

  @Patch(':id/confirm')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  confirmPatch(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.paymentsService.confirmPayment(id, req.user.id);
  }

  @Post(':id/confirm')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  confirmPost(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.paymentsService.confirmPayment(id, req.user.id);
  }
}
