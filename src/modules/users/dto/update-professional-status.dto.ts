import { IsIn } from 'class-validator';
import { ApprovalStatus } from '../../../generated/prisma/enums';

export class UpdateProfessionalStatusDto {
  @IsIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.PENDING])
  status!: ApprovalStatus;
}
