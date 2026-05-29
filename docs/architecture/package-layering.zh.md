# 包分层 — 实证审计与约定

> `packages/` 下 15 个包实际分层关系的权威分析文档。姊妹文档:[package-refactor-plan.zh.md](./package-refactor-plan.zh.md) — 从本分析推导出的具体重构动作。
>
> 英文原版:[package-layering.md](./package-layering.md)。
>
> **为什么需要这份文档**:包数量从 2024 年的几个基础包扩张到 2026 年中期的 15 个,沿途抽象高度逐渐漂移,缺乏统一规则。现在有 3 个包暴露了 NestJS 绑定却没有在包名中标识。新的 `@kedge-agentic/ontology` 包(在 `docs/ontology/` 中已设计)即将落地,这是一个合适的时机来明确分层规则,以便它从一开始就遵循。
>
> **读者**:维护包布局的工程师 + 评审新包的人。

---

## 1. 实证分层清单

`packages/` 下存在 15 个包。它们实际的框架耦合度,通过 `package.json` 的 `dependencies` + `peerDependencies` 推导:

### 1.1 基础层 — 无框架依赖的契约 + 机制

这些是所有消费者都会触碰的包。§2 提出的约定对这一层最严格适用。

| 包 | 版本 | Deps | PeerDeps | 耦合判定 | 主要职责 |
|---|---|---|---|---|---|
| `@kedge-agentic/common` | 0.2.0 | `zod`, `uuid` | 无 | **无** | 共享类型 + Zod 事件 schema |
| `@kedge-agentic/entity-document` | 0.1.0 | 无 | 无 | **无(零依赖)** | Markdown ↔ block 文档转换 |
| `@kedge-agentic/agent-runtime` | 0.4.0 | 无 | 无 | **无(零依赖)** | 文件系统/产物同步机制 |
| `@kedge-agentic/ontology` *(待建)* | (未实现) | `zod`, `zod-to-json-schema` | 无 | **无(已设计)** | Schema + 治理契约层 |
| `@kedge-agentic/context-layer` | 0.1.0 | `entity-document` | **`@nestjs/common`, `@nestjs/core`, class-validator, class-transformer, reflect-metadata** | ⚠ **主入口耦合 NestJS** | Entity 注册表 + @Picker 后端 + NestJS Module |

那个疣点:`context-layer` 在同一个 `src/index.ts` 里既导出无框架的 `EntityRegistry` / `EntityContextProvider` / `DocumentEditProvider` 接口,*又*导出 NestJS Module / 装饰器 / controllers。任何想要消费接口的人也会通过传递性把 NestJS 拉进自己的依赖图。详见 §3-#1。

### 1.2 框架绑定包 — 显式后缀(良好模式)

这些包名字明示其做什么:把无框架的核心绑定到某个具体框架。后缀是约定的一部分。

| 包 | 版本 | PeerDeps | 包装 | 备注 |
|---|---|---|---|---|
| `@kedge-agentic/context-layer-react` | 0.1.0 | `context-layer`, `react`, `react-dom` | context-layer | ✓ "如何拆分"的参考样例 |
| `@kedge-agentic/react-sdk` | 0.2.0 | `react`, `@tanstack/react-query` | (HTTP 客户端,不是包装) | ccaas backend 的 React hooks |
| `@kedge-agentic/vue-sdk` | 0.3.0 | `vue` | (HTTP 客户端) | Vue composables |
| `@kedge-agentic/chat-interface` | 0.2.0 | `react`, `react-markdown`, `lucide-react` | (UI 库) | 可扩展的 chat UI 组件 |

`-react`/`-sdk` 后缀传达的意思是"我耦合到了具体框架;只有当你也在这个框架里时才消费我"。这个约定已经存在;只是没有被一致地应用(见 §3)。

### 1.3 没有 `-nest` 后缀但耦合 NestJS 的包 — 更广的疣点

`context-layer` 不孤单。另两个包同样 peerDepend 了 NestJS 但没在包名中标识:

| 包 | 版本 | NestJS peerDeps | 与 context-layer 同样的问题? |
|---|---|---|---|
| `@kedge-agentic/harness` | 0.1.0 | `@nestjs/common`, `@nestjs/core`, `@nestjs/swagger` | **是** — "Harness orchestration framework for iterative agent tasks" |
| `@kedge-agentic/observer-engine` | 0.1.0 | `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm` | **是** — "Event/Observer engine: dispatch events, execute handlers" |

两个都比 context-layer 小(消费者面影响更低),但都违反同样的提议约定。重构计划首先处理 context-layer(杠杆最高),把这两个包标记为后续跟进。

### 1.4 应用 + 实验性 + 非工作区包

| 包 | 耦合 | 备注 |
|---|---|---|
| `@kedge-agentic/backend` | NestJS 应用 | 它*就是*那个 NestJS 服务。名字诚实。 |
| `@kedge-agentic/admin-next` | React + Refine + Radix UI | Admin 仪表板应用 |
| `@kedge-agentic/exercise-preview` | 几乎无(1 个依赖) | "练习类型插件的预览平台 — CLI 沙箱、Admin Playground" |
| `@kedge-agentic/vfs-poc` | 零依赖 | **明确是归档**:package.json 描述写了"Design + validation archive… 生产代码在 `packages/backend/src/sessions/{workspace,sandbox}/`"。作为历史参考保留。 |
| `packages/mcp/` (文件夹) | 不适用 — 不是工作区包 | 包含 4 个独立的 MCP-server 子进程(`attach-file-server`, `rest-adapter-bridge`, `shared-context-server`, `tool-caller-proxy-server`) — 每个有自己的 package.json。被 backend 当作子进程启动。 |

这些是叶子节点 — 它们消费基础层,但没有别的东西传递性消费它们。分层规则仍然适用于它们的结构,但它们对依赖图的影响较小。

---

## 2. 我们应该明确承诺的架构约定

> ### 约定
>
> **工作区包的主入口(`src/index.ts`)必须无框架依赖,或者包名必须带框架后缀(`-react`、`-vue`、`-nest`)。**

为什么这条规则重要,三个理由:

1. **跨进程可移植性**:Agent 进程(由 backend 启动的 Claude Code、OpenCode 子进程)消费基础包里的 schema、类型、契约。通过传递性 peerDep 把 NestJS 拉进 agent 子进程是 50 MB+ 安装包的代价,而完全没有收益 — agent 并不跑在 NestJS 里。

2. **不需要框架启动就能测试**:无框架的包可以毫秒级单元测试;耦合 NestJS 的包需要 DI 容器设置、模块编译、生命周期接线。两者混在一个包里强迫所有测试都付框架代价。

3. **诚实命名**:当消费者写 `import { EntityRegistry } from '@kedge-agentic/context-layer'` 时,他们合理期待"这是一个我可以到处用的注册表"。在运行时发现拉进这个名字传递性地需要 `reflect-metadata`/`class-transformer`,是一次信任损耗事件。后缀让约束在 import 处就可见。

**这条规则是可测试的。** 未来的 `packages/architecture-tests/` 包(或现有 harness)可以 lint 每个工作区包的 `package.json`,断言:任何在 `dependencies` 或 `peerDependencies` 中带 NestJS/React/Vue 的包必须有匹配的后缀。约定是机械可执行的,不只是 aspirational。

**先例**:`@kedge-agentic/context-layer-react` 已经遵循这条规则。React 绑定加入时做了拆分;NestJS 绑定也应该做同样的回溯拆分。

**引用脉络**:这个约定扩展了 [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) 的精简核心原则。ADR-0001 说"core backend 必须只承载基础设施,不要业务实体"。本约定说"基础包必须无框架依赖,不要框架锁定"。同样的精神,不同的范围。

---

## 3. 三个不一致,按严重度排序

### 3.1 不一致 #1 — 基础包里的 NestJS 耦合(HIGH 严重度)

**问题**:`context-layer`、`harness`、`observer-engine` 都 peerDepend 了 `@nestjs/common` + `@nestjs/core`,但包名里没有框架后缀。它们的 `src/index.ts` 在同一个 import 路径下同时导出无框架抽象和 NestJS 专属绑定(Module / 装饰器 / controllers)。

**为什么 High 严重度:**

- 它会复利。每个依赖这三个之一的新包都继承 NestJS 耦合。`context-layer-react` 已经付了这个代价(React 应用为了用 picker 传递性拉进 NestJS)。未来的 `context-layer-vue` 也会。
- 它让基础层不统一。读包列表的工程师必须记住"无框架,除了这三个" — 这种豁免规则下一个贡献者就会破坏。
- 修复是机械的且有充分先例(`-react` 后缀已存在)。拖延让最终的拆分越来越大。

**具体影响:**

- `context-layer` 的 `EntityRegistry` 概念上是无框架的(已审计:类本身没有 NestJS imports) — 但消费者拿不到它,除非也拉进 NestJS 依赖图。
- `harness` 和 `observer-engine` *可能*是从头到尾耦合 NestJS(未在类级别审计),那种情况下修复就是给它们加 `-nest` 后缀;或者它们可能也像 context-layer 一样混杂多个层级,那种情况下需要完全拆分。重构计划 Phase 2 范围是 context-layer;harness/observer-engine 单独定标。

### 3.2 不一致 #2 — 两个不相关的"editor"抽象(MEDIUM 严重度)

**问题**:两个包定义了"编辑某个东西"的抽象,词汇重叠但没有共同基础契约:

- `@kedge-agentic/agent-runtime` 导出 `ArtifactEditor<T>` — artifact 级、内存中的编辑,`JsonEditProvider` 是具体实现。Edit ops:`field_set`、`json_patch`、`replace`。
- `@kedge-agentic/context-layer` 导出 `DocumentEditProvider` — entity 级、load-edit-save、抽象基类。Edit ops:`field_set`、`str_replace`。通过 `entity-document` 的 block 序列化实现。

两者都实现一个 `EditOperation` 区分联合(有重叠 case)。两者都不实现 `Editor<T>` 接口,让通用消费者可以多态处理它们。

**为什么 Medium(不是 High):**

- 它们共存了几个月,没有可观察到的伤害。差距是概念上的,不是操作上的。
- 用例确实不同 — `ArtifactEditor` 操作内存中从文件解析出的 JSON;`DocumentEditProvider` 操作数据库中的 entity 行通过 Markdown 往返。强制共享基类有"为统一而统一"的尴尬风险。
- 不过:假想的"schema editor"或"config editor"可以属于任一桶。没有共同契约,每个新 editor 选择两条路之一,分歧加深。

**两条路径,轻 vs 重** — 重构计划推荐轻的那条(文档化分歧;不强行统一),除非有第三个 editor 在路上。详见重构计划 Phase 3。

### 3.3 不一致 #3 — 包名暗示虚假的并行性(LOW 严重度,只是 cosmetic)

**问题**:当用户把布局描述为"ccaas-core(agent 执行)、ontology(业务建模)、agent-runtime(运行时)" — 这三个名字*听起来*是并行的 — 实际包却处在完全不同的高度:

- `backend`(用户口中的 "ccaas-core")是一个 NestJS 应用,不是"核心抽象层"。它拥有请求生命周期、HTTP 路由、TypeORM 适配器、进程管理。
- `agent-runtime` 特指*文件系统同步*层(根据它的零依赖 + sync-engine 范围)。它在任何更广义上都不是"那个运行时" — 它不跑 agent、不管 session、不桥接 MCP。
- `ontology`(待建)是一个 schema + 治理契约层。

这些名字制造出"核心 / 业务建模 / 运行时"三个对等层级的盒子的心智图。现实更像:

```
backend (NestJS 应用 + 集成适配器)
   使用 → agent-runtime (文件系统同步机制)
   使用 → ontology (schema 契约)                  [待建]
   不使用 → context-layer (solution 端 picker 基础设施)
```

`backend` 消费其它包;其它包不互相通信。命名不揭示这种层级关系。

**为什么 Low**:名字内部是诚实的 — `agent-runtime` 读完 README 后能准确描述其内容。这种不匹配只在第一次接触时咬一口。让 `agent-runtime/README.md` 在第一段就把范围讲明白,足以缓解。

**为什么不应该重命名**:这个包在 `backend/` 单独就被 20+ 文件引用,加上 gitbook、加上 root CLAUDE.md、加上 ADR。重命名会触碰其中每一个。代价是机械的但高;收益是 cosmetic。重构计划无限期推迟它。

---

## 4. 理想状态的包图

重构计划 Phase 1+2 落地后(约定明文化、context-layer 拆分),基础层看起来是:

```
共享契约 (无框架)
├── @kedge-agentic/common              types + Zod 事件 schema
├── @kedge-agentic/entity-document     document block 转换
├── @kedge-agentic/agent-runtime       文件系统同步机制
├── @kedge-agentic/ontology            schema + 治理契约          [新]
└── @kedge-agentic/context-layer-core  entity 注册表 + edit providers [改名/拆分]

框架绑定 (后缀标记)
├── @kedge-agentic/context-layer-react React Picker UI
├── @kedge-agentic/context-layer-nest  NestJS Module + 装饰器 + controllers [新]
├── @kedge-agentic/react-sdk           backend 的 React hooks
├── @kedge-agentic/vue-sdk             backend 的 Vue composables
└── @kedge-agentic/chat-interface      React chat UI 库

耦合 NestJS (后缀待修,跟进项)
├── @kedge-agentic/harness             → 可能改名为 harness-nest
└── @kedge-agentic/observer-engine     → 可能改名为 observer-engine-nest

应用 + 实验性
├── @kedge-agentic/backend             NestJS 服务
├── @kedge-agentic/admin-next          React admin 仪表板
├── @kedge-agentic/exercise-preview    预览平台
└── @kedge-agentic/vfs-poc             归档(保留历史)

非工作区
└── packages/mcp/*                     4 个独立 MCP-server 子进程
```

区分层级的规则是机械的:共享契约包零(或仅 zod)依赖;框架绑定包名字带框架后缀;应用是叶子。

---

## 5. 我们刻意*不*改动的事项

明确写下非目标可以在规划阶段抓住范围蔓延。下列内容*不*在本分析或姊妹重构计划的处理范围内:

1. **`@kedge-agentic/backend` 不会被改名或拆分。** 它是一个 NestJS 应用,持有请求生命周期、TypeORM 适配器、集成胶水代码。名字准确反映其内容。

2. **`@kedge-agentic/entity-document` 的范围不会被扩大。** 它做 document 转换;它应该只做这件事。"两个 editor 抽象"的不一致(§3.2)*不*导致"把 `DocumentEditProvider` 移入 `entity-document`"的建议。

3. **待建的 `@kedge-agentic/ontology` 设计(在 `docs/ontology/`)保持不变。** 它已经遵循约定(设计为无框架)。把它接入 NestJS 的桥接代码住在 `packages/backend/src/ontology/`,镜像 `packages/backend/src/sessions/agent-runtime/` 怎么把 agent-runtime 接入 NestJS。那个模式当下就是对的。

4. **`@kedge-agentic/vfs-poc` 保持归档状态。** 它的 `package.json` 描述明说生产代码在别处。移除这个包会丢失设计历史;保留是对的。

5. **`solutions/business/*` 下的 solution 不会被触碰。** Solution backend 按 ADR-0001 拥有自己的架构。这里的建议是关于 `packages/` 的,不是 solutions。

6. **`mcp/` 子进程不会被重新打包成工作区包。** 它们以独立可执行文件部署;workspace 不需要在依赖层面知道它们。

7. **不重命名 `agent-runtime`**(根据 §3.3)。代价收益不合算;README 澄清是合适的修复。

---

## 6. 与待建 ontology rollout 的关系

5-phase ontology rollout(见 `docs/ontology/kedge-ontology-implementation-plan.md`)与从本分析推导出的重构计划**互不依赖**。具体说:

- Ontology Phase 1(bootstrap `@kedge-agentic/ontology` v0.1)不触碰 context-layer。
- Ontology Phase 2(refactor `context-layer` 消费 ontology)*会*触碰 context-layer — 但是作为代码内部变更,不是包拆分变更。它可以在重构计划 Phase 2(context-layer 拆分)之前、之后或并行运行。
- Ontology Phase 3+4+5 受 Chengdu PoC / Solution 需求 / promotion criteria 门控;它们完全不依赖包拆分。

如果两条工作流都落地,context-layer 最终会有两者:内部重构(消费 ontology 原语)+ 包拆分(分离 NestJS 绑定)。这两件事各自可回滚。

架构重构计划的 Phase 1(明文化约定)理想情况下应在 ontology Phase 1 **之前**落地,这样新包从一开始就遵循规则 — 但即使 ontology Phase 1 先发,也无伤大雅;设计已经符合规则。

---

## 7. 留给维护者的开放问题

本分析浮现的没有单一正确答案的问题:

1. **`harness` 和 `observer-engine` 应该做类级别审计判断混杂高度,还是直接改名为 `-nest`?** 只改名很便宜,但如果包是从头到尾耦合 NestJS,改名只是诚实标签,没有修复任何实际耦合问题。完全拆分(像 context-layer 那样)工作量大,但产出无框架的核心,供其它代码消费。建议:决定前先审计。默认只改名,除非审计发现可抽取的无框架抽象。

2. **`exercise-preview` 实际上是基础包、应用、还是别的?** 它的 1 个 dep、0 peerDep 形象暗示是基础包;它的描述("练习类型插件的预览平台 — CLI 沙箱、Admin Playground、public demo")暗示是应用。标签影响它是否需要遵循 §2 约定。建议:问包负责人。

3. **`packages/mcp/` 应该在 `packages/` 下吗?** 它包含可执行子进程,不是工作区包。其它仓库用顶级 `services/` 或 `bin/` 目录处理这种情况。建议:暂保持现状(低影响),但文档化约定,让未来贡献者知道哪个文件夹放什么。

4. **§3.2 的 editor 双胞胎问题。** 选轻接触(文档化分歧)还是重接触(通过共享基类统一)。重构计划推荐轻接触;第三个 editor 出现时重新评估。

---

> **维护者备注**:这份文档是分层约定的真源。新加包没有 `-react`/`-vue`/`-nest` 后缀的,其主入口必须无框架。定期审计:`grep -l '@nestjs\|react\|vue' packages/*/package.json`;任何无后缀包出现命中,就是重构或改名的候选。
