import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    if (
      createPaymentDto.type === 'OUTFLOW' &&
      req.user?.role === Role.SALESMAN
    ) {
      throw new ForbiddenException(
        'Salesmen are not permitted to disburse store payments or settle debts',
      );
    }
    return this.paymentsService.create(createPaymentDto, req.user?.id);
  }

  @Get('stats')
  getStats() {
    return this.paymentsService.getStats();
  }

  @Get(['pending', 'pending-invoices'])
  getPendingItems() {
    return this.paymentsService.getPendingItems();
  }

  @Get(['credits', 'credit'])
  findAllCreditLedgers() {
    return this.paymentsService.findAllCreditLedgers();
  }

  @Post('credit')
  @Roles(Role.ADMIN)
  recordCredit(@Body() createCreditDto: CreateCreditDto) {
    return this.paymentsService.recordCredit(createCreditDto);
  }

  @Post('preview-upi-qr')
  previewUpiQr(@Body() dto: PreviewUpiQrDto) {
    return this.paymentsService.previewUpiQr(
      dto.amount,
      dto.note,
      dto.vpa,
      dto.merchantName,
    );
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.paymentsService.findAll({
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.updateReceivedPayment(id, dto, req.user.id);
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
