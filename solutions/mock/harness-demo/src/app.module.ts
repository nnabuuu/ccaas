import { Module } from '@nestjs/common';
import { HarnessModule } from '@kedge-agentic/harness';
import { MockSessionProvider } from './adapters/mock-session-provider';
import { MockMcpClient } from './adapters/mock-mcp-client';
import { MockSetupService } from './adapters/mock-setup.service';

const sessionProvider = new MockSessionProvider('http://localhost:3022');
const mcpClient = new MockMcpClient();

@Module({
  imports: [
    HarnessModule.forRoot({
      sessionProvider,
      mcpClient,
    }),
  ],
  providers: [MockSetupService],
})
export class AppModule {}
