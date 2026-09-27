import type {
  ProfessionalProfile,
  User,
} from '../../generated/prisma/client';
import type { AuthUser } from './auth-user';

export function toAuthUser(
  user: User & { professionalProfile?: ProfessionalProfile | null },
): AuthUser {
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email,
    role: user.role,
    professionalStatus: user.professionalProfile?.status ?? null,
  };
}
