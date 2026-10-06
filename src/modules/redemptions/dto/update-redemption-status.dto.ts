import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRedemptionStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
