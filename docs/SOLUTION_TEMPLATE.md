# Solution Template

This template provides a starting point for creating new CCAAS solutions.

## Directory Structure

```
solutions/my-solution/
├── backend/                   # NestJS backend (if needed)
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── my-solution/       # Domain module
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── App.tsx           # Main app component
│   │   ├── hooks/
│   │   │   └── useMySession.ts  # Custom session hook
│   │   ├── components/
│   │   │   └── ...           # Domain-specific components
│   │   ├── types/
│   │   │   └── index.ts      # Solution types
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── mcp-server/                # MCP tools (optional)
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── skills/                    # Solution-specific skills
│   └── my-skill/
│       └── SKILL.md
└── solution.json              # Solution metadata
```

## Required Dependencies

### Frontend package.json

```json
{
  "name": "my-solution-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@kedge-agentic/react-sdk": "workspace:*",
    "@kedge-agentic/common": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.2",
    "vite": "^6.0.5"
  }
}
```

### Backend package.json (Optional)

```json
{
  "name": "my-solution-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.15",
    "@nestjs/typeorm": "^10.0.2",
    "typeorm": "^0.3.20",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/testing": "^10.4.15",
    "@types/node": "^22.10.2",
    "typescript": "~5.6.2"
  }
}
```

## Minimal App.tsx

```tsx
import { useState, useEffect } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout,
  ChatPanel,
  MessageBubble,
  ChatLayoutControls
} from '@kedge-agentic/react-sdk'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default'

function App() {
  // Connect to backend
  const connection = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'my-solution',
  })

  // Chat functionality
  const chat = useAgentChat({
    connection,
    solutionId: TENANT_ID,
  })

  // Status tracking (tools, thinking, todos, subagents)
  const status = useAgentStatus({ connection })

  // Layout controls (mode, collapsed state)
  const layout = useChatLayout()

  return (
    <div className="app">
      <ChatLayoutControls
        mode={layout.mode}
        onModeChange={layout.setMode}
        isCollapsed={layout.isCollapsed}
        onToggleCollapse={layout.toggleCollapsed}
        colorScheme="blue"
      />

      <div className="main-content">
        <ChatPanel
          messages={chat.messages}
          isProcessing={status.isProcessing}
          connected={connection.connected}
          activeTools={status.activeTools}
          activeSubAgents={status.activeSubAgents}
          isThinking={status.isThinking}
          thinkingContent={status.thinkingContent}
          todoItems={status.todoItems}
          todoStats={status.todoStats}
          onSendMessage={chat.sendMessage}
          onCancel={() => chat.cancelProcessing()}
        />
      </div>
    </div>
  )
}

export default App
```

## Custom Hook Pattern

Extract complex logic into a custom hook:

```tsx
// hooks/useMySession.ts
import { useState, useEffect } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout,
} from '@kedge-agentic/react-sdk'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default'

export function useMySession() {
  // Core SDK hooks
  const connection = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'my-solution',
  })

  // Solution-specific state
  const [formData, setFormData] = useState({})
  const [pendingUpdates, setPendingUpdates] = useState(new Map())

  // Chat with output update handler (SSE-based, managed by SDK)
  const chat = useAgentChat({
    connection,
    solutionId: TENANT_ID,
    onOutputUpdate: (update) => {
      // The SDK normalizes raw events into a flat OutputUpdate
      const { field, value, preview } = update
      setPendingUpdates(prev => new Map(prev).set(field, { value, preview }))
    },
  })

  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // Solution-specific methods
  const syncToForm = (field: string) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    setFormData(prev => ({ ...prev, [field]: update.value }))
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }

  const discardUpdate = (field: string) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }

  return {
    // Connection
    connected: connection.connected,
    sessionId: connection.sessionId,
    cancelProcessing: chat.cancelProcessing,

    // Chat
    messages: chat.messages,
    sendMessage: chat.sendMessage,

    // Status
    isProcessing: status.isProcessing,
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    todoItems: status.todoItems,
    todoStats: status.todoStats,

    // Layout
    ...layout,

    // Solution-specific
    formData,
    setFormData,
    pendingUpdates,
    syncToForm,
    discardUpdate,
  }
}

// App.tsx
import { useMySession } from './hooks/useMySession'

function App() {
  const session = useMySession()

  return (
    <ChatPanel
      {...session}
      renderMessage={(msg) => (
        <MessageBubble message={msg}>
          {/* Custom rendering */}
        </MessageBubble>
      )}
    />
  )
}
```

## Custom Styling Guide

### Tailwind CSS Setup

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```js
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/react-sdk/src/**/*.{js,ts,jsx,tsx}", // Include SDK
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          // ...
        }
      }
    },
  },
  plugins: [],
}
```

### CSS Custom Properties

```css
/* App.css */
:root {
  --color-primary: #3b82f6;
  --color-background: #f9fafb;
  --color-text: #1f2937;
  --border-radius: 0.5rem;
}

.app {
  background: var(--color-background);
  color: var(--color-text);
}

/* Override SDK styles */
.message-bubble {
  border-radius: var(--border-radius);
}

.btn-primary {
  background: var(--color-primary);
}
```

### Component Customization

```tsx
// Custom MessageBubble styling
<MessageBubble
  message={msg}
  className="my-custom-message"
  colorScheme="purple"  // or custom scheme
>
  {/* children */}
</MessageBubble>

// Custom ChatPanel layout
<ChatPanel
  {...props}
  className="my-chat-panel"
  renderMessage={(msg) => (
    <div className="message-wrapper">
      <MessageBubble message={msg} />
    </div>
  )}
/>
```

## Backend Integration Checklist

### 1. Setup NestJS Module

```typescript
// backend/src/my-solution/my-solution.module.ts
import { Module } from '@nestjs/common'
import { MySolutionController } from './my-solution.controller'
import { MySolutionService } from './my-solution.service'

@Module({
  controllers: [MySolutionController],
  providers: [MySolutionService],
})
export class MySolutionModule {}
```

### 2. Add REST Endpoints

```typescript
// backend/src/my-solution/my-solution.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common'

@Controller('api/my-solution')
export class MySolutionController {
  @Get()
  async findAll() {
    return []
  }

  @Post()
  async create(@Body() dto: any) {
    return {}
  }
}
```

### 3. Configure CORS

```typescript
// backend/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })

  await app.listen(3002)
}
bootstrap()
```

### 4. Standard SSE Events

The core CCAAS backend streams events to the frontend via SSE. The SDK handles them automatically through hooks like `useAgentChat`, `useAgentStatus`, etc.

**Event types handled by the SDK:**

| Event | SDK Hook | Purpose |
|-------|----------|---------|
| `output_update` | `useAgentChat({ onOutputUpdate })` | AI suggests form field updates |
| `tool_activity` | `useAgentStatus()` → `activeTools` | Tool execution tracking |
| `agent_status` | `useAgentStatus()` → `isProcessing` | Agent completion |
| `subagent_started` | `useAgentStatus()` → `activeSubAgents` | SubAgent tracking |
| `subagent_completed` | `useAgentStatus()` → `activeSubAgents` | SubAgent finished |

**Using output_update in your skill (SKILL.md):**

To send structured updates to the frontend, use the `write_output` MCP tool in your skill:

```markdown
## Tools
- write_output: Write structured data to a specific output field
```

The core backend converts MCP tool results into SSE events that the SDK processes automatically.

## Solution Metadata

Create `solution.json` to register your solution:

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "description": "A solution built with CCAAS",
  "version": "1.0.0",
  "author": "Your Name",
  "frontend": {
    "port": 5176,
    "directory": "frontend"
  },
  "backend": {
    "port": 3003,
    "directory": "backend"
  },
  "mcpServer": {
    "directory": "mcp-server",
    "command": "node dist/index.js"
  },
  "skills": ["my-skill"]
}
```

## Development Workflow

### 1. Setup

```bash
# From monorepo root
npm install

# Build shared packages first
npm run build:shared
npm run build:react-sdk

# Navigate to your solution
cd solutions/my-solution
```

### 2. Development

```bash
# Terminal 1: Start backend
cd backend && npm run start:dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: Run CCAAS backend (if using shared services)
cd ../../packages/backend && npm run start:dev
```

### 3. Testing

```bash
# Backend tests
cd backend && npm test

# Frontend build check
cd frontend && npm run build
```

## Best Practices

1. **Use Custom Hook**: Extract complex logic into `useMySession` hook
2. **Type Safety**: Define types in `types/index.ts`, import from `@kedge-agentic/common` where possible
3. **Event Handling**: Use SDK callback props (e.g., `onOutputUpdate`) instead of manual event listeners
4. **Error Handling**: Handle connection errors gracefully
5. **State Management**: Keep solution state local, use SDK hooks for shared state
6. **Styling**: Use CSS variables for theming, override SDK styles as needed
7. **Backend Events**: Emit standard events for SDK compatibility
8. **Testing**: Write tests for custom hooks and components
9. **Documentation**: Document domain-specific features in README

## Examples

- **Basic Chat**: See `solutions/ccaas-demo`
- **Form Sync**: See `solutions/lesson-plan-designer`
- **Custom Backend**: See `solutions/lesson-plan-designer/backend`
- **MCP Server**: See `solutions/lesson-plan-designer/mcp-server`

## Next Steps

1. Copy this template to `solutions/my-solution`
2. Install dependencies
3. Create `useMySession` hook
4. Build your UI with ChatPanel
5. Add domain-specific features
6. Test and iterate

## Support

- [React SDK Documentation](../packages/react-sdk/README.md)
- [Chat Integration Guide](../packages/react-sdk/docs/CHAT_INTEGRATION_GUIDE.md)
- [Backend Documentation](../packages/backend/CLAUDE.md)
