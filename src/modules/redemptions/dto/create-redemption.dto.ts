import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateRedemptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  referralCode!: string;

  @IsUUID()
  incentiveId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
