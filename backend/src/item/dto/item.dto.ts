import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import {
  Archive,
  IsDecimalAllowed,
  ShelfLife,
  ShelfLifeUnit,
  Status,
} from '../entity/item.entity';

export class filterDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsNotEmpty()
  value!: any;

  @IsString()
  @IsNotEmpty()
  operator!: string;
}

export class ItemListDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  page!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  limit!: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => filterDto)
  filters?: filterDto[];
}

export class ItemDto {
  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  categoryId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  manufacturerId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  brandId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  itemUom!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  packageUom?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  primitiveQuantity!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  purchasePrice!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  costPerUnit!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  sourceCurrencyId!: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  conversionRate?: number;

  @IsOptional()
  @IsEnum(IsDecimalAllowed)
  isDecimalAllowed?: IsDecimalAllowed;

  @IsOptional()
  @IsEnum(ShelfLife)
  checkShelfLife?: ShelfLife;

  @IsOptional()
  @IsEnum(ShelfLifeUnit)
  shelfLifeUnit?: ShelfLifeUnit;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  shelfLifeSpan?: number;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsEnum(Archive)
  archive?: Archive;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class ItemUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  itemId!: number;

  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  companyId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  manufacturerId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  brandId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  itemUom?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  packageUom?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  primitiveQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  costPerUnit?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  sourceCurrencyId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  conversionRate?: number;

  @IsOptional()
  @IsEnum(IsDecimalAllowed)
  isDecimalAllowed?: IsDecimalAllowed;

  @IsOptional()
  @IsEnum(ShelfLife)
  checkShelfLife?: ShelfLife;

  @IsOptional()
  @IsEnum(ShelfLifeUnit)
  shelfLifeUnit?: ShelfLifeUnit;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  shelfLifeSpan?: number;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsEnum(Archive)
  archive?: Archive;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  updatedBy?: number;
}
