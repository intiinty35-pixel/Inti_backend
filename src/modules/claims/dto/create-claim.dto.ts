import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  dniOrCe!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentGuardian?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetType!: string;

  @IsNumber()
  @Min(0)
  claimedAmount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  assetDescription!: string;

  @IsEnum(['Claim', 'Complaint'], { message: 'El tipo debe ser Reclamo o Queja' })
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  claimDetails!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  consumerRequest!: string;
}
