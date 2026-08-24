import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { QuotationStatus, VatWithheld } from '../entity/quotation.entity';
import { TaxCalculation } from '../entity/quotation.item.entity';

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

export class QuotationListDto {
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

export class QuotationDiscountInputDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  manufacturerId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  discountPrice!: number;

  @IsString()
  @IsNotEmpty()
  discountDescription!: string;
}

export class QuotationExtraChargeInputDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  manufacturerId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  extraChargesPrice!: number;

  @IsString()
  @IsNotEmpty()
  extraChargesDescription!: string;
}

export class QuotationItemInputDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  itemId!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  quantity!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  unitPrice!: number;

  @IsEnum(TaxCalculation)
  @IsNotEmpty()
  taxCalculation!: TaxCalculation;

  @IsOptional()
  @IsString()
  taxGroup?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationDiscountInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  discounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationExtraChargeInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  extraCharges?: QuotationExtraChargeInputDto[];
}

export class QuotationDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  customerId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  currencyId!: number;

  @IsString()
  @IsNotEmpty()
  issueDate!: string;

  @IsString()
  @IsNotEmpty()
  expiryDate!: string;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  termsConditionsId?: number;

  @IsOptional()
  @IsString()
  termsConditionsText?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  bankBookId?: number;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  salesPersonId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  currencyConversionRate!: number;

  @IsEnum(VatWithheld)
  @IsNotEmpty()
  vatWithheld!: VatWithheld;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationItems!: QuotationItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationDiscountInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationDiscounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationExtraChargeInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationExtraCharges?: QuotationExtraChargeInputDto[];


  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class QuotationUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  quotationId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  customerId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  currencyId?: number;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  companyId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  termsConditionsId?: number;

  @IsOptional()
  @IsString()
  termsConditionsText?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  bankBookId?: number;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  salesPersonId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  currencyConversionRate?: number;

  @IsOptional()
  @IsEnum(VatWithheld)
  vatWithheld?: VatWithheld;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationItems?: QuotationItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationDiscountInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationDiscounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationExtraChargeInputDto)
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  quotationExtraCharges?: QuotationExtraChargeInputDto[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value).map(Number);
      } catch {
        return value.split(',').map(Number);
      }
    }
    return Array.isArray(value) ? value.map(Number) : value;
  })
  deletedAttachmentIds?: number[];

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  updatedBy?: number;
}
