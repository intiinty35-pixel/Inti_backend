import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateMyProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  businessName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  districts?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  socialLinks?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  ruc?: string;
}
