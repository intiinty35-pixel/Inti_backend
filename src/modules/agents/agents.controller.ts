import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AgentsService } from './agents.service';

@Public()
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get(':slugOrId')
  detail(@Param('slugOrId') slugOrId: string) {
    return this.agents.getPublicProfile(slugOrId);
  }
}
