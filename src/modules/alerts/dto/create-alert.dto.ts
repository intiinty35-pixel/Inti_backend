import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export class CreateSearchAlertDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsObject()
  filters!: Record<string, JsonValue>;
}

export class CreatePriceAlertDto {
  @IsUUID()
  propertyId!: string;

  @IsOptional()
  targetPrice?: number;
}
