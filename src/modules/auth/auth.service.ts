import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { toAuthUser } from '../../common/types/to-auth-user';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ProfessionalType, Role } from '../../generated/prisma/enums';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { FirebaseAdminService } from './firebase-admin.service';

export interface AuthResult {
  user: AuthUser;
  token: string;
  maxAgeMs: number | undefined;
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto): Promise<AuthResult> {
    await this.assertEmailFree(dto.email);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: Role.USER,
      },
      include: { professionalProfile: true },
    });
    return this.issue(toAuthUser(user), false);
  }

  async registerProfessional(dto: RegisterProfessionalDto): Promise<AuthResult> {
    await this.assertEmailFree(dto.email);
    const isPerson = dto.type === ProfessionalType.INDEPENDENT_AGENT;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        firstName: isPerson ? dto.firstName! : dto.businessName!,
        lastName: isPerson ? dto.lastName! : null,
        phone: dto.phone,
        role: Role.REAL_ESTATE,
        professionalProfile: {
          create: {
            type: dto.type,
            slug: this.slugify(dto.businessName ?? `${dto.firstName ?? ''} ${dto.lastName ?? ''}`),
            dni: dto.dni,
            ruc: dto.ruc,
            businessName: dto.businessName,
            whatsapp: dto.whatsapp,
            city: dto.city,
            districts: dto.districts,
            address: dto.address,
            website: dto.website,
            socialLinks: dto.socialLinks,
          },
        },
      },
      include: { professionalProfile: true },
    });
    return this.issue(toAuthUser(user), false);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { professionalProfile: true },
    });

    // Se verifica siempre un hash para que el tiempo de respuesta no revele si el correo existe.
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.getDummyHash()),
      dto.password,
    );
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    return this.issue(toAuthUser(user), dto.rememberMe === true);
  }

  async loginWithGoogle(dto: GoogleLoginDto): Promise<AuthResult> {
    const decoded = await this.firebase.auth.verifyIdToken(dto.idToken);
    if (!decoded.email) {
      throw new UnauthorizedException('Google no devolvió un correo válido');
    }

    const email = decoded.email.trim().toLowerCase();
    const [firstName, ...rest] = (decoded.name ?? email.split('@')[0]).trim().split(/\s+/);
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        firstName: firstName || 'Usuario',
        lastName: rest.join(' ') || null,
        isActive: true,
      },
      create: {
        email,
        passwordHash: await argon2.hash(`firebase:${decoded.uid}:${Date.now()}`),
        firstName: firstName || 'Usuario',
        lastName: rest.join(' ') || null,
        role: Role.USER,
        isActive: true,
      },
      include: { professionalProfile: true },
    });

    return this.issue(toAuthUser(user), true);
  }

  private async assertEmailFree(email: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Ya existe una cuenta con este correo');
  }

  private slugify(value: string) {
    const base = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    return `${base || 'agente'}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private getDummyHash() {
    this.dummyHash ??= argon2.hash('dummy-password-for-timing');
    return this.dummyHash;
  }

  private async issue(user: AuthUser, remember: boolean): Promise<AuthResult> {
    const ttlSeconds = remember
      ? Number(this.config.get('REMEMBER_TTL_DAYS', 30)) * 86400
      : Number(this.config.get('SESSION_TTL_HOURS', 24)) * 3600;
    const token = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: ttlSeconds },
    );
    return { user, token, maxAgeMs: remember ? ttlSeconds * 1000 : undefined };
  }
}
