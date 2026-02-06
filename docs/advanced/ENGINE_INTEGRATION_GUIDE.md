# AgentEngine Integration Guide

> **Advanced Topic**: This guide is for developers implementing custom AgentEngine instances compatible with CCAAS.

## Overview

CCAAS supports multiple AgentEngine implementations through a standardized protocol. Any CLI tool that implements this protocol can be used as an AgentEngine.

## Supported Engine Types

### 1. Claude Code (Default)
- **Command**: `claude` or `npx claude-code`
- **Provider**: Anthropic
- **Status**: Official, fully supported

### 2. OpenCode
- **Command**: `opencode`
- **Provider**: Open-source community
- **Status**: Community supported

### 3. Custom Engines
- **Command**: User-defined
- **Provider**: Your implementation
- **Status**: Requires protocol compliance

## Engine Protocol Requirements

Any AgentEngine must support the following command-line interface:

### Required Arguments

```bash
# Minimum required arguments
<engine> --output-format stream-json \
         --input-format stream-json \
         --permission-mode bypassPermissions
```

### Optional Arguments

```bash
# Session resume (required for follow-up messages)
--resume <session-id>

# Verbose logging (recommended for debugging)
--verbose

# Custom working directory
--cwd <path>
```

### Complete Example

```bash
# Initial message
custom-engine --output-format stream-json \
              --input-format stream-json \
              --permission-mode bypassPermissions \
              --verbose

# Follow-up message (session resume)
custom-engine --output-format stream-json \
              --input-format stream-json \
              --permission-mode bypassPermissions \
              --verbose \
              --resume 'session-abc123'
```

## Input/Output Protocol

### Input Format (stdin)

AgentEngine receives messages via stdin in `stream-json` format:

```json
{
  "message": "User message text",
  "content": [
    {
      "type": "text",
      "text": "User message"
    },
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/png",
        "data": "iVBORw0KGgoAAAANSUhEUgA..."
      }
    }
  ]
}
```

**Rules**:
- Each message is a single JSON object
- Followed by a newline (`\n`)
- Support both `message` (string) and `content` (multi-block) formats
- Image attachments use base64 encoding

### Output Format (stdout)

AgentEngine writes events to stdout in `stream-json` format:

```json
{"type":"agent_start","timestamp":"2026-02-06T12:00:00.000Z"}
{"type":"text_delta","text":"Hello"}
{"type":"text_delta","text":" world"}
{"type":"tool_start","name":"bash","input":{"command":"ls"}}
{"type":"tool_result","name":"bash","output":"file1.txt\nfile2.txt"}
{"type":"agent_stop","stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":50}}
```

**Rules**:
- One JSON object per line
- Each line ends with `\n`
- Events emitted in real-time (streaming)
- Final event must be `agent_stop`

### Required Event Types

Your engine must emit these events:

| Event Type | Required | Description |
|------------|----------|-------------|
| `agent_start` | ✅ | Session/turn started |
| `text_delta` | ✅ | Streaming text chunk |
| `tool_start` | ⚠️ | Tool execution started (if tools used) |
| `tool_result` | ⚠️ | Tool execution result (if tools used) |
| `agent_stop` | ✅ | Session/turn completed |
| `error` | ⚠️ | Error occurred |

## Session Management

### Session Storage

- Engine must store session state locally
- Default location: `~/.your-engine/sessions/<session-id>/`
- Must support `--resume <session-id>` to restore context

### Session Lifecycle

```
1. Initial Message (no --resume)
   ↓
   Engine creates new session directory
   ↓
   Engine saves conversation history
   ↓
   Engine exits (code 0)

2. Follow-up Message (--resume session-123)
   ↓
   Engine loads session from ~/.your-engine/sessions/session-123/
   ↓
   Engine appends to conversation history
   ↓
   Engine exits (code 0)
```

### Working Directory

- Engine should use `--cwd` argument if provided
- Otherwise, create temporary workspace per session
- Example: `.agent-workspace/sessions/<session-id>/`

## Exit Codes

Your engine must use standard exit codes:

| Code | Meaning | Backend Action |
|------|---------|----------------|
| `0` | Success | Session marked as `idle` |
| `1-255` | Error | Session marked as `error` |

## Signal Handling

Engine must handle Unix signals gracefully:

### SIGTERM (15)
- Sent when user cancels operation
- Engine should:
  1. Stop current processing
  2. Save session state
  3. Emit `agent_stop` with `stop_reason: "cancelled"`
  4. Exit cleanly (code 0)

### SIGKILL (9)
- Sent after 5-second SIGTERM timeout
- Engine is forcefully terminated
- No cleanup possible

## Environment Variables

CCAAS sets these environment variables:

```bash
AGENT_SESSION_ID=<session-id>      # Current session ID
AGENT_TENANT_ID=<tenant-id>        # Tenant identifier
AGENT_CLIENT_ID=<client-id>        # Client identifier
```

Use these for logging or telemetry.

## Configuration

### Backend Configuration

Add to `.env`:

```bash
# Use custom engine
AGENT_ENGINE_PATH=/path/to/custom-engine

# Or use npx package
AGENT_ENGINE_PATH=npx custom-engine-cli
```

### Testing Your Engine

1. **Manual Test**:
```bash
echo '{"message":"Hello"}' | custom-engine \
  --output-format stream-json \
  --input-format stream-json \
  --permission-mode bypassPermissions
```

2. **Backend Integration**:
```bash
# Set engine path
export AGENT_ENGINE_PATH=custom-engine

# Start backend
npm run dev:backend

# Connect frontend and test
```

## Implementation Checklist

- [ ] Implements `--output-format stream-json`
- [ ] Implements `--input-format stream-json`
- [ ] Implements `--permission-mode bypassPermissions`
- [ ] Implements `--resume <session-id>`
- [ ] Emits required events: `agent_start`, `text_delta`, `agent_stop`
- [ ] Handles SIGTERM gracefully
- [ ] Stores session state locally
- [ ] Exits with code 0 on success
- [ ] Reads messages from stdin (newline-delimited JSON)
- [ ] Writes events to stdout (newline-delimited JSON)
- [ ] Supports image attachments (base64)
- [ ] Uses environment variables for session/tenant context

## Example Implementation Skeleton

```javascript
#!/usr/bin/env node

const readline = require('readline');

// Parse arguments
const args = process.argv.slice(2);
const sessionId = args.includes('--resume')
  ? args[args.indexOf('--resume') + 1]
  : generateSessionId();

// Load session if resuming
let history = loadSession(sessionId) || [];

// Handle SIGTERM
process.on('SIGTERM', () => {
  saveSession(sessionId, history);
  console.log(JSON.stringify({
    type: 'agent_stop',
    stop_reason: 'cancelled'
  }));
  process.exit(0);
});

// Read stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const msg = JSON.parse(line);

  // Emit agent_start
  console.log(JSON.stringify({ type: 'agent_start' }));

  // Process message
  const response = await processMessage(msg.message, history);

  // Emit text deltas
  for (const chunk of response) {
    console.log(JSON.stringify({ type: 'text_delta', text: chunk }));
  }

  // Save history
  history.push({ role: 'user', content: msg.message });
  history.push({ role: 'assistant', content: response });
  saveSession(sessionId, history);

  // Emit agent_stop
  console.log(JSON.stringify({
    type: 'agent_stop',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 }
  }));

  process.exit(0);
});
```

## Best Practices

### Performance
- Stream responses incrementally (don't wait for full completion)
- Emit `text_delta` events frequently (every 10-50 chars)
- Load session state asynchronously

### Error Handling
- Emit `error` event for recoverable errors
- Exit with non-zero code for fatal errors
- Include error details in `agent_stop` event

### Logging
- Write logs to stderr (not stdout)
- Use `--verbose` flag to control log verbosity
- Include session ID in all log entries

### Compatibility
- Test with CCAAS backend integration tests
- Validate JSON output (must be valid newline-delimited JSON)
- Handle edge cases: empty messages, large attachments, network errors

## Troubleshooting

### Engine Not Spawning
- Check `AGENT_ENGINE_PATH` is correct
- Ensure engine executable has execute permissions
- Check backend logs for spawn errors

### Events Not Received
- Verify JSON format (use online validator)
- Ensure each event ends with `\n`
- Check stdout is not buffered (use `console.log` not `process.stdout.write`)

### Session Not Resuming
- Verify `--resume` argument parsing
- Check session directory exists and is readable
- Ensure session ID matches exactly

## Advanced Topics

### Tool Execution
- Implement tool calling protocol (similar to Claude Code)
- Emit `tool_start` and `tool_result` events
- Support MCP server integration

### Streaming Optimization
- Implement adaptive buffering
- Support backpressure detection
- Handle slow clients gracefully

### Multi-Turn Conversations
- Preserve full conversation history
- Support context window management
- Implement conversation summarization

## Resources

- [CCAAS Backend Source](../../packages/backend/)
- [Event Mapper Service](../../packages/backend/src/chat/event-mapper.service.ts)
- [Session Service](../../packages/backend/src/chat/session.service.ts)
- [AgentEngine Lifecycle](./AGENT_ENGINE_LIFECYCLE.md)

## Support

For questions or issues with custom engine integration:
- Create an issue at https://github.com/anthropics/claude-code/issues
- Tag with `custom-engine` label
- Include engine implementation details and logs
