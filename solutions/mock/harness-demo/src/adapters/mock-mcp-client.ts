import type { McpClient } from '@kedge-agentic/harness';

export class MockMcpClient implements McpClient {
  private pollCounts = new Map<string, number>();

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (toolName === 'simulator:run') {
      const jobId = `sim_${Date.now()}`;
      this.pollCounts.set(jobId, 0);
      return { jobId, status: 'pending' };
    }

    if (toolName === 'simulator:status' || toolName === 'simulator:run:status') {
      const jobId = (args['jobId'] as string) ?? 'unknown';
      const count = (this.pollCounts.get(jobId) ?? 0) + 1;
      this.pollCounts.set(jobId, count);

      if (count >= 2) {
        return {
          jobId,
          status: 'completed',
          result: {
            metrics: {
              accuracy: 0.92,
              latency: 145,
              throughput: 1200,
            },
            summary: 'Simulation completed successfully',
          },
        };
      }

      return { jobId, status: 'pending' };
    }

    return { error: `Unknown tool: ${toolName}` };
  }
}
