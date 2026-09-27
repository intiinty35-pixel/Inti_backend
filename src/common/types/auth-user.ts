import type { ApprovalStatus, Role } from '../../generated/prisma/enums';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  professionalStatus: ApprovalStatus | null;
}
