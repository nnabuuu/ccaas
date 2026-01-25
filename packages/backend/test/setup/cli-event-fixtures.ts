/**
 * CLI Event Fixtures
 *
 * Sample CLI JSON events that simulate Claude Code CLI output.
 * These match the stream-json format output by the CLI.
 */

// ============================================================================
// Message Events
// ============================================================================

export const systemPromptEvent = {
  type: 'system',
  subtype: 'init',
  session_id: 'test-session-123',
  tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task'],
};

export const assistantMessageStartEvent = {
  type: 'assistant',
  message: {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [],
    model: 'claude-sonnet-4-20250514',
    stop_reason: null,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 0,
    },
  },
};

// ============================================================================
// Text Events
// ============================================================================

/**
 * Create a text delta event
 */
export const createTextDeltaEvent = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: {
    type: 'text_delta',
    text,
  },
});

/**
 * Simple text delta event (static for tests)
 */
export const textDeltaEvent = {
  type: 'content_block_delta',
  index: 0,
  delta: {
    type: 'text_delta',
    text: 'Hello, I will help you with that.',
  },
};

export const simpleTextResponse = [
  createTextDeltaEvent('Hello, '),
  createTextDeltaEvent('I will help you with that.'),
];

// ============================================================================
// Thinking Events
// ============================================================================

export const createThinkingStartEvent = (thinkingId: string = 'thinking_001') => ({
  type: 'thinking-start',
  id: thinkingId,
});

export const createThinkingDeltaEvent = (
  content: string,
  thinkingId: string = 'thinking_001',
) => ({
  type: 'thinking-delta',
  delta: content,
  thinking_id: thinkingId,
});

export const createThinkingEndEvent = (
  thinkingId: string = 'thinking_001',
  tokens: number = 150,
) => ({
  type: 'thinking-end',
  thinking_id: thinkingId,
  thinking_tokens: tokens,
});

/**
 * Static thinking events for simple tests
 */
export const thinkingStartEvent = {
  type: 'thinking-start',
  id: 'thinking_001',
};

export const thinkingDeltaEvent = {
  type: 'thinking-delta',
  delta: 'Let me analyze this step by step...',
};

export const thinkingEndEvent = {
  type: 'thinking-end',
};

// ============================================================================
// Tool Events
// ============================================================================

export const createToolUseStartEvent = (
  toolUseId: string,
  toolName: string,
  input: Record<string, unknown>,
) => ({
  type: 'content_block_start',
  index: 1,
  content_block: {
    type: 'tool_use',
    id: toolUseId,
    name: toolName,
    input,
  },
});

export const createToolResultEvent = (
  toolUseId: string,
  output: unknown,
  isError: boolean = false,
) => ({
  type: 'tool_result',
  tool_result: {
    tool_use_id: toolUseId,
    content: typeof output === 'string' ? output : JSON.stringify(output),
    is_error: isError,
  },
});

// Write tool events
export const writeToolCallEvent = {
  type: 'content_block_start',
  index: 1,
  content_block: {
    type: 'tool_use',
    id: 'toolu_write_123',
    name: 'Write',
    input: {
      file_path: 'hello.txt',
      content: 'Hello World!',
    },
  },
};

export const writeToolResultEvent = {
  type: 'tool_result',
  tool_result: {
    tool_use_id: 'toolu_write_123',
    content: 'File written successfully',
    is_error: false,
  },
};

// Read tool events
export const readToolCallEvent = {
  type: 'content_block_start',
  index: 1,
  content_block: {
    type: 'tool_use',
    id: 'toolu_read_456',
    name: 'Read',
    input: {
      file_path: '/workspace/test.txt',
    },
  },
};

export const readToolResultEvent = {
  type: 'tool_result',
  tool_result: {
    tool_use_id: 'toolu_read_456',
    content: 'Test content from Claude',
    is_error: false,
  },
};

// Bash tool events
export const bashToolCallEvent = {
  type: 'content_block_start',
  index: 1,
  content_block: {
    type: 'tool_use',
    id: 'toolu_bash_789',
    name: 'Bash',
    input: {
      command: 'echo "Hello from bash"',
    },
  },
};

export const bashToolResultEvent = {
  type: 'tool_result',
  tool_result: {
    tool_use_id: 'toolu_bash_789',
    content: 'Hello from bash\n',
    is_error: false,
  },
};

// Task (sub-agent) tool events
export const taskToolCallEvent = {
  type: 'content_block_start',
  index: 1,
  content_block: {
    type: 'tool_use',
    id: 'toolu_task_abc',
    name: 'Task',
    input: {
      description: 'Explore codebase',
      prompt: 'Find all TypeScript files in src/',
      subagent_type: 'Explore',
    },
  },
};

// ============================================================================
// Usage Events
// ============================================================================

export const createUsageEvent = (
  inputTokens: number = 150,
  outputTokens: number = 75,
  options: {
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    model?: string;
  } = {},
) => ({
  type: 'message_delta',
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: options.cacheReadTokens || 0,
    cache_creation_input_tokens: options.cacheCreationTokens || 0,
  },
  message: {
    model: options.model || 'claude-sonnet-4-20250514',
  },
  stop_reason: 'end_turn',
});

/**
 * Static usage event for simple tests
 */
export const usageEvent = {
  type: 'message_delta',
  usage: {
    input_tokens: 150,
    output_tokens: 75,
    cache_read_input_tokens: 30,
    cache_creation_input_tokens: 0,
  },
  message: {
    model: 'claude-sonnet-4-20250514',
    id: 'msg_api_123',
  },
  stop_reason: 'end_turn',
};

// ============================================================================
// Result/Status Events
// ============================================================================

export const createResultEvent = (stopReason: string = 'end_turn') => ({
  type: 'result',
  subtype: 'success',
  cost_usd: 0.0025,
  is_error: false,
  duration_ms: 1500,
  duration_api_ms: 1200,
  num_turns: 1,
  result: '',
  session_id: 'test-session-123',
});

export const createErrorResultEvent = (error: string) => ({
  type: 'result',
  subtype: 'error',
  is_error: true,
  error,
  session_id: 'test-session-123',
});

export const resultEvent = {
  type: 'result',
  subtype: 'success',
  cost_usd: 0.0025,
  is_error: false,
  duration_ms: 1500,
  duration_api_ms: 1200,
  num_turns: 1,
  result: '',
  session_id: 'test-session-123',
};

export const errorResultEvent = {
  type: 'result',
  subtype: 'error',
  is_error: true,
  error: 'Something went wrong',
  session_id: 'test-session-123',
};

// ============================================================================
// Complete Interaction Sequences
// ============================================================================

/**
 * Simple text response without tool use
 */
export const simpleResponseSequence = [
  assistantMessageStartEvent,
  createTextDeltaEvent('I can help you with that. '),
  createTextDeltaEvent('Here is my response.'),
  createUsageEvent(100, 50),
  createResultEvent(),
];

/**
 * Response with Write tool use
 */
export const writeFileSequence = [
  assistantMessageStartEvent,
  createTextDeltaEvent("I'll create a file for you."),
  writeToolCallEvent,
  writeToolResultEvent,
  createTextDeltaEvent('File created successfully.'),
  createUsageEvent(150, 100),
  createResultEvent(),
];

/**
 * Response with thinking and tool use
 */
export const thinkingAndToolSequence = [
  assistantMessageStartEvent,
  createThinkingStartEvent(),
  createThinkingDeltaEvent('Let me analyze this request...'),
  createThinkingDeltaEvent(' I should read the file first.'),
  createThinkingEndEvent(),
  readToolCallEvent,
  readToolResultEvent,
  createTextDeltaEvent('I found the content you were looking for.'),
  createUsageEvent(200, 150, { cacheReadTokens: 50 }),
  createResultEvent(),
];

/**
 * Multi-turn conversation sequence
 */
export const multiTurnSequence = {
  turn1: [
    assistantMessageStartEvent,
    createTextDeltaEvent("Hello! I'm ready to help."),
    createUsageEvent(50, 25),
    createResultEvent(),
  ],
  turn2: [
    assistantMessageStartEvent,
    createTextDeltaEvent('Based on our previous conversation, '),
    createTextDeltaEvent('here is more information.'),
    createUsageEvent(100, 60, { cacheReadTokens: 50 }),
    createResultEvent(),
  ],
};

/**
 * Error response sequence
 */
export const errorSequence = [
  assistantMessageStartEvent,
  createTextDeltaEvent('I encountered an issue.'),
  createErrorResultEvent('API rate limit exceeded'),
];

// ============================================================================
// Helper Functions for Creating Custom Events
// ============================================================================

/**
 * Create a write tool event pair for a specific file
 */
export function createWriteToolEvents(
  toolId: string,
  filePath: string,
  content: string,
): { start: object; result: object } {
  return {
    start: createToolUseStartEvent(toolId, 'Write', { file_path: filePath, content }),
    result: createToolResultEvent(toolId, 'File written successfully'),
  };
}

/**
 * Create a read tool event pair for a specific file
 */
export function createReadToolEvents(
  toolId: string,
  filePath: string,
  fileContent: string,
): { start: object; result: object } {
  return {
    start: createToolUseStartEvent(toolId, 'Read', { file_path: filePath }),
    result: createToolResultEvent(toolId, fileContent),
  };
}

/**
 * Create a bash tool event pair
 */
export function createBashToolEvents(
  toolId: string,
  command: string,
  output: string,
  isError = false,
): { start: object; result: object } {
  return {
    start: createToolUseStartEvent(toolId, 'Bash', { command }),
    result: createToolResultEvent(toolId, output, isError),
  };
}
