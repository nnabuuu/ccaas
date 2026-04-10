import { Module, DynamicModule } from '@nestjs/common';
import { HarnessModule } from '@kedge-agentic/harness';
import type { McpClient } from '@kedge-agentic/harness';
import { DatabaseModule } from './database/database.module';
import { ArticleController, RunController } from './article/article.controller';
import { ArticleService } from './article/article.service';
import { HarnessSetupService } from './harness/harness-setup.service';
import { CcaasSessionProvider } from './harness/ccaas-session-provider';
import { SqliteRunStore } from './harness/sqlite-run-store';

class NoopMcpClient implements McpClient {
  async callTool(): Promise<unknown> {
    return {};
  }
}

@Module({})
export class AppModule {
  static forRoot(): DynamicModule {
    const dbModule = DatabaseModule.forRoot();
    const db = DatabaseModule.getDatabase();

    const ccaasBaseUrl =
      process.env.CCAAS_BASE_URL || 'http://localhost:3001';
    const tenantId = process.env.CCAAS_TENANT_ID || 'default';

    const sessionProvider = new CcaasSessionProvider(ccaasBaseUrl, tenantId);
    const mcpClient = new NoopMcpClient();
    const runStore = new SqliteRunStore(db);

    return {
      module: AppModule,
      imports: [
        dbModule,
        HarnessModule.forRoot({
          sessionProvider,
          mcpClient,
          runStore,
        }),
      ],
      controllers: [ArticleController, RunController],
      providers: [ArticleService, HarnessSetupService],
    };
  }
}
