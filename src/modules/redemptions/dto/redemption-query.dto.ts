import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RedemptionStatus } from '../../../generated/prisma/enums';

export class RedemptionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsEnum(RedemptionStatus)
  status?: RedemptionStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxPoints?: number;
}
