import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMode } from '@prisma/client';
import { PaymentSplitDto } from '../../common/dto/payment-split.dto';

export class CreateInvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

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
  @Min(0)
  discount?: number;
}

export class CreateNewPartyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^$|^\d{10}$/, {
    message: 'Customer phone number must be 10 digits if provided',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsOptional()
  isSaved?: boolean;
}

export class CreateInvoiceDto {
  @IsISO8601()
  @IsOptional()
  invoiceDate?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNewPartyDto)
  newParty?: CreateNewPartyDto;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  isCashSale?: boolean;

  @IsNumber()
  @IsOptional()
  previousBalance?: number;

  @IsEnum(PaymentMode)
  @IsOptional()
  paymentMode?: PaymentMode;

  @IsNumber()
  @IsOptional()
  amountPaidNow?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  payments?: PaymentSplitDto[];

  @IsNumber()
  @IsOptional()
  taxRate?: number; // e.g. 18 for 18% GST

  @IsNumber()
  @IsOptional()
  @Min(0)
  transportCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  transportGstRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  roundOffEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  roundOffAmount?: number;

  @IsString()
  @IsOptional()
  quotationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
