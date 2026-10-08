import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'El telefono debe ser un celular peruano de 9 digitos',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  topic!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}
