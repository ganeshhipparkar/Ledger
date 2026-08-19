import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsIn,
  IsNumber,
} from 'class-validator';

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

export class bankBookListDto {
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

export class BankBookDto {
  @IsString()
  @IsNotEmpty()
  bankBookName!: string;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  bankId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  currencyId!: number;

  @IsString()
  @IsNotEmpty()
  beneficiaryName!: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['Active', 'Inactive'])
  status!: 'Active' | 'Inactive';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class BankBookUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  bankBookId!: number;

  @IsOptional()
  @IsString()
  bankBookName?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  bankId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  companyId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  currencyId?: number;

  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  updatedBy?: number;
}
