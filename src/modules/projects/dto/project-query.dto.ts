import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Currency, ProjectCategory, ProjectStage } from '../../../generated/prisma/enums';

export enum ProjectSort {
  RECENT = 'recent',
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  FEATURED = 'featured',
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class ProjectQueryDto {
  @IsOptional()
  @IsEnum(ProjectCategory)
  category?: ProjectCategory;

  @IsOptional()
  @IsEnum(ProjectStage)
  stage?: ProjectStage;

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
  @IsEnum(ProjectSort)
  sort?: ProjectSort;

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
