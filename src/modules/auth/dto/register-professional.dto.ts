import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProfessionalType } from '../../../generated/prisma/enums';
import {
  PASSWORD_MESSAGE,
  PASSWORD_RULE,
  trim,
} from './register-customer.dto';

const isPerson = (o: RegisterProfessionalDto) =>
  o.type === ProfessionalType.INDEPENDENT_AGENT;
const isCompany = (o: RegisterProfessionalDto) =>
  o.type !== ProfessionalType.INDEPENDENT_AGENT;

export class RegisterProfessionalDto {
  @IsEnum(ProfessionalType, { message: 'Selecciona un tipo de profesional válido' })
  type!: ProfessionalType;

  @ValidateIf(isPerson)
  @Transform(trim)
  @IsString({ message: 'Ingresa tu nombre' })
  @IsNotEmpty({ message: 'Ingresa tu nombre' })
  @MaxLength(80, { message: 'El nombre es demasiado largo' })
  firstName?: string;

  @ValidateIf(isPerson)
  @Transform(trim)
  @IsString({ message: 'Ingresa tu apellido' })
  @IsNotEmpty({ message: 'Ingresa tu apellido' })
  @MaxLength(80, { message: 'El apellido es demasiado largo' })
  lastName?: string;

  @ValidateIf(isPerson)
  @Transform(trim)
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;

  @ValidateIf(isCompany)
  @Transform(trim)
  @IsString({ message: 'Ingresa la razón social o nombre comercial' })
  @IsNotEmpty({ message: 'Ingresa la razón social o nombre comercial' })
  @MaxLength(160, { message: 'La razón social es demasiado larga' })
  businessName?: string;

  @ValidateIf(isCompany)
  @Transform(trim)
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email!: string;

  @Transform(trim)
  @IsString({ message: 'Ingresa tu teléfono' })
  @MinLength(7, { message: 'El teléfono debe tener al menos 7 caracteres' })
  @MaxLength(20, { message: 'El teléfono es demasiado largo' })
  phone!: string;

  @Transform(trim)
  @IsString({ message: 'Ingresa tu WhatsApp' })
  @MinLength(7, { message: 'El WhatsApp debe tener al menos 7 caracteres' })
  @MaxLength(20, { message: 'El WhatsApp es demasiado largo' })
  whatsapp!: string;

  @Transform(trim)
  @IsString({ message: 'Ingresa tu ciudad' })
  @IsNotEmpty({ message: 'Ingresa tu ciudad' })
  @MaxLength(80, { message: 'La ciudad es demasiado larga' })
  city!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Los distritos no son válidos' })
  @MaxLength(255, { message: 'Los distritos son demasiado largos' })
  districts?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La dirección no es válida' })
  @MaxLength(255, { message: 'La dirección es demasiado larga' })
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'El sitio web no es válido' })
  @MaxLength(255, { message: 'El sitio web es demasiado largo' })
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Las redes sociales no son válidas' })
  @MaxLength(500, { message: 'Las redes sociales son demasiado largas' })
  socialLinks?: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsBoolean({ message: 'Debes aceptar los términos y condiciones' })
  @Equals(true, { message: 'Debes aceptar los términos y condiciones' })
  acceptTerms!: boolean;
}
