import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateCustomerProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  biography?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
