# Solution Quick Start - 10 Minutes

Create a new CCAAS solution in under 10 minutes.

---

## Prerequisites

- CCAAS backend running on port 3001
- Node.js 18+ installed

Verify CCAAS is running:
```bash
curl http://localhost:3001/api/v1/chat/health
# Should return: {"status":"ok"}
```

---

## Step 1: Create Directory

```bash
cd solutions
mkdir my-solution
cd my-solution
```

---

## Step 2: Create solution.json

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "My first CCAAS solution",
  "author": "Your Name",

  "tenant": {
    "slug": "my-solution",
    "name": "My Solution",
    "maxSessions": 100
  },

  "ports": {
    "frontend": 5280
  }
}
```

---

## Step 3: Create setup.sh

```bash
#!/bin/bash
set -e

CCAAS_DB="../../packages/backend/.agent-workspace/data.db"

# Create tenant
echo "Creating tenant..."
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" 2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    sqlite3 "$CCAAS_DB" "
    INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
        'My Solution',
        'my-solution',
        'My first CCAAS solution',
        '{}', 100, 50, 10, 'free',
        'sk_' || lower(hex(randomblob(24))),
        'active', datetime('now'), datetime('now')
    );
    "
    echo "✓ Tenant created"
else
    echo "✓ Tenant exists"
fi

# Install frontend deps
echo "Installing dependencies..."
cd frontend && npm install
echo "✅ Setup complete!"
```

Make it executable:
```bash
chmod +x setup.sh
```

---

## Step 4: Create Frontend

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @ccaas/react-sdk
cd ..
```

Edit `frontend/src/App.tsx`:

```typescript
import { useAgentConnection, useAgentChat, ChatPanel } from '@ccaas/react-sdk'

function App() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my',
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',
  })

  return (
    <div style={{ height: '100vh', padding: '20px' }}>
      <h1>My Solution</h1>
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
      />
    </div>
  )
}

export default App
```

Edit `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5280 },
})
```

---

## Step 5: Run Setup

```bash
bash setup.sh
```

---

## Step 6: Start Development

```bash
cd frontend
npm run dev
```

---

## Step 7: Test

Open http://localhost:5280

Type "Hello" and press Enter. You should see Claude respond!

---

## What's Next?

- [Full Solution Guide](./CREATING_A_SOLUTION.md) - Learn about MCP servers, skills, custom backends
- [Quiz Analyzer Example](../../solutions/quiz-analyzer/) - Study a production solution
- [@ccaas/react-sdk Docs](../../packages/react-sdk/README.md) - Explore SDK features

---

## Troubleshooting

### "Tenant not found"

Run `bash setup.sh` again to create the tenant.

### "WebSocket connection failed"

Ensure CCAAS backend is running:
```bash
cd packages/backend
npm run start:dev
```

### Port conflict

Change `ports.frontend` in `solution.json` to a different port.
