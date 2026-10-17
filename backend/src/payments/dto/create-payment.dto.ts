import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMode, CreditType, PaymentType } from '@prisma/client';
import { PaymentSplitDto } from '../../common/dto/payment-split.dto';

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsEnum(PaymentMode)
  @IsOptional()
  mode?: PaymentMode;

  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  splits?: PaymentSplitDto[];

  @IsString()
  @IsOptional()
  upiTxnRef?: string;

  @IsString()
  @IsOptional()
  upiUtr?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  autoConfirm?: boolean;
}

export class CreateCreditDto {
  @IsString()
  @IsNotEmpty()
  partyId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(CreditType)
  @IsOptional()
  type?: CreditType;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
