import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsIn,
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

export class CustomerListDto {
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

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsOptional()
  customerLogo: any;

  @IsNotEmpty()
  @IsEmail()
  customerEmail!: string;

  @IsNotEmpty()
  customerIncorporationDate!: Date;

  @IsNotEmpty()
  @IsInt()
  @Transform(({ value }) => Number(value))
  dialCode!: number;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsNotEmpty()
  @IsString()
  country!: string;

  @IsNotEmpty()
  @IsString()
  state!: string;

  @IsNotEmpty()
  @IsString()
  city?: string;

  @IsNotEmpty()
  @IsString()
  AddressLineOne?: string;

  @IsNotEmpty()
  @IsInt()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  postalCode?: number;

  @IsNotEmpty()
  @IsString()
  ownerFirstName!: string;

  @IsNotEmpty()
  @IsString()
  ownerLastName!: string;

  @IsNotEmpty()
  @IsEmail()
  ownerEmail!: string;

  @IsNotEmpty()
  @IsString()
  ownerPhone!: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  ownerDialCode?: number;

  @IsNotEmpty()
  ownerDob!: Date;

  @IsString()
  @IsNotEmpty()
  @IsIn(['Active', 'Inactive'])
  status!: 'Active' | 'Inactive';

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
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class CustomerUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  customerId!: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  customerLogo: any;

  @IsOptional()
  @IsString()
  removeCustomerLogo?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  customerIncorporationDate?: Date;

  @IsOptional()
  @IsInt()
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

  @IsOptional()
  @IsString()
  AddressLineOne?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  postalCode?: number;

  @IsOptional()
  @IsString()
  ownerFirstName?: string;

  @IsOptional()
  @IsString()
  ownerLastName?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  ownerDialCode?: number;

  @IsOptional()
  ownerDob?: Date;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

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
  @IsInt()
  @Transform(({ value }) => Number(value))
  updatedBy?: number;
}
