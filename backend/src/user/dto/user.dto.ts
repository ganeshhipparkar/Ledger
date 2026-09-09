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
  Min,
  ValidateNested,
  Matches,
  IsDateString,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  IsIn,
  IsBoolean,
} from 'class-validator';

export function IsAdult(minAge = 18, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAdult',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [minAge],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true;
          const dob = new Date(value);
          if (isNaN(dob.getTime())) return false;
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
          const targetMinAge = args.constraints[0];
          return age >= targetMinAge;
        },
        defaultMessage(args: ValidationArguments) {
          return `User must be at least ${args.constraints[0]} years old`;
        },
      },
    });
  };
}

export enum isOptional {
  true = 'true',
  false = 'false',
}

export enum isStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum isRole {
  COMPANY_ADMIN = 'companyAdmin',
  WAREHOUSE_ADMIN = 'warehouseAdmin',
  USER = 'user',
}

export class UserDto {
  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  middleName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  surname?: string;

  @IsEmail()
  email!: string;

  @IsNotEmpty({ message: 'Date of Birth is required' })
  @IsDateString({}, { message: 'Invalid Date of Birth format' })
  @IsAdult(18, { message: 'User must be at least 18 years old' })
  dob!: string;

  @IsString()
  @IsEnum(isStatus)
  status!: string;

  @IsOptional()
  @IsString()
  @Length(4, 15)
  phone!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsOptional()
  userFile: any;

  @IsOptional()
  dialCode: any;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  createdBy!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  updatedBy!: number;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  groupId!: number;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  is_parent?: number;
}

export class userUpdateDto {
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  userId!: number;

  @IsOptional()
  @IsString()
  @Length(3, 20)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  userName?: string; // immutable

  @IsOptional()
  @IsEmail()
  email?: string; // immutable

  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  middleName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  surname?: string;

  @IsOptional()
  dialCode: any;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  remarks?: string;

  @IsOptional()
  @IsString()
  removeUserFile?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid Date of Birth format' })
  @IsAdult(18, { message: 'User must be at least 18 years old' })
  dob?: string;

  @IsOptional()
  @IsString()
  @IsEnum(isStatus)
  status!: string;

  @IsOptional()
  @IsString()
  @Length(4, 15)
  phone!: string;

  @IsOptional()
  userFile!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  createdBy!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  updatedBy!: number;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  groupId!: number;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  companyId!: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value))
  is_parent?: number;
}

export class UserPassDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNotEmpty()
  @IsString()
  newuserpass!: string;
}

export class login {
  // Either email or userName can be used for login. Both are optional but at least one must be provided.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Username cannot be empty' })
  userName?: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class forgotPass {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class confirmOtp {
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  otp!: number;
}

export class resetpass {
  @IsString()
  @IsNotEmpty()
  token!: number;

  @IsString()
  @IsNotEmpty()
  password!: number;

  @IsString()
  @IsNotEmpty()
  confirmPass!: number;
}

export class changePass {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: number;

  @IsString()
  @IsNotEmpty()
  confirmpass!: number;

  @IsString()
  @IsNotEmpty()
  newpass!: number;
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

export class getUserListDto {
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
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  self?:boolean;

}

export class adminResetPass {
  @IsInt()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

export class selectProfileDto {
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  userId!: number;

  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  ucgId!: number;
}
