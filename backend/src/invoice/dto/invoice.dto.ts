import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BusinessTerms,
  DeliveryType,
  DiscountApplicable,
  InvoiceFor,
  InvoiceStatus,
  PaymentType,
  VatWithheld,
} from '../entity/invoice.entity';
import { TaxCalculation } from '../entity/invoice.item.entity';


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

export class InvoiceListDto {
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
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  )
    return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
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


export class InvoiceDiscountInputDto {
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

export class InvoiceExtraChargeInputDto {
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

export class InvoiceItemInputDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  itemId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  itemGL?: string;

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
  @transformJsonArray(InvoiceDiscountInputDto)
  discounts?: InvoiceDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceExtraChargeInputDto)
  extraCharges?: InvoiceExtraChargeInputDto[];
}


export class InvoiceDto {
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
  invoiceDate!: string;

  @IsString()
  @IsNotEmpty()
  deliveryDate!: string;

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

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  contactPersonId?: number;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => safeNumber(value, 1))
  currencyConversionRate!: number;

  @IsEnum(VatWithheld)
  @IsNotEmpty()
  vatWithheld!: VatWithheld;

  @IsEnum(BusinessTerms)
  @IsNotEmpty()
  businessTerms!: BusinessTerms;

  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType!: PaymentType;

  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @IsEnum(DiscountApplicable)
  @IsNotEmpty()
  discountApplicable!: DiscountApplicable;

  @IsString()
  @IsNotEmpty()
  shippingState!: string;

  @IsString()
  @IsNotEmpty()
  billingState!: string;

  @IsString()
  @IsNotEmpty()
  deliveryState!: string;

  @IsEnum(DeliveryType)
  @IsNotEmpty()
  deliveryType!: DeliveryType;

  @IsOptional()
  @IsEnum(InvoiceFor)
  invoiceFor?: InvoiceFor;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  @ValidateIf((o) => o.invoiceFor === InvoiceFor.ORDER)
  sourceOrderId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  @ValidateIf((o) => o.invoiceFor === InvoiceFor.QUOTATION)
  sourceQuotationId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceItemInputDto)
  invoiceItems!: InvoiceItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceDiscountInputDto)
  invoiceDiscounts?: InvoiceDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceExtraChargeInputDto)
  invoiceExtraCharges?: InvoiceExtraChargeInputDto[];

  @IsOptional()
  @IsInt()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  addedBy?: number;
}


export class InvoiceUpdateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  invoiceId!: number;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

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
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  contactPersonId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => safeNumber(value, 1))
  currencyConversionRate?: number;

  @IsOptional()
  @IsEnum(VatWithheld)
  vatWithheld?: VatWithheld;

  @IsOptional()
  @IsEnum(BusinessTerms)
  businessTerms?: BusinessTerms;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @IsOptional()
  @IsEnum(DiscountApplicable)
  discountApplicable?: DiscountApplicable;

  @IsOptional()
  @IsString()
  shippingState?: string;

  @IsOptional()
  @IsString()
  billingState?: string;

  @IsOptional()
  @IsString()
  deliveryState?: string;

  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @IsOptional()
  @IsEnum(InvoiceFor)
  invoiceFor?: InvoiceFor;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  sourceOrderId?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  sourceQuotationId?: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceItemInputDto)
  invoiceItems?: InvoiceItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceDiscountInputDto)
  invoiceDiscounts?: InvoiceDiscountInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @transformJsonArray(InvoiceExtraChargeInputDto)
  invoiceExtraCharges?: InvoiceExtraChargeInputDto[];

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


export class InvoiceUpdateDueDateDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  invoiceId!: number;

  @IsString()
  @IsNotEmpty()
  @IsDateString()
  newDueDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  updatedBy?: number;
}
