# @kedge-agentic/entity-document

Block-based document model with bidirectional Markdown serialization. Used by `@kedge-agentic/context-layer` to give LLM agents structured, editable views of business entities (lesson plans, templates, etc.).

## Core Concepts

- **EntityDocument** — `{ meta, blocks[] }` — the canonical in-memory representation
- **BlockTransform** — per-type serialize/deserialize/detect for Markdown round-trips
- **TransformRegistry** — pluggable registry; solutions can add custom block types
- **str_replace** — surgical text edit that operates on the serialized Markdown form

## Built-in Block Types (7)

| Type | Markdown Pattern |
|------|-----------------|
| `section` | `## Heading` with nested content |
| `timeline` | `### HH:MM - HH:MM Title` |
| `table` | `\| col \| col \|` pipe tables |
| `list` | `- item` / `1. item` |
| `callout` | `> [!type] Title` |
| `image` | `![alt](url)` |
| `text` | Plain paragraphs (fallback) |

## Usage

```typescript
import {
  serialize, deserialize, strReplace,
  TransformRegistry, defaultRegistry,
  splitBlockForDocument, mergeBlockForStorage,
} from '@kedge-agentic/entity-document';

// Basic round-trip
const doc = deserialize(markdownText);
const markdown = serialize(doc);

// Surgical edit
const result = strReplace(doc, 'old text', 'new text');

// Custom block type
const registry = TransformRegistry.withDefaults();
registry.register('custom', myCustomTransform);
const text = serialize(doc, registry);

// DB ↔ Document field splitting
const config = { callout: ['color'] };
const docBlock = splitBlockForDocument(dbBlock, config);
const dbBlock2 = mergeBlockForStorage(docBlock, config);
```

## API

### Serialization

- `serialize(doc, registry?)` — EntityDocument → Markdown string
- `deserialize(text, registry?)` — Markdown string → EntityDocument
- `strReplace(doc, oldStr, newStr, registry?)` — in-place text replacement

### Registry

- `TransformRegistry.withDefaults()` — factory with 7 built-in transforms
- `defaultRegistry` — module-level singleton
- `registry.register(type, transform)` / `registry.unregister(type)`
- `registry.getTransform(type)` / `registry.detectTransform(lines)`
- `getTransform(type)` / `detectTransform(lines)` — module-level delegates to `defaultRegistry`

### Block Utils

- `splitBlockForDocument(block, config?)` — DB block → EntityDocument block (extracts non-serializable fields to `attributes`)
- `mergeBlockForStorage(block, config?)` — EntityDocument block → DB block (merges attributes back into content)
- `ContentToAttrConfig = Record<string, string[]>` — maps block type → field names to extract

## Testing

```bash
npm test        # vitest run (77 tests)
npm run test:watch
```
