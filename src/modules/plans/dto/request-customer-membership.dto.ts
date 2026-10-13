import { IsInt, IsNumber, IsUrl, Max, Min } from 'class-validator';

export class RequestCustomerMembershipDto {
  @IsInt()
  @Min(1)
  @Max(5)
  propertyLimit!: number;

  @IsInt()
  @Min(15)
  @Max(30)
  durationDays!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  receiptUrl!: string;
}
