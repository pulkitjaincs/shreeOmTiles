import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PreviewUpiQrDto {
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  vpa?: string;

  @IsString()
  @IsOptional()
  merchantName?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
