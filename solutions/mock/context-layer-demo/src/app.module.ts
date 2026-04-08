import { Module } from '@nestjs/common';
import { ContextLayerModule } from '@kedge-agentic/context-layer';
import { MockCacheStore } from './adapters/mock-cache-store';
import { MockBrowseProvider } from './adapters/mock-browse-provider';
import { MockOrmAdapter } from './adapters/mock-orm-adapter';
import { MockSetupService } from './adapters/mock-setup.service';
import { MockDataService } from './seed/mock-data.service';

const cacheStore = new MockCacheStore();
const mockData = new MockDataService();
const browseProvider = new MockBrowseProvider(mockData);
const ormAdapter = new MockOrmAdapter();

@Module({
  imports: [
    ContextLayerModule.forRoot({
      cacheStore,
      ormAdapter,
      browseProvider,
    }),
  ],
  providers: [
    { provide: MockCacheStore, useValue: cacheStore },
    MockSetupService,
  ],
})
export class AppModule {}
