import { Module } from '@nestjs/common';
import { PublicClaimsController } from './public-claims.controller';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  controllers: [ClaimsController, PublicClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
