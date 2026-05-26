# 第 8 章：为你的 Solution 加入沙箱能力（进阶）

在前 7 章里，你设计、实现并部署了 Lesson Plan Designer。它能跑、能用。但这是个**裸 host** 的 Solution —— AI Agent 跑的是 host bash、能读 host 上任意文件（虽然有 NestJS 的 RBAC 拦着）。

本章带你把 Solution 升级到 **stage-1 sandbox** 形态：

- AI Agent 的文件视角隔离在每会话独立的 agentfs 挂载里
- AI Agent 的 bash 走 just-bash MCP 解释器，跑不到 host
- 教师上传的「参考教材库」自动 seed 到每个会话，agent 用 `ls / grep / cat` 浏览
- 通过 snapshot / rollback 让教师在「试 3 个不同教案草稿」之间安全切换
- 通过 metadata KV 记录会话工作流状态

你应该已经熟悉了**生产部署**（第 7 章）。本章是可选的进阶，不影响 Solution 本身的基本功能 —— 但如果你的用户场景里包含「让 AI 操作多个文件 / 安全试错 / 隔离不同教师的数据」之一，加上沙箱会显著降低你的运营复杂度。

## 前置条件

- 已完成第 1-7 章
- 已读过 [Runtime 架构](../platform/runtime-architecture.md)（10 分钟）
- 准备阅读 [Solution 用 runtime 新能力（扩展点指南）](../guide/extending-runtime.md)作为本章的「配方册」

{% hint style="info" %}
**本章和 `guide/extending-runtime.md` 的分工**：那个 guide 是 4 个扩展点的**独立配方**，可单独读。本章是**端到端的工作流**：从 Lesson Plan Designer 这个具体 Solution 出发，一步步告诉你怎么把沙箱套上去。两份文档刻意不重复 —— 这里讲「怎么改你的 Solution」，那里讲「每个 API 怎么用」。
{% endhint %}

## 8.1 决定要不要加沙箱

加上沙箱**不是免费的**：

| 加上沙箱有什么代价 | 加上沙箱解决什么问题 |
|---|---|
| 部署时多装 `agentfs` binary | AI 文件操作不再泄漏到 host 文件系统 |
| macOS NFS / Linux FUSE 平台代码 | AI 的 bash 命令不能 `rm -rf` 错误目录 |
| 每个 session 多 ~50-300ms mount 启动 | 多教师场景下，每教师的会话天然隔离 |
| Snapshot 调用阻塞 ~300ms | 可以「让 AI 试 3 个草稿，挑一个，其他作废」 |

**触发条件**（满足其一就建议加）：

1. **多租户**：多个教师共享一份 Solution 后端，你不想让教师 A 的会话能读到教师 B 的资源
2. **敏感数据 seed**：你希望 AI 看到的参考教材是你 seed 进去的，不是 AI 自己随便去 host 上找的
3. **可回滚的多草稿工作流**：教师让 AI 生成 5 个教案草稿，挑 1 个，其余作废
4. **审计需求**：你要回答「AI 在那次会话里到底改了哪些文件」这种问题

如果你的 Solution 是单租户 + 只让 AI 读固定模板 + 没有「试错」工作流，**可以跳过本章**。

## 8.2 启用 agentfs（部署侧）

这一步是「不动你的 Solution 代码，只改部署配置」。

**装 agentfs**（macOS dev 机）：

```bash
# 我们的 fork（含 NFS fix），从 monorepo 根目录
bash packages/vfs-poc/scripts/build-agentfs-fix.sh
```

Linux：见 [本地自托管](../getting-started/local-self-host.md) 的 prereq 表。

**重启 ccaas backend，加 4 个 env**：

```bash
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  WORKSPACE_BASH_SANDBOX=just-bash \
  SOLUTION_DIRS=lesson-plan-designer:$PWD/solutions/lesson-plan-designer \
  npm run start:prod -w @kedge-agentic/backend
```

启动日志验证 4 行：

```
[BaseMaterializer]            materialized N skills (X files) + Y mcp servers → ...
[SandboxService]              Bash sandbox mode: just-bash (server: ...)
[AgentfsWorkspaceProvider]    agentfs binary OK: agentfs <sha>
[SessionAssetMaterializer]    Session asset materializer active for 1 tenant(s): lesson-plan-designer
```

到这里你的 Solution 已经在沙箱里跑了。Agent 仍然能干前面 7 章教的所有事 —— **只是它现在跑在隔离环境里**。

## 8.3 把教材库 seed 进会话

在第 6.3 章你给 MCP server 写了几个 tool，但「参考教材」这种**只读 + 大量**的内容如果走 MCP 就显得冗余。更自然的做法是：把它放到 `entities/` 让 agent 通过 sandboxed `ls / grep / cat` 直接读。

**在你的 Solution 目录下加这两个子目录**：

```
solutions/lesson-plan-designer/
├── solution.json
├── frontend/
├── backend/
├── mcp-server/
├── skills/
├── entities/                       ← 新增
│   ├── textbooks/
│   │   ├── grade-5-math.md
│   │   ├── grade-5-chinese.md
│   │   └── ...
│   └── lesson-templates/
│       ├── inquiry-based.md
│       └── direct-instruction.md
└── resources/                      ← 新增
    ├── curriculum-standards/
    │   ├── grade-5-math-standards.md
    │   └── ...
    └── pedagogy-glossary.md
```

`SOLUTION_DIRS` 环境变量已经在 8.2 设过了，所以 ccaas backend 启动时就会看到这两个目录。

**验证**：创一个新会话，进它的 workspace 目录：

```bash
ls /tmp/<workspace-dir>/sessions/<session-id>/
# entities/  resources/  .claude/

ls /tmp/<workspace-dir>/sessions/<session-id>/entities/textbooks/
# grade-5-math.md  grade-5-chinese.md  ...
```

后端日志：
```
[SessionAssetMaterializer] Materialized session assets for lesson-plan-designer → ... (copied=12, ...)
```

**容量护栏**（你不用配，默认就有）：500 文件 / 单文件 1MB / 总 10MB / 拒绝符号链接。

如果你的教材库超过 10MB，要么拆分到多个会话模板（按学科分租户），要么改走另外的 storage（如对象存储）+ MCP tool。

## 8.4 让 SKILL 适应沙箱

第 6.4 章你已经写过 `lesson-plan-designer.md` skill。现在加几段文字让 agent 知道它在沙箱里 + 知道去哪儿读教材：

```markdown
# Lesson Plan Designer Agent

你是一个备课助手。教师通过表单告诉你他们要为「<grade>-<subject>」准备一节什么主题的课。
你的任务是生成教学目标、活动设计和评估方案，通过 write_output 协议写回前端。

## 沙箱环境约定

你运行在一个**沙箱**里：
- 你的 `Bash` 工具已禁用。要执行 shell 命令必须用 `mcp____ccaas_bash__bash`
- 你的文件视角是会话独立的；你看到的 `entities/` 和 `resources/` 是 Solution 给你 seed 的

## 可读资料

- `entities/textbooks/<grade>-<subject>.md` — 教材正文（你要先 cat 对应那本）
- `entities/lesson-templates/*.md` — 教学法模板（探究式 / 直接讲授等）
- `resources/curriculum-standards/<grade>-<subject>-standards.md` — 课标
- `resources/pedagogy-glossary.md` — 教学法术语解释

## 工作流程

1. 用 `mcp____ccaas_bash__bash` 跑 `ls entities/textbooks/` 确认教材存在
2. `cat` 教师指定的那本教材对应章节
3. 参考课标 `cat resources/curriculum-standards/...`，确保目标对齐
4. 挑一个教学法模板（如果教师没指定，问一下）
5. 用 `write_output` 调用 MCP 工具把教案数据写回前端表单

## 输出规则

- 教学目标必须**可观察、可测量**
- 每个活动必须标注预估时间和教学法属性
- 不要把教材内容大段抄进教案 —— 引用即可
```

**渐进式披露**（如果 skill 内容长）：把模板/示例拆到 `skills/lesson-plan-designer/{tools,examples}/`，主 SKILL.md 只放 60 行入口 + 「需要 X 时去 cat tools/X.md」的指令。看 [demo-sandbox 案例](../examples/demo-sandbox.md)的 SKILL.md 是怎么做的。

## 8.5 （可选）DocumentEditProvider —— 让 agent 双向编辑教案

到 8.4 为止，agent 通过 `write_output` MCP 工具把数据写回前端表单。这够大多数场景用。

但如果你有「教师让 AI 直接修改某个**已保存的教案**的某一段」这种需求，更自然的是给 Solution backend 加一个继承 `DocumentEditProvider` 的 controller：

```ts
// solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plan.provider.ts
import { Injectable } from '@nestjs/common';
import { DocumentEditProvider } from '@kedge-agentic/context-layer/core';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';

@Injectable()
export class LessonPlanProvider extends DocumentEditProvider {
  async loadEntity(id: string) {
    // 从你的 DB / 文件读
  }
  async saveEntity(id: string, updates: any) {
    // 写回 DB
  }
  toEntityDocument(entity: any): EntityDocument {
    // 把教案转成 entity-document 的 block 模型
  }
  getEditableFields(): Set<string> {
    return new Set(['title', 'objectives', 'activities']);
  }
  getContentToAttrConfig(): ContentToAttrConfig {
    return {};
  }
}
```

然后暴露一个 controller：

```ts
@Controller('api/lesson-plans/:id')
export class LessonPlanController {
  constructor(private provider: LessonPlanProvider) {}

  @Get()  serialize(@Param('id') id: string) {
    return this.provider.serialize(id, 'system');
  }
  @Put()  async edit(@Param('id') id: string, @Body() body: { ops: EditOperation[] }) {
    return this.provider.edit(id, body.ops, 'system');
  }
}
```

然后在 SKILL.md 里告诉 agent：「要编辑某个教案，用 `curl -X PUT http://host.docker.internal:<your-port>/api/lesson-plans/<id> -d '<ops>'`」。

完整的 demo 范例：[demo-sandbox case study](../examples/demo-sandbox.md)（虽然主题是 B2B SaaS，DocumentEditProvider 的用法完全照搬）。

## 8.6 （可选）Snapshot/rollback —— 多草稿试错工作流

教师让 AI 生成 5 个备课方案，挑 1 个。如何不让 5 个方案互相污染？

```ts
// solutions/lesson-plan-designer/backend/src/draft-orchestrator.service.ts
async function generateAndSelectDraft(sessionId: string, prompt: string) {
  const CCAAS = process.env.CCAAS_URL!;
  const KEY = process.env.CCAAS_API_KEY!;
  const HDR = {
    'Content-Type': 'application/json',
    'x-api-key': KEY,
    'x-solution-id': 'lesson-plan-designer',
  };
  const drafts: Array<{ label: string; content: string }> = [];

  for (let i = 1; i <= 5; i++) {
    // 1. 在每次草稿前 checkpoint
    const label = `draft-${i}-pre`;
    await fetch(`${CCAAS}/api/v1/sessions/${sessionId}/fs/snapshot`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });

    // 2. 让 agent 生成一个草稿
    await runAgentTurn(sessionId, `${prompt} (尝试方式 ${i})`);

    // 3. 捞出 agent 写的草稿内容
    drafts.push({ label, content: await fetchGeneratedDraft(sessionId) });

    // 4. 回到 checkpoint，准备下一轮
    await fetch(`${CCAAS}/api/v1/sessions/${sessionId}/fs/rollback`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });
  }

  return drafts;  // 教师挑一个，其余丢弃
}
```

**约束**：
- session 必须 `status === 'idle'` 才能 snapshot/rollback —— **包 turn 不包 mid-stream**
- snapshot 大约阻塞 300ms（停 daemon → cp → 起 daemon）
- label 必须匹配 `^[\w.-]{1,64}$`，没空格没 `/`

完整的 endpoint spec：[Runtime REST API](../reference/runtime-api.md) § FS endpoints。

## 8.7 （可选）Metadata KV —— 跟踪 Solution 自己的状态

「这个会话用的是 A 教学法还是 B 教学法？」、「教师挑了哪个草稿？」、「当前 wizard 走到第几步？」 —— 这些**不是文件**，是 Solution 自己的会话级状态。

不要写到 entities/（那是给 agent 看的）。用 metadata KV：

```bash
# Solution 后端记录用户选择
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/wizard.step" \
  -H "x-api-key: $KEY" -H "x-solution-id: lesson-plan-designer" \
  -H 'Content-Type: application/json' \
  -d '{"value":{"current":3,"total":7,"selectedTemplate":"inquiry-based"}}'

# 前端定期 poll 来更新进度条
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/wizard.step" ...
# → { "key": "wizard.step", "value": {"current":3,...}, "updatedAt": "..." }
```

**上限**：64KB / value，256KB / session。**别塞大 blob** —— 大数据走 entities/。

不需要 agentfs 也能用：**所有 provider 都有这个 API**。

## 8.8 测试你的沙箱设置

四个验证点，按顺序跑：

### 8.8.1 启动验证

```bash
# 重启 ccaas backend（带 8.2 的 env）
WORKSPACE_PROVIDER=agentfs ... npm run start:prod -w @kedge-agentic/backend

# 检查 4 行日志（前面 8.2 列过）
```

### 8.8.2 会话创建验证

```bash
# 创一个 session
curl -X POST http://localhost:3001/api/v1/sessions/test-1/messages \
  -H 'x-api-key: ...' -H 'x-solution-id: lesson-plan-designer' \
  -H 'Content-Type: application/json' \
  -d '{"templateName":"lesson-design","message":"先 ls entities/"}'

# 检查 workspace dir
ls /tmp/<WORKSPACE_DIR>/sessions/test-1/
# 应该看到 entities/  resources/  .claude/
```

### 8.8.3 Agent 走沙箱 bash 验证

```bash
# 看 sandbox bash 日志
tail -f /tmp/<WORKSPACE_DIR>/_sandbox_logs/bash-mcp.log
# 当 agent 跑 ls / cat 时，每条命令都在这里出现：
# 2026-XX-XX [test-1] exec cwd=/ cmd=ls entities/textbooks/
# 2026-XX-XX [test-1] exec done exit=0
```

### 8.8.4 Snapshot/rollback 验证

```bash
# 当 session 在 idle 状态
curl -X POST http://localhost:3001/api/v1/sessions/test-1/fs/snapshot \
  -H 'x-api-key: ...' -H 'x-solution-id: lesson-plan-designer' \
  -H 'Content-Type: application/json' -d '{"label":"checkpoint-1"}'
# → 200 { "label": "checkpoint-1", "takenAt": "..." }

curl -X POST http://localhost:3001/api/v1/sessions/test-1/fs/rollback \
  ... -d '{"label":"checkpoint-1"}'
# → 204
```

## 8.9 常见坑

1. **会话关了就拿不到 fs/diff** —— sessions 从内存 Map 删除后 endpoint 返回 404。在 session 还活着的时候查询。
2. **Snapshot mid-turn 报 409** —— **设计如此**。包 turn 边界，不包 mid-stream。Cycling the mount 会 yank agent 的文件 handle 出 EIO。
3. **`agentfs` binary 不在 PATH** —— 设 `WORKSPACE_AGENTFS_BIN` 绝对路径。
4. **SOLUTION_DIRS 写错 slug** —— 用 `solution.slug`（你 solution.json 里那个），不是 solutionId UUID。
5. **`entities/` 超过 10MB 触发 cap** —— 看日志 `Skipping ... cap reached`。要么瘦身，要么改对象存储 + MCP tool。
6. **agent 用 `Bash` 而不是 MCP bash** —— claude CLI 太老（要 ≥ 2.1.x）或 `--disallowed-tools` flag 没注入。检查 spawn 命令日志。
7. **`.claude/` 等系统文件出现在 fs/diff 输出里** —— 这是预期的（session 启动时 skill-sync 写了那些文件）。不是 bug。
8. **多个 solution 注册同一 slug** —— 后注册的覆盖前一个。slug 必须唯一。

## 8.10 复习：你现在拥有什么

完成本章后，你的 Lesson Plan Designer：

✅ AI agent 在每会话独立的 agentfs 挂载里跑 —— 任意 host fs 操作被隔离
✅ AI agent 的 bash 走 just-bash MCP —— 不能逃逸到 host shell
✅ 教师上传的教材 / 课标 / 教学法模板自动 seed 到每个会话
✅ 你的 SKILL.md 知道沙箱约定，引导 agent 正确使用
✅（可选）有结构化编辑教案的 REST API
✅（可选）能让 agent 试多个草稿、挑一个、回滚其他
✅（可选）跟踪 wizard 进度 / 用户选择等 Solution 状态

部署上，这套和第 7 章的部署清单**完全兼容** —— 你只是在 ccaas backend 的 env 里加了几个变量，没动 frontend / backend / mcp-server / skills 的代码结构。

## 下一步

- **学透扩展点**：[Solution 用 runtime 新能力（扩展点指南）](../guide/extending-runtime.md) —— 4 个扩展点的独立配方册
- **看完整 case**：[demo-sandbox（sandbox 全套能力案例）](../examples/demo-sandbox.md) —— 一个把 8.5-8.7 全用上的端到端示例
- **REST API 完整 spec**：[Runtime REST API](../reference/runtime-api.md)
- **跳到底层**：[Runtime 架构](../platform/runtime-architecture.md) —— 这一切是怎么运作的

## 练习

把你在第 6 章构建的 Lesson Plan Designer 改造一遍：

1. 加 `entities/textbooks/` + `resources/curriculum-standards/`，至少 3 本教材 + 1 套课标
2. 改 SKILL.md 让 agent 用 sandboxed bash 浏览这些资料
3. 实现 8.6 的「多草稿 → 挑一个」工作流，加到你的前端 wizard 里
4. 用 metadata KV 记录用户当前选的教学法

完成后对照 [demo-sandbox 源码](https://github.com/nnabuuu/ccaas/tree/master/solutions/business/demo-sandbox) 检查你的结构。
