import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsInt,
  IsNumber,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  category: string; // e.g. "Tiles", "Sanitaryware", "Fittings", "Adhesives"

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>; // e.g. { size: "600x1200mm", finish: "Glossy", price: 850 }

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsString()
  @IsOptional()
  unit?: string; // "box", "sqft", "piece", "set"

  @IsString()
  @IsOptional()
  initialWarehouseId?: string;

  @IsInt()
  @IsOptional()
  initialQuantity?: number;

  @IsString()
  @IsOptional()
  initialBatchNo?: string;
}
