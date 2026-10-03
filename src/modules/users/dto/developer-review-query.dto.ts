import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PropertyStatus } from '../../../generated/prisma/enums';

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class DeveloperReviewQueryDto {
  @IsOptional()
  @IsIn([
    PropertyStatus.PENDING_REVIEW,
    PropertyStatus.PUBLISHED,
    PropertyStatus.REJECTED,
  ])
  status?: PropertyStatus;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  pageSize?: number;
}
