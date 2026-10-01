import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ProjectStatus } from '../../../generated/prisma/enums';

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class AdminProjectQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  pageSize = 9;
}
