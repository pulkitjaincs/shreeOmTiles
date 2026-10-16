import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ProcessReturnDto } from './dto/process-return.dto';
import { PreviewUpiQrDto } from './dto/preview-upi-qr.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import type { Response } from 'express';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(Role.SALESMAN, Role.ADMIN)
  create(
    @Request() req: RequestWithUser,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(createInvoiceDto, req.user.id);
  }

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.invoicesService.findAll(req.user, {
      page: pageNum,
      limit: limitNum,
    });
  }

  @Post('preview-upi-qr')
  previewUpiQr(@Body() dto: PreviewUpiQrDto) {
    return this.invoicesService.previewUpiQr(
      dto.amount,
      dto.vpa,
      dto.merchantName,
    );
  }

  @Get('lookup/:query')
  lookupInvoice(@Param('query') query: string) {
    return this.invoicesService.lookupInvoice(query);
  }

  @Post(':id/return')
  @Roles(Role.ADMIN)
  processReturn(
    @Param('id') id: string,
    @Body() returnData: ProcessReturnDto,
    @Request() req: RequestWithUser,
  ) {
    return this.invoicesService.processReturn(id, returnData, req.user.id);
  }

  @Get('refund/:refundId/pdf')
  async downloadRefundPdf(
    @Param('refundId') refundId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { pdfBytes, invoiceNo } =
      await this.invoicesService.generateRefundPdf(refundId);
    const etag = `"${invoiceNo}-${pdfBytes.length}"`;
    if (req.headers && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoiceNo}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('ETag', etag);
    res.end(Buffer.from(pdfBytes));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/upi-qr')
  getUpiQr(@Param('id') id: string) {
    return this.invoicesService.getUpiQr(id);
  }

  @Get(':id/share')
  getShareInfo(@Param('id') id: string) {
    return this.invoicesService.getShareInfo(id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { pdfBytes, invoiceNo } = await this.invoicesService.generatePdf(id);
    const etag = `"${invoiceNo}-${pdfBytes.length}"`;
    if (req.headers && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoiceNo}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('ETag', etag);
    res.end(Buffer.from(pdfBytes));
  }
}
