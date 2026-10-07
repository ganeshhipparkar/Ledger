import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { CustomerCharges } from '../entity/debit.note.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';
import { NoteMode } from 'src/credit_note/entity/credit.note.entity';

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

const safeNumber = (value: any, fallback = 0): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
};

export class DebitNoteDto {
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
  currencyId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => safeRequiredId(value))
  invoiceId!: number;

  @IsOptional()
  @IsEnum(CustomerCharges)
  @ValidateIf((o) => o.noteMode !== NoteMode.INVOICE)
  customerCharges?: CustomerCharges;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.noteMode !== NoteMode.INVOICE)
  narration?: string;

  @IsOptional()
  @IsEnum(TaxCalculation)
  @ValidateIf((o) => o.noteMode !== NoteMode.INVOICE)
  taxCalculation?: TaxCalculation;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => safeOptionalNumber(value))
  @ValidateIf((o) => o.noteMode !== NoteMode.INVOICE && o.taxCalculation && o.taxCalculation !== TaxCalculation.NA)
  taxGroupId?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => safeNumber(value, 0))
  @ValidateIf((o) => o.noteMode !== NoteMode.INVOICE)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsEnum(NoteMode)
  @IsOptional()
  noteMode?: NoteMode;

  @IsOptional()
  items?: any;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  addedBy?: number;
}

export class DebitNoteListDto {
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
  filters?: Array<{ key: string; value: any; operator: string }>;
}
