import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WarehouseType } from '@prisma/client';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsEnum(WarehouseType)
  @IsOptional()
  type?: WarehouseType;
}
