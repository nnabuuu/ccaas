# 5-Minute Quick Start

This guide walks you through the core features of LoopAI in just a few minutes.

## Start the Service

```bash
# Install dependencies and build
npm install && npm run build:shared

# Start the backend
npm run dev:backend
```

## Verify the Service Is Running

```bash
curl http://localhost:3001/api/v1/chat/health
# Returns: { "status": "ok" }
```

## Try the CCAAS Demo

The quickest way to get started is to run the CCAAS Demo:

```bash
cd solutions/ccaas-demo
./setup.sh
```

Once the setup is complete, open `http://localhost:5179` to explore:

1. **Chat Interaction** -- Type a message in the chat interface and watch the AI respond in real time
2. **Skill Switching** -- Enable or disable different Skills to see how AI behavior changes
3. **File Generation** -- Ask the AI to generate a file and download it

## REST API Quick Tour

### Health Check and Server Status

```bash
# Health check (no authentication required)
curl http://localhost:3001/api/v1/chat/health

# Server status (no authentication required)
curl http://localhost:3001/api/v1/chat/status
```

### Send a Message (Recommended: Use SDK)

> **💡 Tip**: Calling REST API directly requires managing WebSocket connections simultaneously. We recommend using `@ccaas/react-sdk` or `@ccaas/vue-sdk` for integration.

If you really need to call the API directly:

```bash
# You need to establish a WebSocket connection first, otherwise you won't receive response events
curl -X POST http://localhost:3001/api/v1/sessions/my-session/completion \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-001",
    "message": "Hello, please introduce yourself",
    "tenantId": "default"
  }'
```

### Cancel a Running Task

```bash
curl -X DELETE http://localhost:3001/api/v1/sessions/my-session/completion \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-001"
  }'
```

## WebSocket Connection

Connect to `ws://localhost:3001` using any WebSocket client:

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

// Listen for Agent status
socket.on('agent_status', (data) => {
  console.log('Agent status:', data.status)
})

// Listen for text stream
socket.on('text_delta', (data) => {
  process.stdout.write(data.text)
})

// Listen for structured output
socket.on('output_update', (data) => {
  console.log('Output update:', data)
})

// Send a message
socket.emit('chat', {
  message: 'Please generate a report for me',
  sessionId: 'my-session'
})
```

## Next Steps

- Read the [Solution Development Guide](../guide/solution-dev.md) to build your own application
- Check the [API Reference](../api/) for all available endpoints
- Review the [Best Practices](../reference/best-practices.md) to avoid common pitfalls
