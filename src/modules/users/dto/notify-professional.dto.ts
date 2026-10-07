import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class NotifyProfessionalDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message?: string;
}
