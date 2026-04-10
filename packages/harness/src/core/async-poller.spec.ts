import { pollUntilComplete } from './async-poller';
import type { McpClient, SchedulingConfig } from './interfaces';

describe('pollUntilComplete', () => {
  const config: SchedulingConfig = {
    pollInterval: 10,
    timeout: 200,
    completionCondition: 'status=completed',
  };

  it('returns result when condition is met on first poll', async () => {
    const mockClient: McpClient = {
      callTool: jest.fn().mockResolvedValue({ status: 'completed', data: 42 }),
    };
    const result = await pollUntilComplete(mockClient, 'check', {}, config);
    expect(result).toEqual({ status: 'completed', data: 42 });
    expect(mockClient.callTool).toHaveBeenCalledTimes(1);
  });

  it('polls until condition is met', async () => {
    const mockClient: McpClient = {
      callTool: jest
        .fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'completed', result: 'done' }),
    };
    const result = await pollUntilComplete(mockClient, 'check', { jobId: '1' }, config);
    expect(result).toEqual({ status: 'completed', result: 'done' });
    expect(mockClient.callTool).toHaveBeenCalledTimes(3);
  });

  it('throws on timeout', async () => {
    const mockClient: McpClient = {
      callTool: jest.fn().mockResolvedValue({ status: 'pending' }),
    };
    const shortConfig = { ...config, timeout: 50 };
    await expect(
      pollUntilComplete(mockClient, 'check', {}, shortConfig),
    ).rejects.toThrow('Polling timed out');
  });

  it('passes args to callTool', async () => {
    const mockClient: McpClient = {
      callTool: jest.fn().mockResolvedValue({ status: 'completed' }),
    };
    const args = { jobId: 'abc', extra: 123 };
    await pollUntilComplete(mockClient, 'my-tool', args, config);
    expect(mockClient.callTool).toHaveBeenCalledWith('my-tool', args);
  });
});
