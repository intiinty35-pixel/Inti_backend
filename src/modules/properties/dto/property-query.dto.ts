import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Currency, OperationType, PropertyType } from '../../../generated/prisma/enums';

export enum PropertySort {
  RECENT = 'recent',
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  AREA_DESC = 'area-desc',
  FEATURED = 'featured',
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class PropertyQueryDto {
  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(1)
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(1)
  priceMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(0)
  bedroomsMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(0)
  bathroomsMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(1)
  areaMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @Min(1)
  areaMax?: number;

  @IsOptional()
  @IsEnum(PropertySort)
  sort?: PropertySort;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  pageSize = 20;
}
