import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMode, CreditType, PaymentType } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsEnum(PaymentMode)
  @IsNotEmpty()
  mode: PaymentMode;

  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @IsNumber()
  @Min(0.01)
  amount: number;

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
