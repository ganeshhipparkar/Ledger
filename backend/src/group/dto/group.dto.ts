import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
  Matches,
} from 'class-validator';
import { EntitySchemaOptions } from 'typeorm';

export enum isOptional {  
  YES = 'yes',
  NO = 'no',
}
export enum isStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class GroupDto {
  @IsString()
  @Length(2, 20)
  groupName!: string;

  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'groupCode can only contain letters, numbers, and underscores' })
  groupCode!: string;

  @IsString()
  @IsEnum(isStatus)
  status!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  addedBy!: number;

  @IsOptional()
  groupFile: any;
}

export class GroupUpdateDto {
  @IsInt()
  @IsNotEmpty()
  groupId!: number;

  @IsNotEmpty()
  @IsString()
  @Length(2, 20)
  groupName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'groupCode can only contain letters, numbers, and underscores' })
  groupCode!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  updatedBy!: number;

  @IsOptional()
  @IsString()
  @IsEnum(isStatus)
  status!: string;
}

export class getGroupListDto {
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
