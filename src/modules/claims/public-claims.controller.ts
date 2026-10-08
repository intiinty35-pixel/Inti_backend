import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CreateClaimDto } from './dto/create-claim.dto';
import { ClaimsService } from './claims.service';

@Public()
@Controller('claims')
export class PublicClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post()
  create(@Body() dto: CreateClaimDto) {
    return this.claims.create(dto);
  }
}
