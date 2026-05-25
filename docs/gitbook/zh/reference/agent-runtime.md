# `@kedge-agentic/agentfs-runtime` 包参考

> 框架无关的 agentfs 运行时层。Phase A：`BaseMaterializer` + `ContentSource` 端口 + `Logger` 端口。没有 NestJS / TypeORM / Express 依赖；纯 TypeScript + `node:fs` / `node:crypto`。

## 什么时候你需要这个包

| 你想做… | 用 |
|---|---|
| 在 ccaas backend 里改 BaseMaterializer 的行为 | 改本包 |
| 在另一个项目里复用 BaseMaterializer 的逻辑（你不是 NestJS / TypeORM 用户） | import 本包 + 实现你自己的 `ContentSource` |
| 给 ccaas backend 写一个非 TypeORM 的 skill 来源（比如纯 JSON 文件） | 实现 `ContentSource`，替换 `TypeOrmSkillContentSource` |
| 在测试里 mock 一个 BaseMaterializer 的输入 | 用 `@kedge-agentic/agentfs-runtime/testing` 的 `InMemoryContentSource` |
| 写一个 solution backend，不想绕 ccaas 直接做 skill 项目化 | 这个包**够用**（pure logic），但你还需要决定 skill 内容怎么来 |

## 包的设计

Clean architecture，依赖方向只有一个：**consumer → 本包 / core**，本包绝不引 consumer。

```
src/
├── core/
│   ├── types.ts          ← ContentSource 端口 + 值对象
│   ├── logger.ts         ← Logger 端口 + noopLogger
│   └── base-materializer.ts  ← 纯类
├── testing/
│   └── in-memory-content-source.ts  ← 测试 helper（通过 /testing subpath 暴露）
└── index.ts              ← 公共 API
```

公开 API：
```ts
import {
  BaseMaterializer,
  ContentSource, SkillContent, SkillFileContent, McpServerContent, MaterializeResult,
  Logger, noopLogger,
} from '@kedge-agentic/agentfs-runtime';

import { InMemoryContentSource } from '@kedge-agentic/agentfs-runtime/testing';
```

## `ContentSource` 端口 — 最核心的扩展点

只有两个方法，**最小知识原则**：

```ts
interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}
```

值对象：

```ts
interface SkillContent {
  id: string;                     // 任何稳定唯一标识；写进 .skill.json
  tenantId: string;
  slug: string;                   // URL-safe，作为目录名
  name: string;
  description?: string;
  content: string;                // SKILL.md 主体
  files: ReadonlyArray<SkillFileContent>;  // 子文件（progressive disclosure）
}

interface SkillFileContent {
  relativePath: string;           // **不能含 `..` 或绝对路径**；materializer 会拒绝
  content: string;
}

interface McpServerContent {
  tenantId: string;
  slug: string;
  name: string;
  type: string;                   // 'stdio' | 'sse' | ...
  config: unknown;                // 由 adapter 决定形状；materializer 直接 JSON.stringify
}
```

## `BaseMaterializer` — 纯类

```ts
import { BaseMaterializer } from '@kedge-agentic/agentfs-runtime';

const m = new BaseMaterializer(
  contentSource,    // 实现了 ContentSource 的实例
  '/abs/base/dir',  // agentfs --base 用的根
  logger,           // 可选；默认 noopLogger
);

const result = await m.materialize();
// → { baseDir, skillsWritten, skillFilesWritten, mcpServersWritten, durationMs }
```

写出布局：

```
${baseDir}/
└── tenants/
    └── {tenantId}/
        ├── skills/
        │   └── {slug}/
        │       ├── SKILL.md       ← skill.content
        │       ├── .skill.json    ← { id, name, description }
        │       └── <relativePath> ← 每个 SkillFileContent
        └── mcp-servers/
            └── {slug}/
                └── config.json    ← { name, type, config }
```

**幂等**：每个文件 sha1-gated。re-run 不写未变内容。可以在每次后端启动时安全调用。

**安全**：`SkillFileContent.relativePath` 不能含 `..` 或绝对路径 — materializer 用 `safeJoinUnderDir` 拒绝并 log warn，**跳过这条**继续处理剩下的（一条恶意 row 不应该让整个 materialize 失败）。

## `Logger` 端口

```ts
interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

const noopLogger: Logger = { log() {}, warn() {}, error() {}, debug() {} };
```

要桥接到 NestJS / pino / console：
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

参考：`packages/backend/src/sessions/workspace/base-materializer.factory.ts` 的 `NestLoggerAdapter`。

## 写一个非 TypeORM 的 `ContentSource`

例子：从 JSON 文件加载 skill（适合 prototype / static 部署）。

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

然后：
```ts
const src = new JsonFileContentSource('./skills.json');
const m = new BaseMaterializer(src, '/var/agentfs/base');
await m.materialize();
```

## 测试 helper

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

ccaas backend 自带的 `TypeOrmSkillContentSource` 测试就是用这个 helper 验证适配器的 mapping 行为。

## Phase B / C（未来）

| Phase | 范围 |
|---|---|
| **A** | BaseMaterializer + ContentSource + Logger ports（**已 ship**） |
| B | `WorkspaceProvider` interface + `LocalWorkspaceProvider` + `AgentfsWorkspaceProvider`（含一个 `AgentfsCliAdapter` 端口给 CLI 调用解耦） |
| C | `SandboxService` + `just-bash-mcp/server.mjs`（可能拆成单独的 `@kedge-agentic/sandbox-bash` 包） |

触发 B/C 的条件：出现真实的第二个消费者，或者要单独开源运行时层。当前只有 ccaas backend 一个 consumer，premature extraction 反而是负债。

## See also

- 包源码：`packages/agentfs-runtime/`
- 包 README：`packages/agentfs-runtime/README.md`（含 mini quickstart）
- 设计推导：`packages/vfs-poc/docs/WORKSPACE_PROVIDER.md`（archive，但是原始设计依据）
- adapter 范例：`packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`
- factory 范例：`packages/backend/src/sessions/workspace/base-materializer.factory.ts`
