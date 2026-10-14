import { IsEnum, IsOptional } from 'class-validator';
import { ReferralStatus } from '../../../generated/prisma/enums';
import { ReferralQueryDto } from './referral-query.dto';

export class ReferralRecordsQueryDto extends ReferralQueryDto {
  pageSize = 12;

  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;
}
