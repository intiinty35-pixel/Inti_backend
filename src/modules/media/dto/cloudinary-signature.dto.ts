import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloudinarySignatureDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;
}
