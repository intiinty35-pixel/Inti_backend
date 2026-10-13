import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignPointsDto {
  @IsInt()
  @Min(0)
  CONTACTED: number;

  @IsInt()
  @Min(0)
  VISIT: number;

  @IsInt()
  @Min(0)
  OPERATION_COMPLETED: number;
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @ValidateNested()
  @Type(() => CampaignPointsDto)
  points: CampaignPointsDto;

  @IsArray()
  @IsString({ each: true })
  projectIds: string[];
}
