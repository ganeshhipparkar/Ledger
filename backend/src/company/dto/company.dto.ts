import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { AllowManualInvoicing } from '../entity/company.entity';

export enum isStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class CompanyDto {
  @IsString()
  @Length(2, 100)
  companyName!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value).map(Number);
      } catch {
        return value.split(',').map(Number);
      }
    }
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    return value;
  })
  curIds?: number[];

  @IsString()
  @Length(2, 20)
  companyCode!: string;

  @IsString()
  @IsEnum(isStatus)
  status!: string;

  @IsOptional()
  @IsEnum(AllowManualInvoicing)
  allowManualInvoicing?: AllowManualInvoicing;

  // @IsOptional()
  // @IsString()
  // @Length(2, 100)
  // companyLocation?: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  website!: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  dialCode!: number;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  addedBy?: number;

  @IsNotEmpty()
  @IsString()
  country!: string;

  @IsNotEmpty()
  @IsString()
  state!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  postalCode!: number;

  @IsNotEmpty()
  @IsString()
  AddressLineOne!: string;

  @IsNotEmpty()
  @IsString()
  ownerName!: string;

  @IsNotEmpty()
  @IsEmail()
  ownerEmail!: string;

  @IsNotEmpty()
  @IsString()
  ownerPhone!: string;

  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : null)
  ownerPhoneDialCode?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : null)
  ownerDialCode?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    const val = Array.isArray(value) ? value[0] : value;
    if (val === '' || val === 'null' || val === null || val === undefined) {
      return null;
    }
    const num = Number(val);
    return isNaN(num) ? val : num;
  })
  parentCompanyId?: number | null;

  @IsOptional()
  companyFile: any;
}

export class CompanyUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    const val = Array.isArray(value) ? value[0] : value;
    if (val === '' || val === 'null' || val === null || val === undefined) {
      return null;
    }
    const num = Number(val);
    return isNaN(num) ? val : num;
  })
  parentCompanyId?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value).map(Number);
      } catch {
        return value.split(',').map(Number);
      }
    }
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    return value;
  })
  curIds?: number[];

  @IsOptional()
  @IsString()
  @Length(2, 100)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  companyCode?: string;

  // @IsOptional()
  // @IsString()
  // @Length(2, 100)
  // companyLocation?: string;

  @IsOptional()
  @IsString()
  @IsEnum(isStatus)
  status?: string;

  @IsOptional()
  @IsEnum(AllowManualInvoicing)
  allowManualInvoicing?: AllowManualInvoicing;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  dialCode?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  postalCode!: number;

  @IsOptional()
  @IsString()
  AddressLineOne?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  updatedBy!: number;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : null)
  ownerPhoneDialCode?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : null)
  ownerDialCode?: number;

  @IsOptional()
  companyFile: any;

  @IsOptional()
  @IsString()
  removeCompanyFile?: string; // "true" when the user explicitly removed the existing logo
}

export class getCompanyListDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  page!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  limit!: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => filterDto)
  filters: any;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class filterDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  operator!: string;
}
