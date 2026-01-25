/**
 * Claude CLI Event Interfaces
 *
 * Types for events received from Claude Code CLI in stream-json format.
 */

/**
 * Content block in a Claude message
 */
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Claude CLI stream-json event
 */
export interface CLIEvent {
  type: string;
  index?: number;
  message?: {
    id: string;
    type: string;
    role: string;
    content: ContentBlock[];
    model: string;
    stop_reason?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };
  };
  content_block?: ContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  tool_result?: {
    tool_use_id: string;
    content: string | object;
    is_error?: boolean;
  };
  // Extended thinking events
  id?: string;
  // Token usage events
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
  };
  model?: string;
  finish_reason?: string;
  stop_reason?: string;
  // Result event
  subtype?: string;
  result?: string;
}

/**
 * Tracked tool call for mapping start/end events
 */
export interface TrackedToolCall {
  toolId: string;
  toolName: string;
  startTime: number;
  input: Record<string, unknown>;
}

// Note: CustomToolHandler and ToolDescriptionGenerator are defined in frontend-event.interface.ts
// to avoid circular imports
