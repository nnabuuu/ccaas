import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentProxyService } from './agent-proxy.service';

@Module({
  controllers: [AgentController],
  providers: [AgentProxyService],
})
export class AgentModule {}
