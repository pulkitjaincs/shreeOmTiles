import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'Mobile number must be strictly 10 digits' })
  phone?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}

export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
