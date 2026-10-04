import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class InvestmentOpportunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  summary!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  areaLabel!: string;

  @IsNumber()
  @Min(1)
  initialInvestment!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  roiPercent!: number;

  @IsIn(['plusvalia', 'construccion', 'renta'])
  investmentGoal!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  location!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  province!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  district!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsUrl({ require_protocol: true })
  coverImageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverImagePublicId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  highlights?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
