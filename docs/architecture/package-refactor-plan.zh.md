# 包重构计划

> [package-layering.zh.md](./package-layering.zh.md) 的姊妹文档。分析识别了三个不一致;本文档把具体重构动作排好序,结构镜像 [`docs/ontology/kedge-ontology-implementation-plan.md`](../ontology/kedge-ontology-implementation-plan.md)。
>
> 英文原版:[package-refactor-plan.md](./package-refactor-plan.md)。
>
> **独立性**:本重构与 ontology rollout 正交。任一工作流可以先发;两者互不门控。

---

## 1. 背景 — 为什么要做这件事,为什么现在做

包数量从一小撮(2024)增长到 15 个(2026 年中)。沿途累积了三个结构性不一致(见 [分层分析 §3](./package-layering.zh.md#3-三个不一致按严重度排序)):

1. **HIGH**:3 个包(`context-layer`、`harness`、`observer-engine`)暴露 NestJS 绑定但没 `-nest` 后缀,强迫每个传递性消费者拉进 NestJS。
2. **MEDIUM**:`ArtifactEditor`(agent-runtime)和 `DocumentEditProvider`(context-layer)实现同样的 `EditOperation` 形状但没有共同基础契约。
3. **LOW**:包名(`backend` / `agent-runtime` / `ontology`)暗示虚假的高度并行性。

待建的 `@kedge-agentic/ontology` 包即将落地。在它发布*之前*明文化分层约定,是最便宜、杠杆最高的步骤 — 确保新包从一开始就遵循规则。

**结果目标**:
- 约定明文化且机械可执行(未来通过 architecture test)。
- `context-layer` 拆为无框架核心 + `-nest` 绑定;传递性消费者不再为了用 `EntityRegistry` 而付 NestJS 安装代价。
- `harness` 和 `observer-engine` 疣点被框定为后续跟进,不会被遗忘。
- `EditOperation` 双胞胎问题通过明确决定(文档化)解决,而不是悬而未决。

---

## 2. 四阶段重构

每个阶段都可作为一个 PR 独立发布。每个都有明确的回滚故事。没有一个阻塞 ontology rollout。

### Phase 1 — 明文化约定(纯文档)

**范围:**

- 在 [`docs/CONVENTIONS.md`](../CONVENTIONS.md) 加 "Package layering" 子节,引用 [分层分析 §2](./package-layering.zh.md#2-我们应该明确承诺的架构约定) 的规则:
  > 工作区包的主入口(`src/index.ts`)必须无框架依赖,或者包名必须带框架后缀(`-react`、`-vue`、`-nest`)。
- 更新 root [`CLAUDE.md`](../../CLAUDE.md) 的 Package Overview 表,加一个 "Framework coupling" 列。每行一个词(`none` / `NestJS` / `React` / `Vue` / 等) — 让约定在最常被读到的文档里可见。
- 在 [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) 加 "See also" 交叉链接到分层分析文档。新约定扩展 ADR-0001 的精简核心原则到更广的包集合。
- 在 [`docs/ontology/kedge-ontology-design.md`](../ontology/kedge-ontology-design.md) §1.5 加一行指针到分层分析,解释为什么 ontology 包是无框架的。

**范围外**:任何代码变更。任何包改名。任何包拆分。

**退出标准:**

- `docs/CONVENTIONS.md` "Package layering" 节存在,≤1 页。
- Root CLAUDE.md 表的 "Framework coupling" 列对所有 15 个包填好。
- 交叉链接全部解析(逐个 path-check)。
- `git diff packages/ solutions/` 为空(源代码未触碰)。

**风险**:零。纯文档。

**回滚**:revert 这个 PR;消费者无影响。

**代价**:1 个 PR,~1 小时工作。应该先落地。

---

### Phase 2 — 把 `@kedge-agentic/context-layer` 拆为 core + `-nest`

最大的真实修复。为最高杠杆包解决 [不一致 #1](./package-layering.zh.md#31-不一致-1--基础包里的-nestjs-耦合high-严重度)。

**范围:**

从当前的一个包中分出两个包:

- **`@kedge-agentic/context-layer-core`**(新,无框架):
  - `src/core/entity-registry.ts` — `EntityRegistry` 类
  - `src/core/document-edit-provider.ts` — `DocumentEditProvider` 抽象基类
  - `src/core/interfaces.ts` — `EntityContextProvider`、`EditOperation`、`EditResult`、`AtReference`、`EntityContext`、`ReferenceableOptions`、`RelationInfo`,所有 response/recommend 类型
  - `package.json`:`dependencies: { "@kedge-agentic/entity-document": "^0.1.0" }`,无 peerDeps,源码中没有 NestJS imports。

- **`@kedge-agentic/context-layer-nest`**(新,NestJS 绑定):
  - `src/context-layer.module.ts` — `ContextLayerModule.forRoot()`
  - `src/decorators/referenceable.decorator.ts` — `@Referenceable`
  - `src/decorators/tracked.decorator.ts` — `@Tracked`
  - `src/controllers/context-layer.controller.ts` — 7 个 REST endpoints
  - `src/services/*` — `ActivityEmitter`、`RecommendEngine`、`ContextInjector`、`ShortcutManager`、`RelationInferrer`
  - `package.json`:`dependencies: { "@kedge-agentic/context-layer-core": "^0.1.0" }`,`peerDependencies: { "@nestjs/common", "@nestjs/core", "class-validator", "class-transformer", "reflect-metadata" }`。

- **弃用策略**:`@kedge-agentic/context-layer`(旧包)成为薄重导出包,保留一个 minor 版本,然后移除。它的 `src/index.ts` 变成:
  ```ts
  // Deprecated — 在 v0.2.0 拆分为 context-layer-core + context-layer-nest。v0.3.0 移除。
  export * from '@kedge-agentic/context-layer-core';
  export * from '@kedge-agentic/context-layer-nest';
  ```
  消费者可以从容迁移 import 路径。

**消费者影响:**

- `packages/backend/` — 通过审计确认:不 import `context-layer`。零变更。
- `packages/context-layer-react/` — import `context-layer`。更新为 `context-layer-core`(它只消费无框架类型)。
- `solutions/business/recipe-book/` — 主要测试消费者。更新:`import` 路径从 `@kedge-agentic/context-layer` → `@kedge-agentic/context-layer-core`(对于 `EntityRegistry`、`DocumentEditProvider`)和 `@kedge-agentic/context-layer-nest`(对于 `ContextLayerModule`、`@Referenceable`)。估计 ~10-15 个 import 行变更。
- `solutions/business/live-lesson/` — 验证是否直接 import context-layer(根据审计可能没有)还是通过 context-layer-react 传递性 import(有)。如果有直接 imports,处理方式同 recipe-book。

**范围外:**

- 重构任何类的内部逻辑。纯文件移动 + 包元数据变更。
- 触碰 `context-layer-react` 超出 import 路径更新。
- 任何对 context-layer 外部契约的变更(接口保持完全相同)。

**退出标准:**

- repo 根的 `npm test` 通过。
- recipe-book 测试套件通过(它是 parity 基准)。
- live-lesson backend `npm test` 通过;live-lesson e2e(15 specs)通过。
- repo 根的 `npm run typecheck` 通过。
- `@kedge-agentic/context-layer-core/package.json` 的 `dependencies` 或 `peerDependencies` 中没有 NestJS 条目。
- `@kedge-agentic/context-layer-core/src/**/*.ts` 没有 `@nestjs/*` imports(grep 可验证)。
- `@kedge-agentic/context-layer` 的弃用重导出包装在一个 minor 版本内仍然工作(用旧 import 路径的消费者看到弃用警告但不破坏)。

**风险**:中等。触碰共享包,至少有 2 个已知消费者。缓解:
- **Parity 快照**:移动前,快照 recipe-book 的 `EntityRegistry.getEntityTypes()` 输出;断言移动后字节相等。
- **单 PR 原子性**:拆分 + 消费者更新在一个 PR;要么全绿,要么一起回滚。
- **弃用包装争取时间**:任何被遗忘的消费者可以继续工作直到 v0.3.0。

**回滚**:revert PR。重导出包装意味着即使我们半路回滚,消费者也不会破坏 — 他们继续用旧 import 路径就行。

**代价**:1 个 PR,中等量(~300 LOC 在包之间移动,~10-15 个 import 更新)。包含验证 1-2 天工作。

**状态备注**:本阶段的退出标准匹配分层分析的验证 §7 — "重构计划 Phase 2 有 parity test"。Parity 快照是可验证的退出标准,不是 aspirational。

---

### Phase 3 — 决定并处理 `EditOperation` 双胞胎问题(轻接触)

解决 [不一致 #2](./package-layering.zh.md#32-不一致-2--两个不相关的editor抽象medium-严重度)。两个选项;推荐轻的那个。

**推荐选项 — A(纯文档)**

**范围:**

在 `docs/CONVENTIONS.md` 加子节(在 Phase 1 加的 Package layering 节里),标题 "Editor abstractions are intentionally per-altitude"。正文:

> codebase 有两个 editor 抽象:`ArtifactEditor<T>`(在 `@kedge-agentic/agent-runtime`,artifact 级,内存)和 `DocumentEditProvider`(在 `@kedge-agentic/context-layer-core`,entity 级,load-edit-save)。它们共享 `EditOperation` 区分联合形状但*不*多态 — 它们在不同抽象高度操作。
>
> 如果你需要第三个 editor,评估它属于哪个高度:
> - **Artifact 级**(你有一个内存中的对象/文档,想对它应用 ops)→ 实现 `ArtifactEditor<T>`。
> - **Entity 级**(你有一个 ID,想 load+edit+save 往返)→ 扩展 `DocumentEditProvider`。
>
> 不要在没有重新评估这个决定的情况下引入第三个兄弟抽象;editor 抽象的扩散正是本约定要阻止的失败模式。

**范围外**:任何代码变更。任何共享基础接口。

**退出标准:**

- 子节加到 CONVENTIONS.md。
- 搜索 design docs 里的 "editor" 找到这条指南。

**风险**:零。纯文档。

**回滚**:revert。

**代价**:1 个 PR,~30 分钟,可以折进 Phase 1 的 PR。

**备选 — Option B(统一,重接触)** — *不推荐,除非有第三个 editor 在路上*:

引入 `@kedge-agentic/edit-protocol`(新的小包)带 `EditOperation` 联合 + `Editor<T>` 接口。重构 `JsonEditProvider` 和 `DocumentEditProvider` 都声明 `implements Editor<T>`。两个已有 editor 保留其内部逻辑;只是类型层关系改变。

现在拒绝这个选项,因为:没有第三个 editor 在地平线上;已有两个 editor 用各自抽象愉快地活了几个月;引入新共享包增加 review/version-bump 负担,收益边际化。

**promotion 标准**:如果有第三个 editor 被提议设计,重新评估 Option B。不要预先建抽象。

---

### Phase 4 — 推迟:`agent-runtime` 改名

解决 [不一致 #3](./package-layering.zh.md#33-不一致-3--包名暗示虚假的并行性low-严重度只是-cosmetic)。推荐行动:**不要做**;通过 README 清晰度缓解即可。

**为什么推迟:**

- 包名仅在 `packages/backend/` 就出现在 20+ 文件(根据审计)。
- 还在 gitbook(`docs/gitbook/zh/platform/runtime-architecture.md`)、root CLAUDE.md、ADR-0001 邻近文本、消费者的 package.json 文件中引用。
- 改名是机械的(find/replace),但 high-touch。
- 收益纯 cosmetic — 名字实际上不破坏任何东西。

**缓解措施**(在 Phase 1 的 PR 里做):

在 `packages/agent-runtime/README.md` 顶部加一段 "Scope" 节(如果还没有),明确:

> `@kedge-agentic/agent-runtime` 是*文件系统和产物同步层*。它不是一个通用 "agent runtime" — 它不跑 agent、不管 session、不桥接 MCP server。它提供 `BaseMaterializer`(把 DB 存的 skill 投射到 workspace overlay)和 `SyncEngine`(agent 写文件 vs Solution 拥有数据之间的确定性双向同步)。Session 生命周期见 `packages/backend/src/sessions/`;agent 进程本身见 `packages/backend/src/chat/`。

**代价**:~10 分钟,折进 Phase 1 的 PR。

**何时重开改名问题**:如果未来引入的包又叫某种 "runtime",歧义会开始咬人。那时改名值得它的代价。

---

## 3. Breaking-change 清单

| Phase | 下游何处破坏 | 需要的动作 |
|---|---|---|
| 1 | 无 — 纯文档 | 无 |
| 2 | `@kedge-agentic/context-layer` 弃用;消费者应迁移 import 到 `-core` 和 `-nest`。旧包保留一个 minor 版本仍工作。 | 从容迁移 import 路径;v0.2.0 到 v0.3.0 期间能看到弃用警告 |
| 3 | 无 — 纯文档(推荐 Option A) | 无 |
| 4 | 不适用 — 推迟 | 不适用 |

**所有阶段零硬破坏性变更。** Phase 2 引入一个弃用,消费者可以按自己节奏迁移。

---

## 4. 测试策略

### Phase 1(文档)

- 人工 review:约定读起来可执行;交叉链接解析。

### Phase 2(context-layer 拆分)

- **Parity 快照**:拆分前,跑 recipe-book backend 测试;捕获 `EntityRegistry.getEntityTypes()` 输出为 JSON;断言拆分后字节相等。
- **构建完整性**:repo 根的 `npm run build:libs` 完成;`@kedge-agentic/context-layer-core` + `@kedge-agentic/context-layer-nest` 都发出 `.d.ts`。
- **Recipe-book end-to-end**:完整测试套件通过(这是主要的消费者端测试)。
- **Live-lesson end-to-end**:`solutions/business/live-lesson/e2e/specs/` 里 15 个 specs 通过。
- **类型纯度测试**:`grep -rE "from '@nestjs" packages/context-layer-core/src/` 返回零匹配。
- **弃用包装测试**:一个合成测试从 `@kedge-agentic/context-layer`(旧路径)import;类型正确解析到新包的导出。

### Phase 3(文档)

- 人工 review:子节落地且可从包 README 发现。

### Phase 4(推迟 — 暂不需要测试计划)

---

## 5. Sequencing 备注

### 5.1 PR 形态

- **Phase 1**:1 个 PR,纯文档。~1 小时工作,可以当天落地。
- **Phase 2**:1 个 PR,拆分 + 所有消费者更新原子化。1-2 天工作。Phase 1 之后落地。
- **Phase 3**:折进 Phase 1 的 PR(它是 CONVENTIONS.md 增补;同一目标文件)。
- **Phase 4**:无限期推迟;README 澄清折进 Phase 1 的 PR。

### 5.2 依赖顺序

```
Phase 1 (约定 + READMEs + 交叉链接)
   │  [无阻塞]
   │
   ├──> Phase 2 (context-layer 拆分)
   │       [概念上依赖 Phase 1;Phase 1 的约定是 Phase 2 实现的]
   │
   ├──> [跟进项,暂未规划]
   │       harness + observer-engine 审计:
   │       (a) 审计类级别耦合 — 这些像 context-layer(混杂)
   │           还是从头到尾耦合框架(只需改名)?
   │       (b) 执行:改名为 `-nest` 或像 context-layer 那样拆分。
   │       本计划范围外,但标记出来。
   │
   └──> Ontology rollout (见 docs/ontology/kedge-ontology-implementation-plan.md)
           [独立 — 可以在 Phase 2 之前、之后或并行发布]
```

### 5.3 每阶段回滚故事

- **Phase 1**:revert PR。消费者无影响。
- **Phase 2**:revert PR。`@kedge-agentic/context-layer` 的弃用包装意味着仍在旧 import 路径上的消费者即使我们半路回滚也继续工作。
- **Phase 3**:revert PR。消费者无影响。

### 5.4 刻意推迟的事

- **改名 `agent-runtime` → `workspace-sync`**:见 Phase 4。Cosmetic;代价超过收益。
- **审计 + 拆分 `harness` 和 `observer-engine`**:已知它们和 `context-layer` 共享同样的模式。消费者面影响较低(传递性 footprint 较小)。定标为单独跟进项。
- **引入 `@kedge-agentic/edit-protocol`**:只有第三个 editor 出现时(Phase 3 Option B)。
- **Architecture-test linting**:约定是机械可测的,但 lint 规则本身是单独的工作项。可以住在新的 `packages/architecture-tests/` 或折进现有 harness checks。
- **把 `context-layer` 改名为 `context-layer-core` 作为*主*名字**(vs 保留弃用重导出)。推迟到 v0.3.0 弃用期满。或者,更长期看,无限期保留重导出以便向后兼容。

---

## 6. 每阶段发布前的操作 checklist

按 [`CLAUDE.md`](../../CLAUDE.md) 的 post-implementation checklist:

1. **测试**:Phase 1 — 无测试(纯文档);Phase 2 — `cd packages/context-layer-core && npm test` + `cd packages/context-layer-nest && npm test` + recipe-book 测试套件 + live-lesson e2e。
2. **Code review**:diff 里每个文件跑 `code-reviewer` agent(Phase 2 必须;Phase 1/3 trivial)。
3. **Harness**:`bash scripts/harness-checks.sh`。
4. **Architecture 规则验证**(Phase 2 专门):grep `packages/context-layer-core/src/` 里的 `@nestjs` imports;必须返回零。这是断言拆分真的达成了无框架性的关键检查。

---

## 7. 开放实现问题

非阻塞;构建期间解决:

1. **`@kedge-agentic/context-layer` 弃用包装应该在 import 时警告吗?** 选项:(a) 静默重导出(摩擦最低);(b) dev 时 `console.warn`(可见提醒);(c) 仅 compile-time deprecation 注释(TS 在 IDE 里显示删除线)。建议:(c) — IDE 删除线足够推动迁移而无运行时噪音。

2. **未来的 architecture-test 住哪里?** 选项:(a) 新的 `packages/architecture-tests/` 工作区包;(b) 折进 `bash scripts/harness-checks.sh`;(c) 作为 CI-only check 在 `.github/workflows/`。建议:暂时(b)(无新包开销),如果测试面增长就提升到 (a)。

3. **Phase 2 版本号**:`@kedge-agentic/context-layer-core` 起步是 `0.1.0`(全新)还是 `0.2.0`(继承现有 context-layer 版本线)?建议:`0.2.0` — 拆分是演化,不是全新起步。这也向消费者传达 "0.2.0" 是各处的拆分后版本。

---

> **维护者备注**:这个计划是 [package-layering.zh.md](./package-layering.zh.md) 的可执行伴侣。当某个 phase 发布,在本文档对应小节标记 "✓ shipped in PR #N",并更新[分层分析](./package-layering.zh.md) §3 不一致表里的已解决状态。Phase 2 之后的 phase 是条件性的或推迟的;通过编辑本文档来重开,而不是开新计划。
