import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
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

export class DeliveryNoteListDto {
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

const safeRequiredId = (value: any): number | undefined => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  )
    return undefined;
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

export class DeliveryNoteItemInputDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  orderItemId!: number;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  @Transform(({ value }) => safeNumber(value, 0))
  deliverQuantity!: number;
}

export class DeliveryNoteDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  companyId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  customerId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  orderId!: number;

  @IsString()
  @IsNotEmpty()
  deliveryDate!: string;

  @IsString()
  @IsNotEmpty()
  receiverName!: string;

  @IsString()
  @IsNotEmpty()
  billingAddress!: string;

  @IsOptional()
  @IsString()
  receiverSignature?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @transformJsonArray(DeliveryNoteItemInputDto)
  deliveryNoteItems!: DeliveryNoteItemInputDto[];
}
