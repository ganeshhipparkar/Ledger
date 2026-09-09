import { Transform, Type, plainToInstance } from 'class-transformer';
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

const safeNumber = (value: any, fallback: number = 0): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
};

const safeOptionalNumber = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'undefined') return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
};

const safeRequiredId = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'undefined') return undefined;
  const n = Number(value);
  return isNaN(n) || n <= 0 ? undefined : n;
};

const transformJsonArray = <T>(cls: new () => T) => {
  return Transform(({ value }) => {
    if (!value) return undefined;
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    if (!Array.isArray(parsed)) return undefined;
    return plainToInstance(cls, parsed);
  });
};

export class QuotationDiscountInputDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  manufacturerId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 0))
  discountPrice!: number;

  @IsString()
  @IsNotEmpty()
  discountDescription!: string;
}

export class QuotationExtraChargeInputDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  manufacturerId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 0))
  extraChargesPrice!: number;

  @IsString()
  @IsNotEmpty()
  extraChargesDescription!: string;
}

export class QuotationItemInputDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  itemId!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 0))
  quantity!: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 0))
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
  @transformJsonArray(QuotationDiscountInputDto)
  discounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationExtraChargeInputDto)
  extraCharges?: QuotationExtraChargeInputDto[];
}

export class QuotationDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  customerId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  currencyId!: number;

  @IsString()
  @IsNotEmpty()
  issueDate!: string;

  @IsString()
  @IsNotEmpty()
  expiryDate!: string;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  companyId!: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  termsConditionsId?: number;

  @IsOptional()
  @IsString()
  termsConditionsText?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  bankBookId?: number;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  salesPersonId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 1))
  currencyConversionRate!: number;

  @IsEnum(VatWithheld)
  @IsNotEmpty()
  vatWithheld!: VatWithheld;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationItemInputDto)
  quotationItems!: QuotationItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationDiscountInputDto)
  quotationDiscounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationExtraChargeInputDto)
  quotationExtraCharges?: QuotationExtraChargeInputDto[];


  @IsOptional()
  @IsInt() 
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  parentQuotationId?: number;

  @IsOptional()
  @IsInt() 
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  cloneFromId?: number;

  @IsOptional()
  @IsString() 
  versionCode?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class QuotationUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  quotationId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  customerId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  currencyId?: number;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  companyId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  termsConditionsId?: number;

  @IsOptional()
  @IsString()
  termsConditionsText?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  bankBookId?: number;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  salesPersonId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => safeNumber(value, 1))
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
  @transformJsonArray(QuotationItemInputDto)
  quotationItems?: QuotationItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationDiscountInputDto)
  quotationDiscounts?: QuotationDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(QuotationExtraChargeInputDto)
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
