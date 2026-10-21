import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanPointDto {
  @IsNumber() @Min(-85) @Max(85) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
}
export class PlanImageDto {
  @IsOptional() @IsString() @MaxLength(2048) sourcePdfUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) sourcePdfPage?: number;
  @IsOptional() @IsString() @MaxLength(255) sourcePdfName?: string;
  @IsString() @MaxLength(2048) url: string;
  @IsDefined() @ValidateNested() @Type(() => PlanPointDto) center: PlanPointDto;
  @IsNumber() @Min(1) @Max(100000) widthM: number;
  @IsNumber() @Min(1) @Max(100000) heightM: number;
  @IsNumber() @Min(-360) @Max(360) rotation: number;
  @IsNumber() @Min(0) @Max(1) opacity: number;
}
export class PlanZoneDto {
  @IsUUID() id: string;
  @IsIn(['BLOCK', 'STREET', 'CONTOUR']) kind: 'BLOCK' | 'STREET' | 'CONTOUR';
  @IsString() @MaxLength(100) name: string;
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PlanPointDto)
  path: PlanPointDto[];
}
export class PlanLotDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) interestRateMonthly?: number;
  @IsOptional() @IsBoolean() fromExcel?: boolean;
  @IsUUID() id: string;
  @IsString() @MaxLength(80) code: string;
  @IsString() @MaxLength(100) block: string;
  @IsString() @MaxLength(100) street: string;
  @IsString() @MaxLength(300) address: string;
  @IsString() @MaxLength(100) type: string;
  @IsString() @MaxLength(100) dimensions: string;
  @IsNumber() @Min(0.01) @Max(99999999) areaM2: number;
  @IsNumber() @Min(0) @Max(99999999) perimeterM: number;
  @IsNumber() @Min(0) @Max(99999999) frontM: number;
  @IsNumber() @Min(0) @Max(999999999999) price: number;
  @IsNumber() @Min(0) @Max(999999999999) priceM2: number;
  @IsIn(['AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED']) status:
    'AVAILABLE' | 'RESERVED' | 'SOLD' | 'BLOCKED';
  @IsBoolean() cashAllowed: boolean;
  @IsBoolean() financingAllowed: boolean;
  @IsNumber() @Min(0) @Max(999999999999) financedPrice: number;
  @IsNumber() @Min(0) @Max(999999999999) downPayment: number;
  @IsInt() @Min(0) @Max(1200) installments: number;
  @IsNumber() @Min(0) @Max(999999999999) monthlyPayment: number;
  @IsString() @MaxLength(2000) notes: string;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PlanPointDto)
  path: PlanPointDto[];
}
export class SitePlanDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanImageDto)
  image?: PlanImageDto;
  @IsString() @MaxLength(2048) logoUrl: string;
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PlanZoneDto)
  zones: PlanZoneDto[];
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => PlanLotDto)
  lots: PlanLotDto[];
}
export class SaveSitePlanDto {
  @IsInt() @Min(0) revision: number;
  @IsDefined() @ValidateNested() @Type(() => SitePlanDto) plan: SitePlanDto;
  @IsBoolean() publish: boolean;
}
