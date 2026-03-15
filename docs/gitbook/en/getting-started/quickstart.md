# 5-Minute Quick Start

This guide walks you through the core features of KedgeAgentic in just a few minutes.

## Try It Online

A hosted instance is available at [https://ccaas.zhushou.one/](https://ccaas.zhushou.one/). You can explore the admin dashboard and API without any local setup.

## Start the Service (Local)

```bash
# Install dependencies and build
npm install && npm run build:common

# Start the backend
npm run dev:backend
```

## Verify the Service Is Running

```bash
curl http://localhost:3001/api/v1/chat/health
# Returns: { "status": "ok" }
```

## Try a Demo

Clone the examples repository and set up any demo against the hosted backend:

```bash
git clone https://github.com/kedge-agentic/examples.git
cd examples/demo/01-pure-chat

# Configure your API key
cp ../.env.example .env
# Edit .env to set your CCAAS_API_KEY

# Import the demo
../setup.sh
```

The setup script imports the Solution into `https://ccaas.zhushou.one` (configurable via `.env`). After import, try sending a message:

```bash
curl -N -X POST https://ccaas.zhushou.one/api/v1/sessions/test-1/messages \
  -H "Authorization: Bearer $CCAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message":"Hello!","tenantId":"demo-02-pure-chat"}'
```

More demos (02-multi-template through 12-sync-fields) are available in the same repository.

## REST API Quick Tour

### Health Check and Server Status

```bash
# Health check (no authentication required)
curl http://localhost:3001/api/v1/chat/health

# Server status (no authentication required)
curl http://localhost:3001/api/v1/chat/status
```

### Send a Message (Recommended: Use SDK)

> **💡 Tip**: Calling REST API directly requires managing WebSocket connections simultaneously. We recommend using `@kedge-agentic/react-sdk` or `@kedge-agentic/vue-sdk` for integration.

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

## SSE Streaming

Send a message and receive a real-time event stream via SSE (default transport since v1.1.0):

```javascript
const response = await fetch(
  'http://localhost:3001/api/v1/sessions/my-session/messages',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'test-client-001',
      message: 'Please generate a report for me',
      tenantId: 'default',
    }),
  }
)

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const lines = decoder.decode(value).split('\n')
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const event = JSON.parse(line.slice(6))
    if (event.type === 'text_delta') process.stdout.write(event.delta)
    if (event.type === 'agent_status') console.log('Status:', event.status)
    if (event.type === 'output_update') console.log('Output:', event.payload)
  }
}
```

## Next Steps

- Read the [Solution Development Guide](../guide/solution-dev.md) to build your own application
- Check the [API Reference](../api/) for all available endpoints
- Review the [Best Practices](../reference/best-practices.md) to avoid common pitfalls
