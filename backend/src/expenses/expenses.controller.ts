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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, ExpenseCategory } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  create(
    @Request() req: RequestWithUser,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    return this.expensesService.create(createExpenseDto, req.user.id);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: ExpenseCategory,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.expensesService.findAll(
      { page: pageNum, limit: limitNum },
      { category, startDate, endDate, search },
    );
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Request() req: RequestWithUser,
  ) {
    return this.expensesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.expensesService.delete(id, req.user.id);
  }
}
