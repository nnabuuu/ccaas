import type { SyncField } from '../../../../mcp-server/src/common/types';

export class CreateJobDto {
  sessionId: string;
  template: string;
  fields: SyncField[];
}
