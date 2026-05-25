# Solution 扩展点 — 用上 runtime 新能力

> 你已经会用现有的 solution 模板（Skills + MCP + sessionTemplates）。这页教你 stage-1 的 4 个新扩展点：（1）seed 自己的数据进每个 session，（2）写自己的 `ContentSource` 替换 TypeORM，（3）用 snapshot/rollback 包住高风险 agent prompt，（4）用 metadata KV 存 solution 自己的状态。每个都带一个能拷贝的最小范例。

## TL;DR — 4 个扩展点速查

| 我想 | 改哪里 |
|---|---|
| 让 agent 一上来就能 `ls` 看到我的数据 | `entities/` + `resources/` 目录 + `SOLUTION_DIRS` 环境变量 |
| 替换 TypeORM skill 来源（从 JSON / API / 别的 DB） | 实现 `ContentSource` 接口 |
| 给 agent 一个「试错可回滚」的工作流 | `POST /sessions/:id/fs/snapshot` + `/fs/rollback` |
| 存 solution 自己的会话状态（步数、变体、flag） | `GET/PUT /sessions/:id/meta/:key` |

下面每个展开。

---

## 1. Seed 自己的数据进 session

**问题**：solution 想让 agent 默认就能看到一组业务数据 / 参考资料，不让 agent 自己去 download。

**做法**：在 solution 目录下建两个特殊子目录：

```
solutions/business/<你的 slug>/
├── entities/      ← 业务数据
│   ├── customers/...md
│   └── plans/...json
└── resources/     ← 参考材料（glossary、playbooks 等）
    ├── glossary.md
    └── data-dictionary.json
```

启动 ccaas backend 时把目录注册到 `SOLUTION_DIRS`：

```bash
SOLUTION_DIRS=<你的 slug>:$PWD/solutions/business/<你的 slug> \
  WORKSPACE_PROVIDER=agentfs \
  ... \
  npm run start:prod -w @kedge-agentic/backend
```

后端启动后看到：
```
[SessionAssetMaterializer] Session asset materializer active for 1 tenant(s): <你的 slug>
```

之后该租户每创建一个新 session，`SessionAssetMaterializer` 都会把这两个目录的内容拷到 session 的 workspace 根。Agent 起来就能 `ls entities/`。

**安全护栏**（自动）：500 文件上限、单文件 1MB、总 10MB、拒绝 symbolic link。详见 `packages/backend/src/sessions/services/session-asset-materializer.service.ts`。

**Skill 怎么告诉 agent 去看这些**：在 SKILL.md 写明 "entities/ 下有 X 内容；resources/ 下有 Y" 即可。看 [demo-sandbox 的 SKILL.md](../examples/demo-sandbox.md) 范例。

---

## 2. 写自己的 `ContentSource`（替换 TypeORM 作为 skill 来源）

**问题**：默认 ccaas backend 把 skill 存在它自己的 TypeORM SQLite 里。你可能想从纯 JSON 文件 / 外部 API / 自己的 DB 加载。

**做法**：实现 `@kedge-agentic/agent-runtime` 的 `ContentSource` 接口（**只有 2 个方法**）：

```ts
// my-content-source.ts
import { readFileSync } from 'node:fs';
import type {
  ContentSource, SkillContent, McpServerContent,
} from '@kedge-agentic/agent-runtime';

export class JsonFileContentSource implements ContentSource {
  constructor(private jsonPath: string) {}

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

把这个替换默认的 TypeORM 适配器（修改 backend 的 `sessions.module.ts` factory）：

```ts
// 把 TypeOrmSkillContentSource 换成你的
import { JsonFileContentSource } from './my-content-source';

providers: [
  { provide: JsonFileContentSource, useValue: new JsonFileContentSource('/data/skills.json') },
  {
    provide: BaseMaterializer,
    useFactory: (src: JsonFileContentSource, cfg: ConfigService) => {
      const baseDir = cfg.get('workspace.agentfs.baseDir') || ...;
      return new BaseMaterializer(src, baseDir, new NestLoggerAdapter('BaseMaterializer'));
    },
    inject: [JsonFileContentSource, ConfigService],
  },
],
```

测试：用 `InMemoryContentSource`：

```ts
import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';

const src = new InMemoryContentSource([/* fixtures */]);
// + 你的 adapter 测试用 jest mock + InMemoryContentSource compare
```

详细 API + 写 adapter 的注意事项：`reference/agent-runtime.md`。

---

## 3. Snapshot / rollback 包住「危险」步骤

**问题**：multi-turn 工作流里，agent 某一步可能 mess up 大量文件。失败后想回到那一步之前的状态，不想从头跑。

**做法**：在 solution 后端（或前端）的工作流逻辑里包住关键 turn。

```ts
// solution backend 的某个 controller
async function executeRiskyStep(sessionId: string) {
  const ccaas = process.env.CCAAS_URL;
  const apiKey = process.env.CCAAS_API_KEY;
  const tenant = 'my-solution';
  const HDR = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-tenant-id': tenant,
  };

  // 1. checkpoint
  const label = `pre-risk-${Date.now()}`;
  await fetch(`${ccaas}/api/v1/sessions/${sessionId}/fs/snapshot`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ label }),
  });

  try {
    // 2. 让 agent 跑那个高风险 prompt（这里假设你有个 helper）
    await runAgentTurn(sessionId, 'try the experimental refactor');

    // 3. 验证产出。失败就抛
    const ok = await validate(sessionId);
    if (!ok) throw new Error('validation failed');

  } catch (err) {
    // 4. rollback
    await fetch(`${ccaas}/api/v1/sessions/${sessionId}/fs/rollback`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });
    throw err;
  }
}
```

**注意**：
- session 必须 `status === 'idle'` 时才能 snapshot/rollback —— 否则 409。**包 turn 而不是包 mid-stream**。
- snapshot 走的是 daemon-cycle（停-cp-启），~300ms 阻塞。轻量但不是免费。
- label 字符集：`^[\w.-]{1,64}$`，没空格没 `/`。
- 需要 `WORKSPACE_PROVIDER=agentfs`，否则 400。

完整 endpoint spec：`reference/runtime-api.md` § FS endpoints。

---

## 4. Session metadata KV — 存 solution 自己的状态

**问题**：solution 想存「当前用户走到第几步」、「这个会话用的是 A 还是 B 实验组」、「上一次成功的 checkpoint label」… 这些数据。要不要往 entities/ 里写文件？不要 —— 那是给 agent 看的。

**做法**：用每 session 内置的 KV API（**所有 provider 都有，不仅 agentfs**）：

```bash
# solution 启动一个 multi-step 工作流时
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' \
  -d '{"value":{"current":1,"total":7,"experimentVariant":"B"}}'

# 每步完成后递增
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  ... -d '{"value":{"current":2,"total":7,"experimentVariant":"B"}}'

# 前端 / 别的 service poll
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT"
# → { "key": "workflow.step", "value": {...}, "updatedAt": "..." }
```

**Caps**：64KB / value，256KB / session。**Caps 是硬性的** —— 不要把大 blob 塞 KV。大数据该走 entities/ + agent 读。

**为什么是 backend 自己的 SQLite 不是 agentfs KV**：
- agentfs KV 在 FUSE daemon 锁住的 SQLite delta 里，外部读要 cp 一份，麻烦
- backend 自己的 SQLite 跨 session lifecycle 还活着（你可以查"上次实验组"，即使 session 关了）
- provider 无关：local 也能用

详见 `reference/runtime-api.md` § Metadata KV endpoints + [[sandbox-mount-vs-sdk]] 设计决策。

---

## 一些可能的组合用法

**A/B 实验 + 沙箱**：
1. 用 KV 记录 session 拿到的实验组（A/B）
2. session 一开始就用 KV 决定要不要给 agent 看某个 entity（solution 控制 SessionAssetMaterializer 之外，自己额外往 session dir 里写文件）
3. 每个关键决策点 snapshot + 记录到 KV
4. 实验失败 rollback

**Workflow checkpoint UI**：
1. solution 前端每次 agent 完成一步，把 step + 当前 snapshot label 存 KV
2. UI 显示「步骤历史」可以让用户点回任意 step
3. 点回 = `POST /fs/rollback` + 把 KV 的 step 回滚

**Multi-tenant 安全沙箱**：
1. 每租户单独的 SOLUTION_DIRS entry，entities/ 隔离
2. session 之间互不可见（agentfs delta 是 per-session 的）
3. 同租户多 session 共享 base overlay（skills），不共享 delta

---

## 不要做的事

- ❌ 不要在 solution 里直接读写 `${WORKSPACE_DIR}/sessions/<id>/`。session lifecycle 应该是 backend 的事；你应该用 REST API。
- ❌ 不要绕 `SessionAssetMaterializer` 直接 cp 文件到 session dir —— 大小上限和安全检查都丢了。
- ❌ 不要把 `__ccaas_*` 当作自己 MCP server 的名字。这是 ccaas 保留前缀；冲突会被 ccaas 内部那个覆盖。
- ❌ 不要 mid-turn 调 snapshot/rollback —— 会 409 + 实际上即使强制做也会 EIO 掉 agent 的文件句柄。
- ❌ KV 里不要塞超过 1KB 的 value，更别 base64 大文件。要存大数据 → entities/。

---

## See also

- `platform/runtime-architecture.md` — 这些扩展点在整个层级里的位置
- `reference/runtime-api.md` — REST endpoint 完整 spec
- `reference/agent-runtime.md` — ContentSource port 详细
- `examples/demo-sandbox.md` — 一个用到几乎所有扩展点的完整 case
