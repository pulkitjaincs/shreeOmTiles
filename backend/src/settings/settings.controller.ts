import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateUpiDto } from './dto/update-upi.dto';
import { AddUpiAccountDto } from './dto/add-upi-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('upi')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  updateUpi(@Body() dto: UpdateUpiDto) {
    return this.settingsService.updateUpi(dto);
  }

  @Post('upi-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  addUpiAccount(@Body() dto: AddUpiAccountDto) {
    return this.settingsService.addUpiAccount(dto);
  }

  @Delete('upi-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  deleteUpiAccount(@Param('id') id: string) {
    return this.settingsService.deleteUpiAccount(id);
  }

  @Patch('upi-accounts/:id/primary')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  setPrimaryUpiAccount(@Param('id') id: string) {
    return this.settingsService.setPrimaryUpiAccount(id);
  }
}
