import type { McpClient, SchedulingConfig } from './interfaces.js';

export async function pollUntilComplete(
  mcpClient: McpClient,
  pollTool: string,
  args: Record<string, unknown>,
  config: SchedulingConfig,
): Promise<unknown> {
  const startTime = Date.now();
  const timeoutMs = config.timeout;
  const intervalMs = config.pollInterval;

  while (Date.now() - startTime < timeoutMs) {
    const result = await mcpClient.callTool(pollTool, args);

    // Check completion condition
    if (isComplete(result, config.completionCondition)) {
      return result;
    }

    // Wait before next poll
    await sleep(intervalMs);
  }

  throw new Error(
    `Polling timed out after ${timeoutMs}ms for tool ${pollTool}`,
  );
}

function isComplete(result: unknown, condition: string): boolean {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const obj = result as Record<string, unknown>;

  // Simple condition: check if status field matches
  // condition format: "status=completed"
  const [field, value] = condition.split('=');
  if (field && value) {
    return String(obj[field]) === value;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
