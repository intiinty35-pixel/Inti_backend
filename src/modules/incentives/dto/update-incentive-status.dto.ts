import { IsEnum } from 'class-validator';
import { IncentiveStatus } from '../../../generated/prisma/enums';

export class UpdateIncentiveStatusDto {
  @IsEnum(IncentiveStatus)
  status!: IncentiveStatus;
}
