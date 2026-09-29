import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class ListProfessionalsQueryDto {
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
