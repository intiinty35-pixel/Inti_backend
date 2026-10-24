import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Currency,
  LotMode,
  LotStatus,
  MediaType,
  ProjectCategory,
  ProjectStage,
} from '../../../generated/prisma/enums';

export class ProjectLocationDto {
  @IsString()
  @IsNotEmpty()
  department!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class ProjectSocialDto {
  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class ProjectLotDto {
  @IsString()
  @IsNotEmpty()
  lotNumber!: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsNumber()
  @Min(1)
  areaM2!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  frontM?: number;

  @IsNumber()
  @Min(1)
  price!: number;

  @IsEnum(LotStatus)
  status!: LotStatus;

  @IsOptional()
  @IsString()
  planLocation?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  lotCount?: number;
}

export class ProjectMilestoneDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ProjectMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class CreateProjectDto {
  @IsOptional()
  @IsEnum(ProjectCategory)
  category?: ProjectCategory;

  @IsEnum(ProjectStage)
  stage!: ProjectStage;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  description!: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsNumber()
  @Min(1)
  priceFrom!: number;

  @IsNumber()
  @Min(1)
  priceTo!: number;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  downPayment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPayment?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  financing?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  totalBlocks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalLots?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectSocialDto)
  social?: ProjectSocialDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  @IsString()
  urbanizationName?: string;

  @IsOptional()
  @IsString()
  registryEntry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ValidateNested()
  @Type(() => ProjectLocationDto)
  location!: ProjectLocationDto;

  @IsEnum(LotMode)
  lotMode!: LotMode;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ProjectLotDto)
  lots!: ProjectLotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestones?: ProjectMilestoneDto[];

  @IsOptional()
  @IsDateString()
  constructionStart?: string;

  @IsDateString()
  estimatedDelivery!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectMediaDto)
  media!: ProjectMediaDto[];

  @IsOptional()
  @IsString()
  tourUrl?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactWhatsapp?: string;
}
