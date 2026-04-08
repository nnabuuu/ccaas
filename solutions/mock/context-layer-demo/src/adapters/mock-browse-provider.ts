import { Injectable } from '@nestjs/common';
import type { EntityBrowseProvider, BrowseResponse, SearchResponse, ResolveResponse } from '@kedge-agentic/context-layer';
import { MockDataService } from '../seed/mock-data.service';

@Injectable()
export class MockBrowseProvider implements EntityBrowseProvider {
  constructor(private mockData: MockDataService) {}

  async browse(entityType: string, opts: { parentType?: string; parentId?: string; page?: number }): Promise<BrowseResponse> {
    return this.mockData.getBrowse(entityType, opts.parentType, opts.parentId, opts.page ?? 1);
  }

  async search(query: string, opts?: { entityType?: string; limit?: number }): Promise<SearchResponse> {
    return this.mockData.getSearch(query, opts?.limit ?? 20);
  }

  async resolve(entityType: string, entityId: string): Promise<ResolveResponse> {
    return this.mockData.getResolve(entityType, entityId);
  }
}
