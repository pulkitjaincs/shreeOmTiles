import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddUpiAccountDto {
  @IsString()
  @IsNotEmpty()
  upiId: string;

  @IsString()
  @IsOptional()
  merchantName?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
