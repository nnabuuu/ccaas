# Chat Integration with React SDK

Learn how to integrate CCAAS chat functionality into your React solution using the `@ccaas/react-sdk` package.

## Overview

The React SDK provides pre-built components and hooks for building chat interfaces with:

- Real-time message streaming
- Agent status tracking (tools, thinking, todos, subagents)
- Form synchronization with AI suggestions
- Multiple layout modes
- Skill management

## Quick Start

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@ccaas/react-sdk'

function App() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={status.isProcessing}
      connected={connection.connected}
      activeTools={status.activeTools}
      activeSubAgents={status.activeSubAgents}
      onSendMessage={chat.sendMessage}
    />
  )
}
```

## Key Concepts

### Modular Hooks

The SDK uses composable hooks for different concerns:

- **useAgentConnection** - WebSocket connection management
- **useAgentChat** - Message handling
- **useAgentStatus** - Agent execution tracking
- **useChatLayout** - UI layout state
- **useSkills** - Solution skills management

### Components

Pre-built UI components:

- **ChatPanel** - Complete chat interface
- **MessageBubble** - Individual message display
- **AgentActivityLine** - Status bar with expandable details
- **OutputUpdateCard** - AI-suggested updates with sync/discard actions
- **QuickActions** - Quick action buttons
- **SubAgentCard** - Subagent progress tracking

### Custom Hook Pattern

Extract solution-specific logic:

```tsx
export function useMySession() {
  const connection = useAgentConnection({...})
  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // Add custom state/logic
  const [customData, setCustomData] = useState(...)

  return {
    ...connection,
    ...chat,
    ...status,
    ...layout,
    customData
  }
}
```

## Documentation

For complete integration guides and examples:

- [Chat Integration Guide](../../../packages/react-sdk/docs/CHAT_INTEGRATION_GUIDE.md) - Detailed tutorial with examples
- [React SDK README](../../../packages/react-sdk/README.md) - Component and hook API reference
- [Solution Template](../../SOLUTION_TEMPLATE.md) - Template for new solutions

## Examples

See working examples in:

- `solutions/ccaas-demo` - Basic chat with file tracking
- `solutions/lesson-plan-designer` - Form sync with output updates

## Next Steps

1. Review the [Chat Integration Guide](../../../packages/react-sdk/docs/CHAT_INTEGRATION_GUIDE.md)
2. Copy the [Solution Template](../../SOLUTION_TEMPLATE.md)
3. Customize hooks and components for your domain
4. Add solution-specific features

## Support

- [API Reference](../api/README.md) - REST and WebSocket API
- [Frontend Integration Guide](frontend.md) - General frontend patterns
- [Best Practices](../reference/best-practices.md) - Development guidelines
