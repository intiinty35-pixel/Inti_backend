import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE =
  'La contraseña debe tener entre 8 y 72 caracteres, con letras y números';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterCustomerDto {
  @Transform(trim)
  @IsString({ message: 'Ingresa tu nombre' })
  @IsNotEmpty({ message: 'Ingresa tu nombre' })
  @MaxLength(80, { message: 'El nombre es demasiado largo' })
  firstName!: string;

  @Transform(trim)
  @IsString({ message: 'Ingresa tu apellido' })
  @IsNotEmpty({ message: 'Ingresa tu apellido' })
  @MaxLength(80, { message: 'El apellido es demasiado largo' })
  lastName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email!: string;

  @Transform(trim)
  @IsString({ message: 'Ingresa tu teléfono' })
  @MinLength(7, { message: 'El teléfono debe tener al menos 7 caracteres' })
  @MaxLength(20, { message: 'El teléfono es demasiado largo' })
  phone!: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsBoolean({ message: 'Debes aceptar los términos y condiciones' })
  @Equals(true, { message: 'Debes aceptar los términos y condiciones' })
  acceptTerms!: boolean;
}
