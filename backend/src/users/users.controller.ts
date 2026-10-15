import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import {
  UpdateUserDto,
  UpdatePasswordDto,
  UpdateUserStatusDto,
} from './dto/update-user.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  findAll(@Query('role') role?: Role, @Query('isActive') isActive?: string) {
    return this.usersService.findAll({
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post()
  @Roles(Role.OWNER)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Patch('profile/password')
  updateOwnPassword(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(req.user.id, dto.password);
  }

  @Patch('profile/push-token')
  updatePushToken(
    @Request() req: RequestWithUser,
    @Body('pushToken') pushToken: string,
  ) {
    return this.usersService.updatePushToken(req.user.id, pushToken);
  }

  @Patch(':id/password')
  @Roles(Role.OWNER)
  updatePassword(@Param('id') id: string, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(id, dto.password);
  }

  @Patch(':id/status')
  @Roles(Role.OWNER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto.isActive);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.usersService.remove(id, req.user?.id);
  }
}
