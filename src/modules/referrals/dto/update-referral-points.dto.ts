import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateReferralPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  CONTACTED!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  VISIT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  OPERATION_COMPLETED!: number;
}
