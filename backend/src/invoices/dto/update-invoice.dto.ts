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
import { PaymentSplitDto } from '../../common/dto/payment-split.dto';
import { CreateInvoiceItemDto, CreateNewPartyDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
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
  taxRate?: number;

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
