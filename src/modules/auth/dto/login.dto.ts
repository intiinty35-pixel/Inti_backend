import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email!: string;

  @IsString({ message: 'Ingresa tu contraseña' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
