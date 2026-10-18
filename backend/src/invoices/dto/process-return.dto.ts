import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class ReturnItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  customItemName?: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number;
}

export class ProcessReturnDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsEnum(PaymentMode)
  refundMode: PaymentMode;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ProcessStandaloneReturnDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsEnum(PaymentMode)
  refundMode: PaymentMode;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsOptional()
  newParty?: {
    name: string;
    phone?: string;
    address?: string;
    gstin?: string;
  };

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  originalInvoiceNumber?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
