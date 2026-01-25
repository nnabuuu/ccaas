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

export const textDeltaEvent = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: {
    type: 'text_delta',
    text,
  },
});

export const simpleTextResponse = [
  textDeltaEvent('Hello, '),
  textDeltaEvent('I will help you with that.'),
];

// ============================================================================
// Thinking Events
// ============================================================================

export const thinkingStartEvent = (thinkingId: string = 'thinking_001') => ({
  type: 'content_block_start',
  index: 0,
  content_block: {
    type: 'thinking',
    thinking: '',
  },
  thinking_id: thinkingId,
});

export const thinkingDeltaEvent = (
  content: string,
  thinkingId: string = 'thinking_001',
) => ({
  type: 'content_block_delta',
  index: 0,
  delta: {
    type: 'thinking_delta',
    thinking: content,
  },
  thinking_id: thinkingId,
});

export const thinkingEndEvent = (
  thinkingId: string = 'thinking_001',
  tokens: number = 150,
) => ({
  type: 'content_block_stop',
  index: 0,
  thinking_id: thinkingId,
  thinking_tokens: tokens,
});

// ============================================================================
// Tool Events
// ============================================================================

export const toolUseStartEvent = (
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

export const toolResultEvent = (
  toolUseId: string,
  output: unknown,
  isError: boolean = false,
) => ({
  type: 'tool_result',
  tool_use_id: toolUseId,
  output: typeof output === 'string' ? output : JSON.stringify(output),
  is_error: isError,
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
      file_path: '/workspace/test.txt',
      content: 'Test content from Claude',
    },
  },
};

export const writeToolResultEvent = {
  type: 'tool_result',
  tool_use_id: 'toolu_write_123',
  output: 'File written successfully',
  is_error: false,
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
  tool_use_id: 'toolu_read_456',
  output: 'Test content from Claude',
  is_error: false,
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
  tool_use_id: 'toolu_bash_789',
  output: 'Hello from bash\n',
  is_error: false,
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

export const usageEvent = (
  inputTokens: number = 150,
  outputTokens: number = 75,
  options: {
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    model?: string;
  } = {},
) => ({
  type: 'usage',
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: options.cacheReadTokens || 0,
    cache_creation_input_tokens: options.cacheCreationTokens || 0,
  },
  model: options.model || 'claude-sonnet-4-20250514',
});

// ============================================================================
// Result/Status Events
// ============================================================================

export const resultEvent = (stopReason: string = 'end_turn') => ({
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

export const errorResultEvent = (error: string) => ({
  type: 'result',
  subtype: 'error',
  is_error: true,
  error,
  session_id: 'test-session-123',
});

// ============================================================================
// Complete Interaction Sequences
// ============================================================================

/**
 * Simple text response without tool use
 */
export const simpleResponseSequence = [
  assistantMessageStartEvent,
  textDeltaEvent('I can help you with that. '),
  textDeltaEvent('Here is my response.'),
  usageEvent(100, 50),
  resultEvent(),
];

/**
 * Response with Write tool use
 */
export const writeFileSequence = [
  assistantMessageStartEvent,
  textDeltaEvent("I'll create a file for you."),
  writeToolCallEvent,
  writeToolResultEvent,
  textDeltaEvent('File created successfully.'),
  usageEvent(150, 100),
  resultEvent(),
];

/**
 * Response with thinking and tool use
 */
export const thinkingAndToolSequence = [
  assistantMessageStartEvent,
  thinkingStartEvent(),
  thinkingDeltaEvent('Let me analyze this request...'),
  thinkingDeltaEvent(' I should read the file first.'),
  thinkingEndEvent(),
  readToolCallEvent,
  readToolResultEvent,
  textDeltaEvent('I found the content you were looking for.'),
  usageEvent(200, 150, { cacheReadTokens: 50 }),
  resultEvent(),
];

/**
 * Multi-turn conversation sequence
 */
export const multiTurnSequence = {
  turn1: [
    assistantMessageStartEvent,
    textDeltaEvent("Hello! I'm ready to help."),
    usageEvent(50, 25),
    resultEvent(),
  ],
  turn2: [
    assistantMessageStartEvent,
    textDeltaEvent('Based on our previous conversation, '),
    textDeltaEvent('here is more information.'),
    usageEvent(100, 60, { cacheReadTokens: 50 }),
    resultEvent(),
  ],
};

/**
 * Error response sequence
 */
export const errorSequence = [
  assistantMessageStartEvent,
  textDeltaEvent('I encountered an issue.'),
  errorResultEvent('API rate limit exceeded'),
];
