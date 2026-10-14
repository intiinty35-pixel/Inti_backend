import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from './register-customer.dto';

export class ResetPasswordDto {
  @IsString({ message: 'El enlace no es válido' })
  @IsNotEmpty({ message: 'El enlace no es válido' })
  @MaxLength(2000, { message: 'El enlace no es válido' })
  token!: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}
