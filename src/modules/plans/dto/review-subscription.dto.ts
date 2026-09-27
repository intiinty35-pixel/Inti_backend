import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewSubscriptionDto {
  @IsIn(['ACTIVE', 'REJECTED'])
  status: 'ACTIVE' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
