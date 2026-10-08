import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  membershipReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyStats?: boolean;
}
