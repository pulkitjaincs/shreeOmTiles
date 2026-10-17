import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class CreateDeliveryDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  @IsNotEmpty()
  status: DeliveryStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateTripDto {
  @IsString()
  @IsOptional()
  vehicle?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DispatchedItemDto {
  @IsString()
  @IsOptional()
  invoiceItemId?: string;

  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsString()
  unit: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  warehouseName?: string;

  @IsString()
  @IsOptional()
  warehouseAddress?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsOptional()
  pickedUp?: boolean;

  @IsOptional()
  @IsString()
  pickedUpAt?: string;
}

export class PushDeliveryDto {
  @IsString()
  @IsOptional()
  driverId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supervisorIds?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  transportCost?: number;

  @IsString()
  @IsOptional()
  vehicle?: string;

  @IsString()
  @IsOptional()
  vehicleNo?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  amountToCollect?: number;

  @IsOptional()
  items?: DispatchedItemDto[];
}

export class UpdateItemPickupDto {
  @IsOptional()
  pickedUp?: boolean;
}

export class CollectCashDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class HandoverCashDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;
}

export class AssignDriverDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;
}
