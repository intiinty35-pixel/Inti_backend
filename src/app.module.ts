import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MailModule } from './modules/mail/mail.module';
import { MediaModule } from './modules/media/media.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { PlansModule } from './modules/plans/plans.module';
import { UsersModule } from './modules/users/users.module';
import { InvestmentOpportunitiesModule } from './modules/investment-opportunities/investment-opportunities.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { IncentivesModule } from './modules/incentives/incentives.module';
import { RedemptionsModule } from './modules/redemptions/redemptions.module';
import { ContactReportsModule } from './modules/contact-reports/contact-reports.module';
import { ClaimsModule } from './modules/claims/claims.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    PrismaModule,
    AuthModule,
    AgentsModule,
    AlertsModule,
    FavoritesModule,
    UsersModule,
    PropertiesModule,
    ProjectsModule,
    LeadsModule,
    MailModule,
    MediaModule,
    ProfessionalsModule,
    PlansModule,
    InvestmentOpportunitiesModule,
    ReferralsModule,
    IncentivesModule,
    RedemptionsModule,
    ContactReportsModule,
    ClaimsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
