import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StockService } from './stock.service';
import {
  AdjustStockDto,
  TransferStockDto,
  ZeroOutStockDto,
} from './dto/stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SALESMAN,
    Role.SUPERVISOR,
    Role.ACCOUNTANT,
  )
  findAll(
    @Request() req: RequestWithUser,
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('inStockOnly') inStockOnly?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const inStockOnlyBool =
      inStockOnly?.toLowerCase() === 'true' ||
      inStockOnly === '1' ||
      inStockOnly === '';
    return this.stockService.findAll(
      {
        productId,
        warehouseId,
        page: pageNum,
        limit: limitNum,
        inStockOnly: inStockOnly !== undefined ? inStockOnlyBool : undefined,
      },
      req.user,
    );
  }

  @Post('adjust')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)
  adjustStock(@Request() req: RequestWithUser, @Body() dto: AdjustStockDto) {
    return this.stockService.adjustStock(dto, req.user.id);
  }

  @Post('transfer')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)
  transferStock(
    @Request() req: RequestWithUser,
    @Body() dto: TransferStockDto,
  ) {
    return this.stockService.transferStock(dto, req.user.id, req.user);
  }

  @Post('zero-out')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)
  zeroOutStock(@Request() req: RequestWithUser, @Body() dto: ZeroOutStockDto) {
    return this.stockService.zeroOutStock(dto, req.user.id);
  }
}
