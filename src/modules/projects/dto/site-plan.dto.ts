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
export class PlanCropDto {
  @IsNumber() @Min(0) @Max(1) left: number;
  @IsNumber() @Min(0) @Max(1) top: number;
  @IsNumber() @Min(0) @Max(1) right: number;
  @IsNumber() @Min(0) @Max(1) bottom: number;
}
export class PlanImageDto {
  @IsOptional() @ValidateNested() @Type(() => PlanCropDto) crop?: PlanCropDto;
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
  @IsIn(['BLOCK', 'STREET', 'PARK', 'CONTOUR']) kind: 'BLOCK' | 'STREET' | 'PARK' | 'CONTOUR';
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
export class FloorPointDto {
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
}
export class FloorImageDto {
  @IsOptional() @ValidateNested() @Type(() => PlanCropDto) crop?: PlanCropDto;
  @IsString() @MaxLength(2048) url: string;
  @IsNumber() @Min(1) @Max(30000) width: number;
  @IsNumber() @Min(1) @Max(30000) height: number;
}
export class PlanApartmentDto {
  @IsUUID() id: string;
  @IsString() @MaxLength(80) code: string;
  @IsNumber() @Min(0.01) @Max(99999999) areaM2: number;
  @IsNumber() @Min(0) @Max(999999999999) price: number;
  @IsIn(['SALE', 'RENT']) operation: 'SALE' | 'RENT';
  @IsIn(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'BLOCKED']) status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'BLOCKED';
  @IsNumber() @Min(0) @Max(999999999) maintenanceFee: number;
  @IsInt() @Min(0) @Max(100) bedrooms: number;
  @IsInt() @Min(0) @Max(100) bathrooms: number;
  @IsString() @MaxLength(2000) notes: string;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => FloorPointDto) path: FloorPointDto[];
}
export class PlanFloorDto {
  @IsOptional() @IsIn(['BASE', 'CUSTOM']) imageSource?: 'BASE' | 'CUSTOM';
  @IsUUID() id: string;
  @IsInt() @Min(-20) @Max(300) number: number;
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @ValidateNested() @Type(() => FloorImageDto) image?: FloorImageDto;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PlanApartmentDto) apartments: PlanApartmentDto[];
}
export class PlanBuildingDto {
  @IsUUID() id: string;
  @IsString() @MaxLength(100) name: string;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => PlanPointDto) path: PlanPointDto[];
  @IsArray() @ArrayMaxSize(321) @ValidateNested({ each: true }) @Type(() => PlanFloorDto) floors: PlanFloorDto[];
}
export class SitePlanDto {
  @IsOptional() @IsIn(['LOTS', 'APARTMENTS']) mode?: 'LOTS' | 'APARTMENTS';
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => PlanBuildingDto) buildings?: PlanBuildingDto[];
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
export class SitePlanAccessCodeDto {
  @IsIn([1, 7, 30]) expiresInDays: 1 | 7 | 30;
}
