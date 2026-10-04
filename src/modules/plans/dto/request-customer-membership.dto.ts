import { IsInt, IsUrl, Max, Min } from 'class-validator';

export class RequestCustomerMembershipDto {
  @IsInt()
  @Min(1)
  @Max(4)
  propertyLimit!: number;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  receiptUrl!: string;
}
