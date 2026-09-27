import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Currency } from '../../../generated/prisma/enums';

export class UpsertPlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  currency?: Currency;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  propertyLimit: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  projectLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  highlight?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
