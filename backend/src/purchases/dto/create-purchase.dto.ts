import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMode } from '@prisma/client';
import { CreateNewPartyDto } from '../../invoices/dto/create-invoice.dto';

export class CreatePurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;
}

export class CreatePurchaseDto {
  @IsString()
  @IsOptional()
  vendorBillNo?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNewPartyDto)
  newParty?: CreateNewPartyDto;

  @IsEnum(PaymentMode)
  @IsOptional()
  paymentMode?: PaymentMode;

  @IsNumber()
  @IsOptional()
  amountPaidNow?: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number; // e.g. 18

  @IsNumber()
  @IsOptional()
  transportCost?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}

export class CreateDebitNoteDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
