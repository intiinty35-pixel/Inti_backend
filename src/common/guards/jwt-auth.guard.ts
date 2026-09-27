import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { toAuthUser } from '../types/to-auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.config.get<string>('AUTH_COOKIE_NAME', 'ariz_session');
    const token = request.cookies?.[cookieName] as string | undefined;
    if (!token) throw new UnauthorizedException('Sesión requerida');

    let userId: string;
    try {
      userId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { professionalProfile: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    (request as Request & { user: unknown }).user = toAuthUser(user);
    return true;
  }
}
