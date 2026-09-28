import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ConservationStatus,
  Currency,
  OperationType,
  PropertyType,
} from '../../../generated/prisma/enums';

export class PropertyLocationDto {
  @IsString()
  @IsNotEmpty()
  department!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  reference?: string;

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

  @IsBoolean()
  approximateLocation = true;
}

export class PropertyDetailsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalArea?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  constructedArea?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  halfBathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  parkingSpaces?: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  floors?: number;

  @IsOptional()
  @IsInt()
  @Min(1800)
  constructionYear?: number;

  @IsOptional()
  @IsEnum(ConservationStatus)
  conservationStatus?: ConservationStatus;

  @IsOptional()
  @IsObject()
  specificDetails?: Record<string, unknown>;
}

export class PropertyMediaDto {
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

export class CreatePropertyDto {
  @IsEnum(OperationType)
  operationType!: OperationType;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @IsNumber()
  @Min(1)
  price!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceFee?: number;

  @ValidateNested()
  @Type(() => PropertyLocationDto)
  location!: PropertyLocationDto;

  @ValidateNested()
  @Type(() => PropertyDetailsDto)
  details!: PropertyDetailsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityCodes?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PropertyMediaDto)
  media!: PropertyMediaDto[];

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
