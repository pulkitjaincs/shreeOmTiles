import { IsOptional, IsString } from 'class-validator';

export class UpdateUpiDto {
  @IsString()
  @IsOptional()
  upiId?: string;

  @IsString()
  @IsOptional()
  merchantName?: string;
}
