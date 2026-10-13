import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ReferralAvailability,
  ReferralInterest,
} from '../../../generated/prisma/enums';

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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referrerBankAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  referrerYape?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  referrerPlin?: string;

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

  @IsEnum(ReferralInterest)
  interest!: ReferralInterest;

  @IsOptional()
  @IsEnum(ReferralAvailability)
  availability?: ReferralAvailability;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  campaignCode?: string;
}
