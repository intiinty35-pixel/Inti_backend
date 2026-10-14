import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ReferralQueryDto {
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

  /** Busca por nombre, correo o codigo del miembro, o por nombre del referido. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  search?: string;

  /** Fecha de registro del referido, desde (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Fecha de registro del referido, hasta (YYYY-MM-DD, inclusive). */
  @IsOptional()
  @IsDateString()
  to?: string;
}
