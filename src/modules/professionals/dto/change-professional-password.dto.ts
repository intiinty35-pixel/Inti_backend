import { IsString, Matches } from 'class-validator';
import {
  PASSWORD_MESSAGE,
  PASSWORD_RULE,
} from '../../auth/dto/register-customer.dto';

export class ChangeProfessionalPasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
