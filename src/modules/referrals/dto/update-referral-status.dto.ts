import { IsEnum } from 'class-validator';
import { ReferralStatus } from '../../../generated/prisma/enums';

export class UpdateReferralStatusDto {
  @IsEnum(ReferralStatus)
  status!: ReferralStatus;
}
