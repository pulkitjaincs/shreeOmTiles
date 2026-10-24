import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import {
  CreateDeliveryDto,
  CreateTripDto,
  PushDeliveryDto,
  UpdateDeliveryStatusDto,
  UpdateItemPickupDto,
  CollectCashDto,
  HandoverCashDto,
  AssignDriverDto,
} from './dto/create-delivery.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import type { Request as ExpressRequest, Response } from 'express';

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveryService.create(createDeliveryDto);
  }

  @Get()
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.ACCOUNTANT,
    Role.SALESMAN,
    Role.DRIVER,
    Role.SUPERVISOR,
  )
  findAll(
    @Request() req: RequestWithUser,
    @Query('driverId') driverId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isDriver = req.user?.role === Role.DRIVER;
    const effectiveDriverId = isDriver ? req.user.id : driverId;
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.deliveryService.findAll(
      effectiveDriverId,
      isDriver,
      {
        page: pageNum,
        limit: limitNum,
        dateFilter: { preset: preset as any, from, to },
      },
      req.user,
    );
  }

  @Get(':id')
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.ACCOUNTANT,
    Role.SALESMAN,
    Role.DRIVER,
    Role.SUPERVISOR,
  )
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.deliveryService.findOne(id, req.user);
  }

  @Get(':id/challan-pdf')
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.ACCOUNTANT,
    Role.SALESMAN,
    Role.DRIVER,
    Role.SUPERVISOR,
  )
  async downloadChallanPdf(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const { pdfBytes, invoiceNo } =
      await this.deliveryService.generateChallanPdf(id);
    const etag = `"challan-${invoiceNo}-${pdfBytes.length}"`;
    if (req.headers && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="challan-${invoiceNo}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader(
      'Cache-Control',
      'private, max-age=86400, stale-while-revalidate=3600',
    );
    res.setHeader('ETag', etag);
    res.end(Buffer.from(pdfBytes));
  }

  @Patch(':id/status')
  @Roles(Role.OWNER, Role.ADMIN, Role.DRIVER, Role.SUPERVISOR)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.deliveryService.updateStatus(
      id,
      dto.status,
      dto.notes,
      req.user,
    );
  }

  @Patch(':id/assign')
  @Roles(Role.OWNER, Role.ADMIN)
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.deliveryService.assignDriver(id, dto.driverId);
  }

  @Post(':id/push')
  @Roles(Role.OWNER, Role.ADMIN)
  pushDelivery(@Param('id') id: string, @Body() dto: PushDeliveryDto) {
    return this.deliveryService.pushDelivery(id, dto);
  }

  @Patch(':id/items/:itemIndex/pickup')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)
  updateItemPickup(
    @Param('id') id: string,
    @Param('itemIndex') itemIndex: string,
    @Body() dto: UpdateItemPickupDto,
    @Request() req: RequestWithUser,
  ) {
    return this.deliveryService.updateItemPickup(
      id,
      parseInt(itemIndex, 10),
      dto.pickedUp ?? true,
      req.user,
    );
  }

  @Patch(':id/collect-cash')
  collectCash(
    @Param('id') id: string,
    @Body() dto: CollectCashDto,
    @Request() req: RequestWithUser,
  ) {
    return this.deliveryService.collectCash(
      id,
      dto.amount,
      dto.notes,
      req.user?.id,
    );
  }

  @Patch(':id/handover-cash')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SALESMAN)
  handoverCash(
    @Param('id') id: string,
    @Body() dto: HandoverCashDto,
    @Request() req: RequestWithUser,
  ) {
    return this.deliveryService.handoverCash(id, req.user?.id, dto?.amount);
  }

  @Post(':id/trips')
  @Roles(Role.OWNER, Role.ADMIN)
  addTrip(@Param('id') id: string, @Body() tripDto: CreateTripDto) {
    return this.deliveryService.addTrip(id, tripDto);
  }
}
