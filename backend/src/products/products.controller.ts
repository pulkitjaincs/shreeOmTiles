import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  Header,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  create(
    @Request() req: RequestWithUser,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(createProductDto, req.user?.id);
  }

  @Get()
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SALESMAN,
    Role.ACCOUNTANT,
    Role.SUPERVISOR,
  )
  @Header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')
  findAll(
    @Request() req: RequestWithUser,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.productsService.findAll(
      {
        category,
        search,
        page: pageNum,
        limit: limitNum,
      },
      req.user,
    );
  }

  @Get(':id')
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SALESMAN,
    Role.ACCOUNTANT,
    Role.SUPERVISOR,
  )
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.productsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
