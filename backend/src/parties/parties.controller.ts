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
  Res,
} from '@nestjs/common';
import { PartiesService } from './parties.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request as ExpressRequest, Response } from 'express';

@Controller('parties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  create(@Body() createPartyDto: CreatePartyDto) {
    return this.partiesService.create(createPartyDto);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  findAll(
    @Query('search') search?: string,
    @Query('includeUnsaved') includeUnsaved?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.partiesService.findAll(search, includeUnsaved === 'true', {
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.partiesService.findOne(id);
  }

  @Get(':id/statement-pdf')
  @Roles(Role.OWNER, Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  async downloadStatementPdf(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const { pdfBytes, filename } =
      await this.partiesService.generateStatementPdf(id, startDate, endDate);
    const etag = `"statement-${id}-${pdfBytes.length}"`;
    if (req.headers && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader(
      'Cache-Control',
      'private, max-age=3600, stale-while-revalidate=600',
    );
    res.setHeader('ETag', etag);
    res.end(Buffer.from(pdfBytes));
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SALESMAN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() updatePartyDto: UpdatePartyDto) {
    return this.partiesService.update(id, updatePartyDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  remove(@Param('id') id: string) {
    return this.partiesService.remove(id);
  }
}
