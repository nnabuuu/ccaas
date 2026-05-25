# `@kedge-agentic/agentfs-runtime` package reference

> Framework-free agentfs runtime layer. Phase A: `BaseMaterializer` + `ContentSource` port + `Logger` port. No NestJS / TypeORM / Express dependencies; pure TypeScript + `node:fs` / `node:crypto`.

## When you need this package

| You want to… | Reach for |
|---|---|
| Modify BaseMaterializer behavior in ccaas backend | Edit this package |
| Reuse BaseMaterializer logic in another project (not a NestJS/TypeORM user) | Import this package + implement your own `ContentSource` |
| Use a non-TypeORM skill source in ccaas backend (e.g. plain JSON files) | Implement `ContentSource`, replace `TypeOrmSkillContentSource` |
| Mock BaseMaterializer input in tests | Use `InMemoryContentSource` from `@kedge-agentic/agentfs-runtime/testing` |
| Build a solution backend without going through ccaas to project skills | This package is **enough** (pure logic), but you still need to decide where the skill content comes from |

## Package design

Clean architecture, single direction of dependency: **consumer → this package / core**, never the reverse.

```
src/
├── core/
│   ├── types.ts          ← ContentSource port + value objects
│   ├── logger.ts         ← Logger port + noopLogger
│   └── base-materializer.ts  ← pure class
├── testing/
│   └── in-memory-content-source.ts  ← test helper (exposed via /testing subpath)
└── index.ts              ← public API
```

Public API:
```ts
import {
  BaseMaterializer,
  ContentSource, SkillContent, SkillFileContent, McpServerContent, MaterializeResult,
  Logger, noopLogger,
} from '@kedge-agentic/agentfs-runtime';

import { InMemoryContentSource } from '@kedge-agentic/agentfs-runtime/testing';
```

## `ContentSource` port — the core extension point

Only two methods, **minimum-knowledge** by design:

```ts
interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}
```

Value objects:

```ts
interface SkillContent {
  id: string;                     // any stable unique identifier; written into .skill.json
  tenantId: string;
  slug: string;                   // URL-safe; used as directory name
  name: string;
  description?: string;
  content: string;                // SKILL.md body
  files: ReadonlyArray<SkillFileContent>;  // sub-files (progressive disclosure)
}

interface SkillFileContent {
  relativePath: string;           // **no `..` or absolute path**; materializer rejects
  content: string;
}

interface McpServerContent {
  tenantId: string;
  slug: string;
  name: string;
  type: string;                   // 'stdio' | 'sse' | ...
  config: unknown;                // adapter-defined shape; materializer JSON-stringifies it
}
```

## `BaseMaterializer` — the pure class

```ts
import { BaseMaterializer } from '@kedge-agentic/agentfs-runtime';

const m = new BaseMaterializer(
  contentSource,    // an instance of ContentSource
  '/abs/base/dir',  // root for agentfs --base
  logger,           // optional; defaults to noopLogger
);

const result = await m.materialize();
// → { baseDir, skillsWritten, skillFilesWritten, mcpServersWritten, durationMs }
```

Output layout:

```
${baseDir}/
└── tenants/
    └── {tenantId}/
        ├── skills/
        │   └── {slug}/
        │       ├── SKILL.md       ← skill.content
        │       ├── .skill.json    ← { id, name, description }
        │       └── <relativePath> ← each SkillFileContent
        └── mcp-servers/
            └── {slug}/
                └── config.json    ← { name, type, config }
```

**Idempotent**: each file is sha1-gated. A re-run does not write unchanged content. Safe to call on every backend startup.

**Safety**: `SkillFileContent.relativePath` may not contain `..` segments or absolute paths — the materializer uses `safeJoinUnderDir` to reject and log a warn, **skipping that one file** and continuing the rest (one malicious row should not halt the whole materialize).

## `Logger` port

```ts
interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

const noopLogger: Logger = { log() {}, warn() {}, error() {}, debug() {} };
```

To bridge to NestJS / pino / console:
```ts
import { Logger as NestLogger } from '@nestjs/common';

const adapter = new (class implements Logger {
  private l = new NestLogger('BaseMaterializer');
  log(m: string)   { this.l.log(m); }
  warn(m: string)  { this.l.warn(m); }
  error(m: string) { this.l.error(m); }
  debug(m: string) { this.l.debug(m); }
})();
```

Reference: `NestLoggerAdapter` in `packages/backend/src/sessions/workspace/base-materializer.factory.ts`.

## Writing a non-TypeORM `ContentSource`

Example: load skills from a JSON file (good for prototypes / static deploys).

```ts
import { readFileSync } from 'node:fs';
import type { ContentSource, SkillContent, McpServerContent } from '@kedge-agentic/agentfs-runtime';

export class JsonFileContentSource implements ContentSource {
  constructor(private readonly jsonPath: string) {}

  async listActiveSkills(): Promise<ReadonlyArray<SkillContent>> {
    const data = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
    return data.skills ?? [];
  }

  async listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>> {
    const data = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
    return data.mcpServers ?? [];
  }
}
```

Then:
```ts
const src = new JsonFileContentSource('./skills.json');
const m = new BaseMaterializer(src, '/var/agentfs/base');
await m.materialize();
```

## Test helper

```ts
import { InMemoryContentSource } from '@kedge-agentic/agentfs-runtime/testing';

const src = new InMemoryContentSource(
  [{ id: 's1', tenantId: 't1', slug: 'hello', name: 'Hello',
     content: '# Hello', files: [] }],
  [],  // mcp servers
);
const m = new BaseMaterializer(src, '/tmp/baseDir-for-test');
await m.materialize();
```

ccaas backend's `TypeOrmSkillContentSource` tests use this helper to validate the adapter's mapping behavior.

## Phase B / C (future)

| Phase | Scope |
|---|---|
| **A** | BaseMaterializer + ContentSource + Logger ports (**shipped**) |
| B | `WorkspaceProvider` interface + `LocalWorkspaceProvider` + `AgentfsWorkspaceProvider` (with an `AgentfsCliAdapter` port to decouple CLI invocation) |
| C | `SandboxService` + `just-bash-mcp/server.mjs` (possibly as a separate `@kedge-agentic/sandbox-bash` package) |

Trigger for B/C: a real second consumer surfaces, or a need to open-source the runtime layer. With only the ccaas backend consuming today, premature extraction is a liability.

## See also

- Package source: `packages/agentfs-runtime/`
- Package README: `packages/agentfs-runtime/README.md` (mini quickstart)
- Design rationale: `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` (archive, but original design basis)
- Adapter reference: `packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`
- Factory reference: `packages/backend/src/sessions/workspace/base-materializer.factory.ts`
