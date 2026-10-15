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
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveryService.create(createDeliveryDto);
  }

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query('driverId') driverId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isDriver = req.user?.role === Role.DRIVER;
    const effectiveDriverId = isDriver ? req.user.id : driverId;
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.deliveryService.findAll(effectiveDriverId, isDriver, {
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.deliveryService.updateStatus(id, dto.status, dto.notes);
  }

  @Patch(':id/assign')
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.deliveryService.assignDriver(id, dto.driverId);
  }

  @Post(':id/push')
  pushDelivery(@Param('id') id: string, @Body() dto: PushDeliveryDto) {
    return this.deliveryService.pushDelivery(id, dto);
  }

  @Patch(':id/items/:itemIndex/pickup')
  updateItemPickup(
    @Param('id') id: string,
    @Param('itemIndex') itemIndex: string,
    @Body() dto: UpdateItemPickupDto,
  ) {
    return this.deliveryService.updateItemPickup(
      id,
      parseInt(itemIndex, 10),
      dto.pickedUp ?? true,
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
  handoverCash(
    @Param('id') id: string,
    @Body() dto: HandoverCashDto,
    @Request() req: RequestWithUser,
  ) {
    return this.deliveryService.handoverCash(id, req.user?.id, dto?.amount);
  }

  @Post(':id/trips')
  addTrip(@Param('id') id: string, @Body() tripDto: CreateTripDto) {
    return this.deliveryService.addTrip(id, tripDto);
  }
}
