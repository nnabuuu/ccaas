# @kedge-agentic/context-layer-react

> React components for the Context Layer @ reference system.

## Install

```bash
npm install @kedge-agentic/context-layer-react
```

**Peer dependency**: `@kedge-agentic/context-layer` (uses `ContextLayerClient` from the `/client` subpath).

## AtPicker Component

The `<AtPicker />` component provides a popup entity picker with recents, search, drill-down browsing, and keyboard navigation.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `baseUrl` | `string` | Yes | Context Layer API base URL (e.g. `http://localhost:3001/api/v1/context`) |
| `sessionId` | `string` | Yes | Current session ID for activity tracking |
| `open` | `boolean` | Yes | Whether the picker is visible |
| `onClose` | `() => void` | Yes | Called when picker should close (Escape, outside click) |
| `onSelect` | `(entity: EntityRef) => void` | Yes | Called when user selects an entity |
| `sessionTemplate` | `string` | No | Session template ID for template-specific shortcuts |
| `initialDrillType` | `string` | No | Auto-drill into this entity type on open (from toolbar shortcut) |

### EntityRef

The `onSelect` callback receives an `EntityRef`:

```typescript
interface EntityRef {
  entityType: string;
  entityId: string;
  displayName: string;
  icon: string;
  data?: unknown; // Full resolved data from /context/resolve
}
```

### Usage

```tsx
import { AtPicker } from '@kedge-agentic/context-layer-react';

function ChatComposer() {
  const [showPicker, setShowPicker] = useState(false);
  const [refs, setRefs] = useState<EntityRef[]>([]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Inline ref pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {refs.map(ref => (
          <span key={`${ref.entityType}:${ref.entityId}`}>
            {ref.icon} {ref.displayName}
            <button onClick={() => setRefs(r => r.filter(x => x !== ref))}>x</button>
          </span>
        ))}
        <input
          onKeyDown={e => { if (e.key === '@') setShowPicker(true); }}
          placeholder="Type @ to reference..."
        />
      </div>

      {/* AtPicker popup */}
      <AtPicker
        baseUrl="http://localhost:3001/api/v1/context"
        sessionId={sessionId}
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(entity) => {
          setRefs(prev => [...prev, entity]);
          setShowPicker(false);
        }}
      />
    </div>
  );
}
```

### Features

- **Recents** — Activity-scored recent entities on initial view
- **Search** — Debounced cross-type search (200ms delay)
- **Drill-down** — Navigate parent-child relationships via the relation tree
- **Breadcrumb** — Shows entity path for nested items (e.g. `Lesson Plan > Block > Attachment`)
- **Keyboard navigation** — ArrowUp/Down to move, Enter to select, Escape to close, ArrowRight to drill, ArrowLeft to go back

## Architecture

```
context-layer-react
  └── depends on: context-layer/client (ContextLayerClient)
        └── calls: Context Layer REST API (/context/*)
```

The React package only depends on `ContextLayerClient` from `@kedge-agentic/context-layer/client`. It does not import NestJS or any backend code.
