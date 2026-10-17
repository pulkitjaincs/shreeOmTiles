import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  IsInt,
} from 'class-validator';

export class AdjustStockDto {
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
  quantity: number; // The new total quantity (SET) or incoming quantity (ADD)

  @IsString()
  @IsOptional()
  @IsIn(['SET', 'ADD'])
  mode?: 'SET' | 'ADD';
}

export class TransferStockDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  fromWarehouseId: string;

  @IsString()
  @IsNotEmpty()
  toWarehouseId: string;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsInt()
  @IsNotEmpty()
  quantity: number;
}

export class ZeroOutStockDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;
}
