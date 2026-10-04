import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReferralDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  referrerName!: string;

  @IsEmail()
  referrerEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  referrerPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  referrerCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsUUID()
  projectId!: string;
}
