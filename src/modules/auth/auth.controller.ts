import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.login(dto));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(200)
  async google(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.loginWithGoogle(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/customer')
  async registerCustomer(
    @Body() dto: RegisterCustomerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.registerCustomer(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/professional')
  async registerProfessional(
    @Body() dto: RegisterProfessionalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.registerProfessional(dto));
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, this.baseCookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  private get cookieName() {
    return this.config.get<string>('AUTH_COOKIE_NAME', 'ariz_session');
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
    };
  }

  private respond(res: Response, result: AuthResult) {
    res.cookie(this.cookieName, result.token, {
      ...this.baseCookieOptions(),
      maxAge: result.maxAgeMs,
    });
    return { user: result.user };
  }
}
