import { IsInt, IsString, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectPointsDto {
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

export class ProjectPointsUpdateItemDto {
  @IsString()
  projectId: string;

  @ValidateNested()
  @Type(() => ProjectPointsDto)
  points: ProjectPointsDto;
}

export class BatchUpdateProjectPointsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectPointsUpdateItemDto)
  updates: ProjectPointsUpdateItemDto[];
}
