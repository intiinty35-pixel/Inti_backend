import { IsOptional, IsUrl } from 'class-validator';

export class RequestPlanDto {
  @IsOptional()
  @IsUrl()
  receiptUrl?: string;
}
