import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, { message: 'Phone number must be strictly 10 digits' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
