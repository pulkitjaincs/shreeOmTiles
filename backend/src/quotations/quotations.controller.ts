import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, PaymentMode } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import type { Request as ExpressRequest, Response } from 'express';

@Controller('quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  create(
    @Request() req: RequestWithUser,
    @Body() createQuotationDto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(createQuotationDto, req.user.id);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.quotationsService.findAll(
      { page: pageNum, limit: limitNum },
      search,
    );
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Get(':id/pdf')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const { pdfBytes, quotationNo } =
      await this.quotationsService.generatePdf(id);
    const etag = `"estimate-${quotationNo}-${pdfBytes.length}"`;
    if (req.headers && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Estimate-${quotationNo}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader(
      'Cache-Control',
      'private, max-age=86400, stale-while-revalidate=3600',
    );
    res.setHeader('ETag', etag);
    res.end(Buffer.from(pdfBytes));
  }

  @Post(':id/convert-to-invoice')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  convertToInvoice(
    @Param('id') id: string,
    @Body()
    body: {
      paymentMode?: PaymentMode;
      amountPaidNow?: number;
      payments?: any[];
    },
    @Request() req: RequestWithUser,
  ) {
    return this.quotationsService.convertToInvoice(
      id,
      req.user.id,
      body.paymentMode,
      body.amountPaidNow,
      body.payments,
    );
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  update(
    @Param('id') id: string,
    @Body() dto: CreateQuotationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.quotationsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.quotationsService.delete(id, req.user.id);
  }
}
