import { IsInt, Max, Min } from 'class-validator';

export class SetReferralPointsDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  points!: number;
}
