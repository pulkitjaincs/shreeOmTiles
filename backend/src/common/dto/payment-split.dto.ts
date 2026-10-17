import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class PaymentSplitDto {
  @IsEnum(PaymentMode)
  @IsNotEmpty()
  mode: PaymentMode;

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
}
