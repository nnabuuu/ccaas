import { AgentProxyService } from './agent-proxy.service';
import type { SyncField } from '../../../mcp-server/src/common/types';

/**
 * Tests for SSE interception logic in AgentProxyService.
 * Focuses on interceptOutputUpdates() and the cross-chunk buffer.
 */
describe('AgentProxyService — SSE interception', () => {
  let service: AgentProxyService;
  let mockJobsService: {
    completeStep: jest.Mock;
  };

  beforeEach(() => {
    mockJobsService = {
      completeStep: jest.fn().mockResolvedValue({}),
    };
    service = new AgentProxyService();
    service.setJobsService(mockJobsService as any);
    service.resetSseBuffer();
  });

  afterEach(() => {
    service.resetSseBuffer();
  });

  it('extracts output_update from a single complete SSE chunk', async () => {
    const chunk =
      'data: {"type":"output_update","field":"quizAnalysis","value":{"summary":"test"}}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'quizAnalysis',
      { summary: 'test' },
    );
  });

  it('handles nested event shape (payload.event)', async () => {
    const chunk =
      'data: {"event":{"type":"output_update","field":"difficulty","value":3}}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'difficulty',
      3,
    );
  });

  it('ignores non-output_update events', async () => {
    const chunk =
      'data: {"type":"agent_status","status":"thinking"}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).not.toHaveBeenCalled();
  });

  it('ignores non-JSON data lines', async () => {
    const chunk = 'data: [DONE]\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).not.toHaveBeenCalled();
  });

  it('ignores non-data lines (comments, empty lines)', async () => {
    const chunk = ': keep-alive\n\nevent: message\ndata: {"type":"other"}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).not.toHaveBeenCalled();
  });

  it('handles multiple events in a single chunk', async () => {
    const chunk =
      'data: {"type":"output_update","field":"quizAnalysis","value":"a"}\n\n' +
      'data: {"type":"output_update","field":"difficulty","value":3}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).toHaveBeenCalledTimes(2);
    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'quizAnalysis',
      'a',
    );
    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'difficulty',
      3,
    );
  });

  it('rejects invalid SyncField values at runtime', async () => {
    const chunk =
      'data: {"type":"output_update","field":"parsedQuiz","value":"bad"}\n\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).not.toHaveBeenCalled();
  });

  // ── Cross-chunk buffer tests ──

  it('buffers incomplete lines split across chunks', async () => {
    const chunk1 = 'data: {"type":"output_update","field":"quiz';
    const chunk2 = 'Analysis","value":"buffered"}\n\n';

    await service.interceptOutputUpdates('job-1', chunk1);
    expect(mockJobsService.completeStep).not.toHaveBeenCalled();

    await service.interceptOutputUpdates('job-1', chunk2);
    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'quizAnalysis',
      'buffered',
    );
  });

  it('handles chunk ending with complete line (no leftover)', async () => {
    const chunk = 'data: {"type":"output_update","field":"difficulty","value":5}\n';

    await service.interceptOutputUpdates('job-1', chunk);

    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'difficulty',
      5,
    );
  });

  it('handles three-way split across chunks', async () => {
    const chunk1 = 'data: {"type":"out';
    const chunk2 = 'put_update","field":"knowledgePointTags"';
    const chunk3 = ',"value":[]}\n\n';

    await service.interceptOutputUpdates('job-1', chunk1);
    expect(mockJobsService.completeStep).not.toHaveBeenCalled();

    await service.interceptOutputUpdates('job-1', chunk2);
    expect(mockJobsService.completeStep).not.toHaveBeenCalled();

    await service.interceptOutputUpdates('job-1', chunk3);
    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'knowledgePointTags',
      [],
    );
  });

  it('resetSseBuffer clears the buffer', async () => {
    // Start with incomplete line
    await service.interceptOutputUpdates('job-1', 'data: {"type":"output_update"');
    expect(mockJobsService.completeStep).not.toHaveBeenCalled();

    // Reset
    service.resetSseBuffer();

    // Next chunk should not combine with old buffer
    const fresh =
      'data: {"type":"output_update","field":"difficulty","value":1}\n\n';
    await service.interceptOutputUpdates('job-1', fresh);

    expect(mockJobsService.completeStep).toHaveBeenCalledTimes(1);
    expect(mockJobsService.completeStep).toHaveBeenCalledWith(
      'job-1',
      'difficulty',
      1,
    );
  });
});
