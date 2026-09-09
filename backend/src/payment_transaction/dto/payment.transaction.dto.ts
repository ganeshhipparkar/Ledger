import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PaymentMode } from '../entity/payment.transaction.entity';

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

export class PaymentTransactionListDto {
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

export class PaymentTransactionDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  customerId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  currencyId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  bankBookId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode!: PaymentMode;

  @IsString()
  @IsNotEmpty()
  paymentDate!: string;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  exchangeRate!: number;

  @IsString()
  @IsNotEmpty()
  exchangeDate!: string;

  @IsString()
  @IsNotEmpty()
  narration!: string;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  transactionAmount!: number;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  addedBy?: number;
}

export class PaymentTransactionUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  paymentTransactionId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  customerId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  currencyId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  bankBookId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  companyId?: number;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  exchangeDate?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  transactionAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

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

export class PaymentTransactionStatusDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  paymentTransactionId!: number;

  @IsString()
  @IsNotEmpty()
  remarks!: string;
}
