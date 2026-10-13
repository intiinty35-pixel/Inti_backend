import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignPointsUpdateDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  CONTACTED?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  VISIT?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  OPERATION_COMPLETED?: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignPointsUpdateDto)
  points?: CampaignPointsUpdateDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectIds?: string[];
}
