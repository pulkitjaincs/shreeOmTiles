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
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseDto,
  CreateDebitNoteDto,
} from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  create(
    @Request() req: RequestWithUser,
    @Body() createPurchaseDto: CreatePurchaseDto,
  ) {
    return this.purchasesService.create(createPurchaseDto, req.user.id);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SUPERVISOR)
  findAll(
    @Request() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.purchasesService.findAll(
      { page: pageNum, limit: limitNum },
      search,
      req.user,
      preset || from || to ? { preset: preset as any, from, to } : undefined,
    );
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT, Role.SUPERVISOR)
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.purchasesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  update(
    @Param('id') id: string,
    @Body() dto: CreatePurchaseDto,
    @Request() req: RequestWithUser,
  ) {
    return this.purchasesService.update(id, dto, req.user.id);
  }

  @Post(':id/debit-note')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  createDebitNote(
    @Param('id') id: string,
    @Body() dto: CreateDebitNoteDto,
    @Request() req: RequestWithUser,
  ) {
    return this.purchasesService.createDebitNote(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.purchasesService.deletePurchase(id, req.user.id);
  }
}
