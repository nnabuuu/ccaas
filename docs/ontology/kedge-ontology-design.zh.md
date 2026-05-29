# kedge-ontology — 基础设施设计 Spec

> `@kedge-agentic/ontology` 包的权威 spec。伴侣文档:[kedge-ontology-implementation-plan.zh.md](./kedge-ontology-implementation-plan.zh.md) · [kedge-ontology-gap-analysis.zh.md](./kedge-ontology-gap-analysis.zh.md)。
>
> 英文原版:[kedge-ontology-design.md](./kedge-ontology-design.md)。

---

## 怎么读这份文档

这是 ~200 KB / ~3000 行的 spec。它是**双读者面向**:前半(§1.0、§1.4、§8.6、§12)回答*为什么这件事重要,怎么跟人讲* — 可读给非技术 stakeholders、客户、决策者。其余(§2–§11)定义这个包 — 给实现或评审 schema 层的工程师读。可以顶到底读,但大多数读者不需要每个章节。

**挑你的路径:**

| 如果你是… | 按顺序读这些章节 | 时长 |
|---|---|---|
| **非技术** (决定这件事是否重要、跟同事解释、写 pitch) | §1.0 *(市场定位)* → §1.4 *(看到 vs 做到 — 心智模型)* → §8.6 *(before/after 对比表)* → §12 *(FAQ)* | ~15 分钟 |
| **工程师** (实现包或评审设计) | §0 *(术语表)* → §1 *(完整背景)* → §2 *(结构)* → §3–§5 *(原语)* → §6–§7 *(registry + projection)* → §9 *(设计决定)* → §10 *(与现有代码的协调,**关键**)* | ~45 分钟 |
| **Solution 集成者** (写一个 Solution 注册 ObjectTypes + ManifestDef) | §1.4 *(心智模型)* → §3.6 *(worked ObjectType examples)* → §4.7 *(worked ManifestDef)* → §8 *(端到端使用)* → §10 *(到 ToolCallerProxy 的桥)* → §11 *(projection formats)* → [impl plan](./kedge-ontology-implementation-plan.zh.md) | ~30 分钟 |
| **审计员 / Compliance** (治理实际是什么样) | §0 *(术语表)* → §1.4 *("同一张地图"原则)* → §3.3 *(ActionDef + preconditions + auditLevel)* → §3.1 *(PropertyMeta.classification + redaction)* → §4.4 *(AccessBoundary)* → §8.5 *(一次治理调用的端到端 trace)* → §10.3 *(role mapping)* | ~25 分钟 |
| **你只有 5 分钟** | §1.4 *(心智模型)* + §8.6 before/after 表。两页。其余暂时跳过。 | ~5 分钟 |

**全文使用的阅读约定:**

- TypeScript 代码块是权威的接口签名 — 如果散文与代码不一致,信代码。
- **Tier 1 / Tier 2 / Tier 3** 注释引用 [gap analysis](./kedge-ontology-gap-analysis.zh.md) 的 tiers;三个都 merged 进本 spec。
- 章节交叉引用如 (§5.5) 总是指*本*文档。对其他文档的引用用完整文件名写明。
- 以 `packages/`、`solutions/` 或 `docs/` 开头的文件路径是相对仓库根的绝对路径。
- 中文术语(即见、课堂会话)是平台内部产品名时不翻译;一次性翻译给在 inline。

**如果有不清楚的**,[§12 的 FAQ](#12-faq) 收集了产生本 spec 的设计讨论中冒出的问题;假设文档错之前先查那里。

> ### ⚠ 状态:SPEC vs IMPLEMENTATION
>
> **本文档中每个原语都已 SPEC-merged。截至撰写本 spec 的提交,没有任何一个已 IMPLEMENTED** — 磁盘上还没有 `@kedge-agentic/ontology` 包。读 spec 给你*设计契约*;读 [`kedge-ontology-implementation-plan.zh.md`](./kedge-ontology-implementation-plan.zh.md) 告诉你*当前在跑什么*。
>
> Impl plan 是 5 阶段构建:
>
> 1. **Phase 1** — bootstrap 包,带核心原语 + Tier 1(FunctionDef、ActionDef.preconditions、LocalizedString)。
> 2. **Phase 2** — 重构 `context-layer` 消费该包(recipe-book 是测试消费者)。
> 3. **Phase 3** — live-lesson adoption + `ToolCallerProxy` bridge。**门控于:成都教育局 PoC 先上线。**
> 4. **Phase 4** — Tier 2 原语实现(`InterfaceDef`、`ObjectSetDef`、predicate-scoped `AccessBoundary`)。**门控于:真实 Solution 需求。**
> 5. **Phase 5** — Tier 3 原语实现,**per-item 按其单独 promotion criterion** 门控,来自 [gap analysis](./kedge-ontology-gap-analysis.zh.md#tier-3---✓-merged-into-design-spec-2026-05-29)。一些 Tier 3 原语可能永远不发 — 那是门控成功应用,不是错过的 feature。
>
> 当你在本文档中看到 "Tier N (merged)"(如 §0 术语表 footer、§10.1 reconciliation 表、§12 FAQ),意指 **SPEC-merged**。实现状态按上述阶段映射各有不同。
>
> 如果你今天在 solution 代码调 `defineObjectSet({...})` 收到 "module not found",那是正确行为 — Phase 1 还没发,Phase 4 更没。Gap analysis 解释*什么会触发*每个 Tier 2/3 原语的实现。

---

## 0. 术语表 — 全文你会见到的词

跨本文档和更广仓库的词汇短参考。大多数词来自 Palantir 式 ontology 语言或现有 kedge-ccaas 平台。

| 术语 | 含义 |
|---|---|
| **kedge-ccaas / 即见 (Jijian)** | 本包发布到的 "Claude Code as a Service" 平台。NestJS backend(`packages/backend`)+ 几个前端 + `solutions/` 下每个 domain 的 solution backends。 |
| **Solution** | 在平台上构建的自包含产品。每个 Solution 有自己的 `solution.json` manifest、自己的 backend(端口 ≠ 3001)、自己的数据库。示例:`live-lesson`(教育产品)、`demo-sandbox`(B2B SaaS demo)、`recipe-book`(@Picker/context-layer 接线的参照实现)。 |
| **Solution backend** | 一个 Solution 拥有的 NestJS service。Domain entities 住这里(按 ADR-0001)。Live-lesson 的 backend 在端口 3007;core ccaas backend 在 3001。 |
| **Session** | 一次终端用户与 agent 之间的对话。在 core 中持久化(`packages/backend/src/sessions/`)。带 `solutionId`、可选 `actingUserId`、一个 workspace。 |
| **Workspace** | agent 操作的 per-session 文件系统。Provider 可插拔(`local` 或 `agentfs`)。见 [gitbook → Runtime 架构](../gitbook/zh/platform/runtime-architecture.md)。 |
| **Skill** | 可复用的 agent-behavior 捆绑(system prompt、可用 tools、触发规则)。每个 Solution 在 boot 时通过 `npm run skill:import` 注册。 |
| **MCP server** | agent 可调用的 tool 面。两种风味:stdio(进程内子进程)和 rest-adapter。在 `solution.json` → `mcpServers` 中声明。 |
| **ToolCallerProxy** | 每次 solution-scoped tool call 走的 6 步 pipeline(sanitize / Zod-validate / permission / context-inject / dispatch / audit)。住在 `packages/backend/src/tool-caller/`。由 ambient 身份绑定,从不 agent-asserted。 |
| **`ExecutionContext`** | 每次 tool call 上平台断言的身份信封:`{ solutionId, sessionId, actingUserId?, actingRole?, apiKeyId?, effectiveScope? }`。从 agent 角度只读。 |
| **`@Picker` / "At-picker"** | 前端 reference 选择 UI:用户输入 `@`,看到可插入对象。今天住在 `packages/context-layer-react/src/AtPicker.tsx`,由 `EntityRegistry` 支撑。 |
| **EntityRegistry** | 今天 pickable 类型的内存中 registry(`packages/context-layer/src/core/entity-registry.ts`)。最接近待建 `OntologyRegistry` 的现有原语。 |
| **`ReferenceableOptions`** | 今天的 per-type 注册形状(icon、search/browse 能力、relations)。最接近待建 `ObjectTypeDef.picker` 的现有原语。 |
| **`EntityContextProvider`** | 今天的 per-type 契约 `getContext / search / serialize / edit`。最接近待建 `ManifestAccessor` 的 read/edit 面的现有原语。 |
| **`DocumentEditProvider`** | 今天 entities 往返通过 `entity-document` blocks 的抽象基类。处理 `field_set` 和 `str_replace` 编辑。recipe-book provider 是参照实现。 |
| **`ManifestDef`(本包)** | schema 级的*组合 operational context*:哪些对象在范围内、什么 runtime state 存在、谁可以看/做什么、什么生命周期 hooks 触发。把 live-lesson 里 `Lesson.manifestJson` 已经临时做的事形式化。 |
| **`ObjectTypeDef`(本包)** | 一个 typed 业务对象(LessonPlan、Student、Resource),由 `{ schema: ZodObject, meta?: PropertyMetaMap, links, actions, picker? }` 定义。Zod schema 是形状和 per-field 语义的真源;meta sidecar 携带呈现/治理 hints。 |
| **`PropertyMeta`(本包)** | Per-field sidecar,携带 `searchable`、`displayRole`、`computed`、可选 i18n `displayName` — *只*带 Zod schema 表达不了的。Keys 在编译期受约束于 `keyof z.infer<Schema>`。 |
| **Zod** | 运行时类型验证库,作为 kedge-ontology 字段形状、类型、约束、per-field semantic 文本(通过 `.describe('...')`)的真源。仓库先例:`live-lesson/backend/src/schemas/manifest.schema.ts`、`creator-mcp-server/src/schemas.ts`、`ToolCallerProxy.argsSchema: ZodTypeAny`。 |
| **`ActionDef`(本包)** | 治理的操作:typed params、声明的 side effects、允许的 roles、audit 级别。注册时编译到一个注册给 `SolutionToolkitRegistry` 的 `ToolDefinition`,使 `ToolCallerProxy` 强制它。 |
| **`AccessBoundary`(本包)** | 一个 manifest 内 per-role 的什么可读 / 可写 / 可操作 / 可订阅声明。通过 §10.3 映射到现有 `UserRole` + `ApiKeyScope`。 |
| **`semantic` 字段** | 每个声明它的原语携带的自然语言描述。LLM 读 `semantic` 文本以推理意义。必填 — 空字符串注册失败。 |
| **Palantir Ontology** | Palantir Foundry 的 operational 层(Object Types、Links、Actions)。本设计的概念祖先;差别见 §1.4。 |
| **OSDK** | Palantir 的 "Ontology SDK" — 生成的 typed 客户端库。我们*不*建一个;schema 通过 REST endpoint 在运行时暴露(见 §9.6)。 |
| **ADR-0001** | "Core backend 不得包含 domain entities" — 把所有具体 `ObjectTypeDef` 实例推进 solution backends、而不是本包的架构约束。 |

> **姊妹文档**:[kedge-ontology-gap-analysis.zh.md](./kedge-ontology-gap-analysis.zh.md) — 本 spec 相对 Palantir Ontology *有意*尚未包含的内容,按 Tier 1–4 组织。
>
> 下面所有 "merged" 注释指 **SPEC-merged**(在本文件中已设计和文档化)。实现状态在 [kedge-ontology-implementation-plan.zh.md](./kedge-ontology-implementation-plan.zh.md);见上面的 ⚠ 状态 callout。
>
> **Tier 1 (SPEC-merged → Phase 1 实现)**:`FunctionDef`(§3.7)、`ActionDef.preconditions`(§3.3)、`LocalizedString` displayName(§3.0)。
> **Tier 2 (SPEC-merged → Phase 4 实现,门控于真实 Solution 需求)**:`InterfaceDef`(§3.8)、`ObjectSetDef`(§3.9)、predicate-scoped `AccessBoundary` + `BoundaryPredicate` sub-language(§4.4 + §5.5)。
> **Tier 3 (SPEC-merged → Phase 5 实现,per-item 门控于单独 promotion criterion)**:`ValidationRuleMeta`(§3.10)、`StateMachineDef`(§3.11)、`PropertyMeta.classification` + `.redaction`(§3.1)、`NotificationRule`(§4.8)、`ActionDef.returnType` + `ActionResult.returnValue`(§3.3 + §5.3)。
> **Tier 4**(lineage、schema branching、set 版本化、datasource binding、MDM、geo/time-series types、Workshop、自定义类型系统):明确非目标;重开需要 ADR。
>
> 如果你在审计设计面,两份文档一起读。

---

## 1. 背景:我们在哪、为什么这件事重要

### 1.0 为什么这是无人涉足的领域

在深入平台 context(§1.1)和原语(§3+)之前,值得先确立:`kedge-ontology` 在尝试的事 — 把 Palantir 式 operational Ontology(semantic + kinetic + governance,集成在一起)应用到教育 — 没有直接先例。我们做了调研;这是全貌。

**全球范围:**

- **Palantir 自己不做教育。** 核心客户是国防、情报、供应链、医疗、能源。我们能找到的唯一教育相关案例是乌克兰教育部 2024 年与 Palantir 签约,为学校防空避难所的资金分配建模、以及为流离失所儿童的远程学习联网 — 公共部门资源分配,不是教育的核心 entities(课程、知识点、学习状态、教学策略)。美国教育部用 Palantir 做外国资金报告门户 — 同样是行政数据管理。
- **没有学术论文**(在我们所查)把 Palantir 的 Ontology 范式作为框架来分析或设计教育系统。文献把教育中的知识图谱视为描述性 semantic 结构,不是 operational 层。

**在中国:**

- 教育信息化中重度使用"知识图谱" — 建模学科、概念、定理、知识点、学习能力维度、学情、考情、自适应学习路径推荐。
- **这一切都停留在传统 semantic 层** — 描述性、静态、检索导向。没有人把*action* 和*治理*提升为教育数据模型内的一等公民。

**为什么有这个 gap:**

1. **Palantir 的商业射程不包括教育。** Foundry 部署面向能付企业级费率且有数据基础设施集成的客户。中国教育局买家画像都不是。
2. **教育的核心 entities 不是物理资产。** 工厂有机器、产品、运输 — 身份稳定且操作清晰的对象。教室有"知识点"、"认知状态"、"教学策略"、"学习行为" — 定义带理论负载的 entities(constructivism vs behaviorism vs cognitivism 对同一节课产生根本不同的 ontologies)。给 `Student` 建 `ObjectTypeDef` 容易;给 `MisconceptionSignal` 建一个是方法论承诺。
3. **Kinetic 层在教育中特别有价值但没人建过。** 学情数据作为静态报告没用 — 它需要*驱动行动*(推送针对性习题、调整节奏、触发干预)*在治理下*(权限、审计、合规,尤其在受监管教育市场)。这正是 Palantir 式 Ontology 提供的,但 Palantir 没把它指向教育,教育信息化厂商也没伸手够这个范式。

**底线:** `kedge-ontology` 为教育形式化的东西在理论和实践上都无直接先例。对"为什么没人建过这个?"的传统反应 — "它肯定不值钱" — 在这里是错的。传统理由(无 business case、无问题要解决)不适用;实际理由(Palantir 的 go-to-market、教育实体定义模糊、kinetic 层遗漏)是可移除的障碍,不是低价值的信号。

这是后续技术工作的*市场*正当性。§1 其余部分覆盖*内部* context — 本包接入什么平台、我们当前代码中什么具体 gap 驱动它、什么设计原则指导原语。

### 1.1 即见(Jijian)平台 context

即见是 B2B 客户的 Claude Code as a Service(CcaaS)平台。其核心架构:

- **多租户**:带 organization/workspace 隔离的用户管理。Tenancy slug 是带在每个 cross-cutting 类型上的 `solutionId`(如 `packages/backend/src/tool-caller/types.ts` 中的 `ExecutionContext.solutionId`)。
- **Session Templates**:基于 role 的 agent 配置,定义 AI agents 在特定场景下如何行为。
- **Engine-无关 harness 层**:支持 Claude Code、OpenCode、或自实现的 agentic engines 作为可插拔 backend。
- **三层授权**(实际实现,见 `packages/backend/src/auth/types.ts` 和 `packages/backend/src/users/entities/user-solution.entity.ts`):
  - **API-key scopes**(`ApiKeyScope`):10 个 capability 标志 — `skills:read|write|execute|delete`、`mcp:read|write`、`chat`、`analytics:read`、`builder`、`admin`。Key 前缀是 `sk-`(`API_KEY_PREFIX`),不是之前 aspirational 的 `jj_*` 表记。
  - **Per-tenant role**(`UserRole`):`'admin' | 'developer' | 'viewer'`,记录在 `user_tenants` join 表(`UserSolution` entity),role 层级 `admin > developer > viewer`。
  - **Ambient execution 身份**(`ExecutionContext`):在 session 创建时绑定,从不 agent-writable;携带 `solutionId`、`sessionId`、`actingUserId`、`actingRole`、`apiKeyId`、`effectiveScope`(`'own' | 'subordinate' | 'org' | 'all'` 数据范围 hint — 今天 stub)。
- **Tech stack**:NestJS backend、Vue 3 / React 前端、HTTP Streaming(SSE)用于实时 agent 事件追踪。

第一个大型部署是给成都某区教育局的 PoC,建一个精准教学平台服务 100+ 学校。该平台覆盖完整课堂生命周期:备课、授课、课堂观察、行政监督。

> **权威 auth 引用 — 与本文档并读**
> - `packages/backend/src/auth/types.ts` — `ApiKeyScope`、`ApiKeyMetadata`、`RequestContext`
> - `packages/backend/src/users/entities/user-solution.entity.ts` — `UserRole`
> - `packages/backend/src/tool-caller/types.ts` — `ExecutionContext`、`ToolCallRequest`、`ToolInvocation`
> - `docs/design-tool-caller-proxy.md` — 本包消费的 ambient-身份 契约

### 1.2 @Picker:它是什么、为什么重要

@Picker 是即见的核心交互组件。当用户(老师、agent、admin)正在撰写内容 — 写教案、调整 live lesson、复盘学生数据 — 他们输入 `@` 来引用系统中其它对象。@Picker 负责:

- 展示哪些类型的对象可供引用(resources、curriculum standards、students 等)
- 在某对象类型内搜索和过滤
- 让用户通过关系"下钻"(如,从一个 curriculum standard 到对齐到它的 resources)
- 把所选 reference 解析为可被 agent 消费或嵌入文档的结构化对象

该 Picker v1 已经在 `packages/context-layer-react/src/AtPicker.tsx` 中,由内存中的 `EntityRegistry`(`packages/context-layer/src/core/entity-registry.ts`)支撑,通过 `ReferenceableOptions` 形状(`packages/context-layer/src/core/interfaces.ts`)填充。它今天的局限:

- 类型注册、traversal、search 住在 `context-layer`,与 agent 对世界的视图松耦合(不同形状;不同消费者)。
- `ReferenceableOptions` 上没有一等的 **action** 概念 — actions 只作为 per-type 的 `EntityContextProvider.apply` / `.edit` hooks 存在,不是 discoverable、semantically-described、带治理的操作。
- 没有 **manifest** 概念 — 即,没办法声明"这些对象一起构成一个 operational context 带 state、生命周期、per-role access boundary"。

`kedge-ontology` 是下一层:Picker、Agent、审计层都消费的 schema。

### 1.3 Agent operating boundary 问题

随着平台从"Agent reads and analyzes"走向"Agent reads, reasons, and acts",一个关键 gap 出现。

**今天状态**:当 Agent 在一个 lesson session 内操作,它需要理解教学计划、班级名册、来自课堂观察的实时事件流(由 GLM-4.7-Flash 结构化抽取产生)、以及可用教学 resources。当前,这种 context 是临时组装的 — 每个用例手工接线 agent 能看什么数据、能调什么 tools。

**问题**:每个新 Agent capability(调难度、推荐 resources、标记需关注学生)都要求 bespoke 代码:

1. 把相关对象组装进 Agent 的 context
2. 定义 Agent 能读 vs 能写什么
3. 接线对 API-key scope + per-tenant role 系统的权限检查
4. 给 action 加审计日志

这不可扩展。随着平台从教育扩展到其它垂直(B2B 愿景),per-scenario 接线代价变成不可承受。

**我们需要什么**:声明式地说"在这个 operational context 里,这些对象在范围、这种 state 存在、Agent 可读 X、写 Y、执行 actions Z — 全部由同一个 auth 系统治理"。强制该声明的基础设施今天大体*存在*(就是 `packages/backend/src/tool-caller/tool-caller-proxy.service.ts` 中的 `ToolCallerProxy` 6 步 pipeline);缺的是 proxy 可被告知去强制的 schema。

### 1.4 心智模型:semantic 层 vs kinetic 层 — "看到" vs "做到"

这是本文档中最重要的单个概念。一旦有了它,§3+ 中每个原语都立刻有意义;没它,本包看起来像通用 typed-schema 库,`ObjectTypeDef` 与 `ManifestDef` 之间的区别看起来武断。

> **"看到和做到之间的鸿沟,是大多数数字化项目失败的核心原因。"**
>
> 传统数据集成把散落在各系统的数据汇总到一个仓库,然后出报表和分析。但集成完的数据仍然只是"表和数字" — 你看到"表 A 第 3742 行",不知道它是入院日期还是手术排期。第一个有用的动作是把数据变成*东西*:不是表和字段,而是"病人张伟"、"他的第二次住院"、"3 月 15 日的手术"、"批次 X 的心脏支架" — 以及它们之间的关系。这是 **semantic 层**。许多产品做这个 — 知识图谱、主数据平台、data-mesh 层。
>
> Palantir 的独特动作是大多数产品*不*做的:在 semantic 层之上加一个 kinetic 层。不只是让你看到手术安排在 3 月 15 日,而是让你直接在这张活地图上*改期* — 系统自动检查手术室、医生、设备可用性;满足则执行;记录谁在什么时候做了决定。这个操作是被声明、被治理的业务 action — 带 preconditions、连锁影响、approval 流、审计记录。这是 **kinetic 层**。
>
> 同一张地图给 human 和 AI。你看到的"地图"就是你操作的"地图"。AI Agents 在同一张地图上操作,在同样治理下,留同样审计记录。没有第二个世界让 agent 的 action 发生 — agent 是 operational 系统的参与者,不是带 privileged write access 的旁观者。

#### 为什么这对 AI Agents 尤其重要

只能消费 semantic 层的 Agents 是*更聪明的搜索引擎* — 它们能回答"手术安排是什么?"或"哪些学生 struggling?",但它们不能*改变*任何东西而不掉到系统治理之外:它们调出某个 bespoke handler,handler 通过某个 bespoke API 写,审计日志可能记可能不记。每个 agent capability 变成一次性 integration,每个 integration 都是潜在安全失败。

Kinetic 层把这坍缩为单一契约:agent 的写是声明在 agent 读的同一批 `ObjectType` 上的 `ActionDef`。治理 human 写的同一权限系统治理 agent 写。同一审计日志记录两者。Agent *不能*在契约之外写,因为没有其它路径 — 平台拥有 chokepoint(我们的情况是 `ToolCallerProxy`,§10.5)。

#### 映射到教育

**纯 semantic 层**(中国教育知识图谱今天在做的):系统知道"这是三年级二班的数学课,讲的是《三角形内角和》,王老师在教,班上 42 个学生注册"。Agent 可以查询这些事实,但它与*这具体一堂课*的关系就像读百度百科条目 — 它能看,不能碰。

**加上 kinetic 层**:这堂课停止做条目,变成一个可被进入、感知、操作的运行时 operating context。Agent 能做的事变成一个清晰列举的清单:

- **订阅观察** — 实时事件流(学生举手、教师提问、小组讨论开始)— 不是事后静态报告
- **读 state** — 当前哪个教学阶段、哪个 resource 正在用、过了多长时间
- **写判断** — 标记"这个阶段学生参与度下降"、记录"第 12 分钟出现关键 misconception"
- **触发 actions** — 推送即时练习、建议调整难度、给特定学生发提示

每个操作带治理:Agent 能观察但不能修改 lesson plan;能建议改难度但需要老师确认;所有操作有审计记录;不同 agent role 看到不同的 boundary。

#### 一句话总结

> **Semantic 层让 Agent 知道"这是一堂什么课"。Kinetic 层让 Agent *参与这堂课*。前者是认知;后者是行动力。光有认知的 Agent 只是一个更聪明的搜索引擎。有行动力的 Agent 才是真正的教学协作者。**

#### 为什么我们借思想,不借平台

Palantir 把这建为重量级企业平台(Foundry),带自己数据基础设施、部署模型、生成的客户端 SDKs(OSDK,TypeScript/Python/Java)。我们不能直接用 Palantir — 中国政府/教育客户不会部署它,我们 CcaaS 模型根本不同,ADR-0001 首先禁止我们拥有数据平面。但**概念性动作** — semantic 层带一等 kinetic 在上,作为一个系统治理和审计 — 是可移植的。这就是 `kedge-ontology` 用轻量、框架无关的 TypeScript 实现的,这些约束是我们客户实际有的部署约束。

### 1.5 kedge-ontology 是什么(和不是什么)

`kedge-ontology` 把 Palantir Ontology 的概念模型拿来,适配即见 context:一个轻量、框架无关的 TypeScript 包,提供 schema 原语和访问协议,无重量级平台基础设施。

**关键适配**:Palantir 的 Ontology 是为在 Workshop/Quiver 点按钮的 human operators 设计的。`kedge-ontology` 还必须服务基于 LLM 的 Agents,后者需要*发现*什么对象和 actions 存在、*推理*它们的语义、*决定*采取哪些 actions — 全无硬编码 tool definitions。这意味着 schema 必须在结构类型之外携带自然语言语义。

**它是**:

- 一个被 backend(NestJS)、frontend(@Picker/Vue/React)、Agent runtime 消费的共享类型系统
- 一个定义 Agent operating boundaries 的 manifest composition model
- 一个治理 read/write/action 权限的 accessor protocol

**它不是**:

- 数据库 ORM 或 query builder(数据层是即见的关切)
- UI 组件库(`context-layer-react` 中的 @Picker UI 组件留在那里)
- Agent 框架(agent engine 可插拔 — Claude Code、OpenCode 等)
- [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) 的旁路。Ontology 包本身 ship **零** domain types。它定义元类型(`ObjectTypeDef`、`ManifestDef`、`InterfaceDef`、`ActionDef`、`FunctionDef`、`ObjectSetDef`、`PropertyMeta`、`BoundaryPredicate`);具体 `LessonPlan` / `Class` / `Student` `ObjectTypeDef` 实例在 `solutions/business/live-lesson/backend/` 中定义,在 solution-import 时注册。
- 一个 framework-coupled 包。按 [`docs/architecture/package-layering.zh.md`](../architecture/package-layering.zh.md) 中明文化的分层约定,`@kedge-agentic/ontology` 在其主入口无框架依赖 — 无 NestJS、无 React、无 Vue。把它接入 NestJS 的桥代码住在 `packages/backend/src/ontology/`,镜像 `packages/backend/src/sessions/agent-runtime/` 怎么把 `@kedge-agentic/agent-runtime` 接入 NestJS service。这让 schema 层可被 agent 子进程、CLI tools、Solution backends 使用,而不强加框架选择。

### 1.6 本包带来什么 — 具体回报

1. **@Picker 变成 schema-driven。** 不再硬编码"当用户输入 @,显示这 5 种类型带这些 search 字段",Picker 读 `ObjectTypeDef` registry,动态渲染什么可用、什么可搜索、什么 links 可 traversable。加新可引用对象类型意味着注册一个新 `ObjectTypeDef`,不是修改 Picker 代码。(今天的 `EntityRegistry` 已经近似这个;ontology 形式化它,把形状与 Agent 视图统一。)
2. **Agent context 组装变成声明式。** 不再 bespoke 代码组装"Agent 看什么"对应每个用例,你定义一个 `ManifestDef` 声明 slots、state、access boundaries。Agent runtime 加载 manifest 并在其声明范围内操作。
3. **治理内建。** 现有 `ApiKeyScope` + `UserRole` 模型映射到 `AccessBoundary` roles。当 Agent 调 `executeAction`,boundary check 和审计日志*通过现有 `ToolCallerProxy` pipeline* 发生 — `ActionDef` 编译到 `ToolDefinition`,proxy 强制 schema 声明的 boundary。这对需要 auditability 的教育局客户尤其重要。
4. **新垂直复用框架。** 当即见扩展到教育之外,新业务 domain 定义自己的 `ObjectTypeDef` 和 `ManifestDef`。Picker、Agent 访问协议、治理层无变化工作。

### 1.7 设计原则

1. **Schema 是数据,不是代码。** 所有定义都是可序列化的纯对象 — 无类、无装饰器。哪里类型和约束有自然运行时表示,我们用 Zod(已经底层支撑 `ToolCallerProxy.argsSchema` 和 live-lesson 的 `manifest.schema.ts`);哪里 schema 携带纯元数据(links、actions、boundaries、生命周期),我们用带 `readonly` 字段的纯 TS interfaces。两种形式都通过 `getSchemaDigest()` 序列化到运行时 distribution endpoint(§9.6)。要点:schema 层没东西依赖框架专属装饰器或类机制 — 所有东西作为 JSON 在 NestJS、Vue、React、Agent 进程间传递。(repo 内 data-not-code 拆分的先例:`solutions/business/live-lesson/frontend/.../board-data.js` + `board-renderer.js`。)
2. **Manifest over flat model。** 有趣的单位不是单个 `ObjectType` 而是*组合 operational context* — 一个 `Manifest`,把多个对象绑成一个带显式 state、生命周期、access boundaries 的 workspace。
3. **同一 schema、多个消费者。** @Picker 读 schema 知道什么可选、可 traversable、可显示。Agent 读 schema 知道什么可读、可写、可 actionable。Admin 读 schema 知道什么可审计。Schema 驱动三者,各自不需要自己的 model。
4. **Semantic-aware。** `kedge-ontology` 在 properties、links、actions 上携带自然语言语义,使基于 LLM 的 Agents 可以发现并推理它们,无需硬编码 tool definitions。`semantic` 字段是**必填**,不是可选 — 注册时缺失是 validation 错误。
5. **治理是结构性的。** Access boundaries、approval 要求、audit 级别声明在 schema,不是在应用层附加。Schema 是 `ToolCallerProxy` 的可强制输入,不是建议性元数据。

6. **i18n 是 opt-in,不是 retrofit。** 每个携带 `displayName` 的原语接受纯字符串(今天的常见情况 — 仅中文)或 locale-keyed map。联合形状意味着单语言 Solutions 写更简单形式不变;多语言 Solutions 在需要时加 map。强迫每个消费者传 `Record` 会是 typed-API 破坏变更,来满足未来需求;联合现在免费,以后永不破坏任何人。(见 [gap-analysis G3](./kedge-ontology-gap-analysis.zh.md#g3--displayname-上的-i18ntier-1)。)

### 1.8 一页平台架构(给外部读者)

如果你从未读过 kedge-ccaas codebase,这是理解 `kedge-ontology` 接入什么所需的最小 context。

**拓扑**(代表性端口 — 全部可配置):

```
┌────────────────────┐     ┌──────────────────────┐
│  浏览器 (Vue 3 /   │     │  Agent Engine        │
│  React + SSE)      │     │  (Claude Code /      │
│  - Picker UI       │     │   OpenCode subproc)  │
│  - Chat panel      │     │                      │
└─────────┬──────────┘     └──────────┬───────────┘
          │  HTTPS                    │  stdio + MCP
          │  + SSE                    │
          ▼                           ▼
┌──────────────────────────────────────────────────┐
│  Core ccaas backend  (NestJS, :3001)             │
│  - Sessions / Skills / Auth / Files              │
│  - ToolCallerProxy (治理 chokepoint)             │
│  - MCP server pool                               │
│  - SSE event relay                               │
│  - Sandbox + Workspace runtime                   │
└────────┬───────────────────────────────┬─────────┘
         │  REST                         │  REST
         │  (per-solution domain 调用)   │
         ▼                               ▼
┌────────────────────┐         ┌────────────────────┐
│  live-lesson       │   ...   │  demo-sandbox      │
│  backend (:3007)   │         │  backend (:38xx)   │
│  - Lessons         │         │  - Customers       │
│  - Classroom       │         │  - Plans           │
│  - Observation     │         │  - Revenue         │
│  - manifest.json   │         │  - static entities │
└────────────────────┘         └────────────────────┘
```

**关键不变量:**

- Agent 从不直接与 solution backend 对话。Agent 对世界的每个影响都通过 core 中的 `ToolCallerProxy`。
- Solution backends 是独立 NestJS services。每个拥有自己的数据库(recipe-book 是内存,live-lesson 是 SQLite,demo-sandbox 是静态 JSON)。它们依赖来自 workspace 的 `@kedge-agentic/common` 和 `@kedge-agentic/context-layer`。
- "solution" 在 boot 时通过 POST 自己的 `solution.json` 和 skill 文件向 core 注册自己。注册后,core backend 知道 solution 的 MCP servers、session templates、(本包落地后)ontology。
- 浏览器**从不持有 CCAAS API key**。推荐模式是 "solution backend 作为 proxy" — 见 `solutions/business/live-lesson/CLAUDE.md` 中 "Creator app env" + `ccaas-proxy-pattern` memory 文件。

**一句话 auth 身份**:每个认证请求携带一个 `RequestContext`(`packages/backend/src/auth/types.ts`)带 `{ solutionId, tenant, apiKeyScopes, userId?, userTenant? }`。在 session 创建时,平台把它结晶为一个 `ExecutionContext`(`packages/backend/src/tool-caller/types.ts`),它随每个后续 tool call 一起传递,agent 不能编辑。那个 `ExecutionContext` 是本包 `AccessBoundary` checks 中 `BoundaryRole` 的真源(映射表在 §10.3)。

### 1.9 live-lesson 今天在哪(最重要的参考读物)

本包主要为了形式化 live-lesson 已经在摸索的模式而引入。如果你理解 live-lesson 当前状态,你就理解 80% 为什么本包存在。

**产品**:AI 驱动的交互式教学系统。老师撰写 "lesson plan"(带顺序 step 的 JSON manifest),然后跑 live 课堂 session,学生通过 6 字符 code(如 `HX3KM7`)加入、提交练习,AI 观察/coach。

**今天存在的 artifacts**(文件路径相对仓库根的绝对路径):

- **Lesson manifest** 作为磁盘上 JSON + DB 中 JSON。见 `solutions/business/live-lesson/data/lessons/math-difference-of-squares/manifest.json` 为真实例子(8 年级"平方差公式"课)。DB entity `Lesson`(`solutions/business/live-lesson/backend/src/adapters/persistence/entities/lesson.entity.ts`)逐字存它在 `manifest_json` 列。
- **Manifest schema** 用 Zod,定义有效 lesson 长什么样 — `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`。它校验 `readingSteps[]`、`answerKey`、`phaseConfig`、`studentView`、`teacherView` 等。成功 parse 意味着"这个 manifest 可加载"。
- **Classroom session** 作为运行时概念 — `ClassroomSession` entity 持 `{ code, lessonId, status: 'waiting' | 'active' | 'ended', currentStep, startedAt, endedAt }`。多个 session 可并发跑同一 lesson。
- **Creator MCP server** — `solutions/business/live-lesson/creator-mcp-server/src/index.ts` 暴露三个 stdio tools(`emit_todo_card`、`emit_questions_card`、`emit_verify_card`),agent 调它们渲染富卡片而不是纯文本。在 `solution.json` 中用 `proxyEnabled: true` 和 `toolEventTriggers` 声明,把 tool 结果映射到 field 为 `card` 的 SSE `output_update` 事件。
- **Observation engine** — `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/` 中六个事件 handler 响应课堂事件(学生加入、练习提交、AI chat turn、status 变化、step 完成、系统事件)。Observation 流是 agent 对正在发生事的觉察源。
- **Exercise plugin 系统** — 11 个 exercise 类型(quiz、match、matrix、stance、order、select-evidence、map、image-upload、guided-discovery、…)各带 plugin/grader/observe/sanitizer/spec。"type registry" 模式(`ExerciseTypeRegistry`)自动发现 `@ExerciseType('quiz')` 装饰的类。

**真实 lesson manifest 长这样**(摘录 — 完整文件见上述路径):

```json
{
  "id": "math-difference-of-squares",
  "locale": "zh",
  "title": "平方差公式 — 探究与应用",
  "subject": "数学",
  "gradeLevel": "初中二年级",
  "lessonType": "math",
  "enableMath": true,
  "phaseConfig": [
    { "id": "listen",   "label": "讲解", "unlockAfter": null     },
    { "id": "practice", "label": "练习", "unlockAfter": "listen" },
    { "id": "discuss",  "label": "讨论", "unlockAfter": "practice" },
    { "id": "takeaway", "label": "小结", "unlockAfter": "discuss" }
  ],
  "readingSteps": [
    {
      "id": "intro",
      "type": "instruction",
      "displayName": "情景引入",
      "duration": 3,
      "studentView": { "title": "...", "body": "...", "confirmLabel": "开始学习" },
      "teacherView": { "speechLine": "...", "cueCards": [...] }
    },
    {
      "id": "explore-discover",
      "type": "task",
      "displayName": "探索发现",
      "answerKey": {
        "type": "rich-content-quiz",
        "subType": "calculation",
        "parts": [{ "id": "q1", "prompt": "(1) 计算 $(y+2)(y-2)$", "accepts": ["y^2-4", "y²-4"], ... }],
        "aiSystemPrompt": "你是一位初中数学教师助手。..."
      }
    }
    // ... 更多 steps
  ]
}
```

**驱动本包的痛点**(这些今天都能在 live-lesson 代码看到):

1. `manifestJson` 是自由形式 JSON blob。Zod schema 校验*结构*但不告诉 agent*每个字段意味什么或哪些 actions 合法*。Agent 必须 per surface 被手工 prompt 它在看什么。
2. Agent 在 lesson session 中允许的 actions 编码跨 `creator-mcp-server/`、`solution.json` 的 `proxyEnabled` + `toolEventTriggers`、`solution.json` 的 `sessionTemplates.creator.appendSystemPrompt` 中的 system prompt。三处要保持同步;无单个 registry。
3. `@Picker`(当前限 recipe-book + lesson creator)读取一个独立的 `EntityRegistry`,由 solution backend services 上的 `@Referenceable()` 装饰器填充。Agent 与该 registry 无关系 — 它不知道什么 pickable。
4. 审计半建好:`ToolCallerProxy` 每次调用记 `tool_events`,但没有 schema 级声明像"本 manifest 的 `phase` state 是 full_diff-audited;这个 `adjustDifficulty` action 需要 approval"。审计策略住在 handler 代码,不是 discoverable 契约。

本包把这四个痛点变成一个声明式 artifact:为 `LessonPlan`(以及 `Class`、`Student`、`Resource`、`ClassroomEvent`)注册 `ObjectTypeDef` 一次;在 `ManifestDef LessonSession` 中组合它们;声明 per role 的 `AccessBoundary` 和 per operation 的 `ActionDef`;每个消费者(Picker、agent、审计、治理 UI)从同一 schema 读。

---

## 2. 包结构

```
packages/ontology/
├── src/
│   ├── schema/                    # Layer 1: 原语
│   │   ├── localized-string.ts    # LocalizedString — i18n 联合 (Tier 1, §3.0)
│   │   ├── property-meta.ts       # PropertyMeta + PropertyMetaMap + Classification (Tier 1+3)
│   │   ├── zod-helpers.ts         # objectRef(name), objectSetRef(name) — branded z.string() helpers
│   │   ├── link.ts                # LinkDef — ObjectTypes 之间的关系
│   │   ├── action.ts              # ActionDef + ActionPrecondition + returnType (Tier 1+3)
│   │   ├── function.ts            # FunctionDef — 纯 typed computation (Tier 1, §3.7)
│   │   ├── object-type.ts         # ObjectTypeDef — schema + meta + links + actions 组合
│   │   ├── stream.ts              # StreamDef — 一等事件流 slot (§9.3)
│   │   ├── interface.ts           # InterfaceDef + InterfaceLinkSignature + InterfaceActionSignature (Tier 2, §3.8)
│   │   ├── object-set.ts          # ObjectSetDef + SetFilter + OrderClause (Tier 2, §3.9)
│   │   ├── validation-rule.ts     # ValidationRuleMeta (Tier 3, §3.10)
│   │   ├── state-machine.ts       # StateMachineDef + Transition (Tier 3, §3.11)
│   │   ├── validators.ts          # Schema 级 validation (循环 refs、interface 一致性、meta-key 有效性、state-machine 一致性)
│   │   └── index.ts
│   │
│   ├── helpers/                   # 类型推断的注册 helpers (Zod-first 重构)
│   │   ├── define.ts              # defineObjectType<S>, defineAction, defineFunction, defineInterface, defineObjectSet, defineManifest, defineStateField
│   │   └── index.ts
│   │
│   ├── manifest/                  # Layer 2: Composition
│   │   ├── slot.ts                # SlotDef — manifest 中的 typed 占位符
│   │   ├── state.ts               # StateDef — manifest 级运行时 state
│   │   ├── access-boundary.ts     # AccessBoundary — per-role 读/写/action 范围
│   │   ├── lifecycle.ts           # LifecycleDef — 激活/停用/变更的 hooks
│   │   ├── notification.ts        # NotificationRule + NotificationChannel (Tier 3, §4.8)
│   │   ├── manifest-def.ts        # ManifestDef — 完整 manifest schema
│   │   ├── versioning.ts          # SchemaVersion + migrateInstance (§9.1)
│   │   ├── resolve.ts             # Slot 推导逻辑 (derivedFrom 解析)
│   │   └── index.ts
│   │
│   ├── accessor/                  # Layer 3: Consumption protocols
│   │   ├── manifest-accessor.ts   # ManifestAccessor 接口 — 通用 consumption API
│   │   ├── action-result.ts       # ActionResult — 结构化执行结果
│   │   ├── boundary-check.ts      # 纯函数:此次访问是否违反 boundary?
│   │   ├── boundary-predicate.ts  # BoundaryPredicate + PathExpr + 求值器 (Tier 2, §5.5)
│   │   └── index.ts
│   │
│   ├── registry/                  # 跨切面:发现
│   │   ├── registry.ts            # OntologyRegistry — ObjectType + ManifestDef 存储 + ETag digest
│   │   └── index.ts
│   │
│   ├── semantic/                  # 跨切面:面向 LLM 的 schema projection
│   │   ├── project.ts             # 把 ManifestDef projection 成 Agent 可读格式
│   │   ├── formats/
│   │   │   ├── anthropic-tools.ts # Anthropic tool-use JSON schema
│   │   │   ├── system-prompt.ts   # Markdown system-prompt 片段
│   │   │   └── mcp-tools.ts       # MCP tool descriptor 列表
│   │   └── index.ts
│   │
│   ├── distribution/              # 跨切面:REST distribution 的 schema 序列化 (§9.6)
│   │   ├── serialize.ts           # 规范化 JSON 序列化
│   │   ├── digest.ts              # 注册 schema 的 ETag-friendly digest
│   │   └── index.ts
│   │
│   └── index.ts                   # Public API surface (见 §2.1)
│
├── test/                          # 单元 + architecture tests (见 impl-plan §B4)
├── package.json
├── tsconfig.json
└── README.md
```

### 2.1 Public API surface

顶层 `src/index.ts` 重导出稳定、最小的面:

```ts
// Shared
export type { LocalizedString } from './schema/localized-string';
export type { PropertyMeta, PropertyMetaMap, Classification } from './schema/property-meta';
export { objectRef, objectSetRef } from './schema/zod-helpers';

// Schema primitives (大多数对 Zod schemas 是 generic — 见 §3.4 §3.7 §3.8)
export type { LinkDef, LinkCardinality } from './schema/link';
export type { ActionDef, AuditLevel, ActionPrecondition } from './schema/action';
export type { FunctionDef } from './schema/function';
export type { ObjectTypeDef, PickerConfig } from './schema/object-type';
export type { StreamDef } from './schema/stream';
export type { InterfaceDef, InterfaceLinkSignature, InterfaceActionSignature } from './schema/interface';
export type { ObjectSetDef, SetFilter, OrderClause } from './schema/object-set';
export type { ValidationRuleMeta } from './schema/validation-rule';
export type { StateMachineDef, Transition } from './schema/state-machine';

// Manifest composition
export type { SlotDef, SlotTarget } from './manifest/slot';
export type { StateDef } from './manifest/state';
export type { AccessBoundary, BoundaryRole, BoundaryPathEntry } from './manifest/access-boundary';
export type { LifecycleDef } from './manifest/lifecycle';
export type { NotificationRule, NotificationChannel } from './manifest/notification';
export type { ManifestDef, SchemaVersion } from './manifest/manifest-def';

// Accessor protocols
export type {
  ManifestAccessor,
  ActionResult,
  BoundaryCheckInput,
  BoundaryDecision,
  BoundaryPredicate,
  PathExpr,
  PredicateValue,
  PredicateImpl,
} from './accessor';
export { checkBoundary } from './accessor/boundary-check';

// 类型推断的注册 helpers — solutions 总是通过这些走,
// 从不手工构造底层 interfaces
export {
  defineObjectType,
  defineAction,
  defineFunction,
  defineInterface,
  defineObjectSet,
  defineManifest,
  defineStateField,
} from './helpers/define';

// Registry
export { OntologyRegistry } from './registry/registry';

// Semantic projection
export { projectManifest } from './semantic/project';
export type { ProjectionFormat, ProjectedManifest } from './semantic/project';

// Distribution
export { serializeRegistry, computeSchemaDigest } from './distribution';
```

除 `OntologyRegistry` 外不导出任何类。其余都是 types + pure functions,所以面是 trivially 可序列化和 tree-shakeable 的。

---

## 3. Layer 1: Schema 原语

这些是原子。其它一切都从它们构建。所有形状是 `readonly` 纯对象 — 它们经过 JSON 往返和跨进程边界都不出意外。

### 3.0 共享类型:`LocalizedString`

下面每个 `displayName` 字段都用。按设计原则 6(§1.7),形状是联合:单语言用纯字符串,多语言用 locale-keyed map。

```ts
/**
 * 显示标签。
 *
 * - 纯字符串:单语言标签(默认;今天仅中文的情况)。
 * - 由 ICU locale tag('zh-CN'、'en'、'en-US'、…)索引的 map:
 *   由 `OntologyRegistry.getDisplayName(def, locale?)` 带默认 locale fallback 解析。
 *
 * 联合意味着传字符串的现有调用点继续工作不变;
 * 多语言 Solutions 通过传 Record opt-in。
 */
export type LocalizedString = string | Readonly<Record<string, string>>;
```

Registry 暴露薄 resolver:

```ts
OntologyRegistry.getDisplayName(def: { displayName: LocalizedString }, locale?: string): string
```

解析规则:如果 `displayName` 是字符串,返回它。如果是 map 且 `locale` 匹配 key,返回那个值。如果 `locale` 不是 key 但 `'zh-CN'` 是(平台默认),返回那个。否则返回第一个 map 值。消费者应从用户 session 偏好传 `locale`;缺席是良性的。

### 3.1 PropertyMeta — sidecar(替代旧的 `PropertyDef`)

> **历史**:本 spec 早期版本定义了一个自定义 `PropertyDef`(apiName、type、refTarget、enumValues、required、computed、semantic、searchable、displayRole、…)。该形状重复了 TypeScript 和 Zod 已经表达的东西:字段名*是* Zod 对象 key,字段类型*是* Zod combinator,required-ness 编码为 `.optional()` 或它的缺席,enum 值是 `z.enum([...])`,per-field 自然语言描述放在 `.describe('...')`。自定义形状被现有 repo 约定(live-lesson 的 `manifest.schema.ts`、creator MCP server、`ToolCallerProxy` 的 `argsSchema: ZodTypeAny` 都用 Zod)击败。剩下的只是*治理和呈现 sidecar* — Zod 没概念的东西。

属性的结构形状住在 ObjectType 的 Zod schema(§3.4)。`PropertyMeta` 只携带 Zod schema 表达不了的:

```ts
export interface PropertyMeta {
  /** 可选 i18n 覆盖。如缺席,属性的显示标签
   *  从字段的 `.describe()` 文本或字段名派生。 */
  readonly displayName?: LocalizedString;
  /** @Picker hint: 把这个属性包含在全文搜索中。 */
  readonly searchable?: boolean;
  /** @Picker hint: 列表视图中的渲染 role。 */
  readonly displayRole?: 'title' | 'subtitle' | 'badge' | 'body' | 'hidden';
  /** 运行时派生;可读但任何 role 都不可写。
   *  Agents 会看到派生值(如学生参与度 score)
   *  但 boundary checks 不论 role 都拒绝写。 */
  readonly computed?: boolean;
  /**
   * 法规分类标签(Tier 3, G9)。开放 enum — Solutions
   * 可扩展分类法;包策划三个核心值并
   * 对层级不取立场(PII 不蕴含 'sensitive')。
   * 审计报告读:`registry.getPropertiesByClassification('pii')`。
   */
  readonly classification?: readonly Classification[];
  /**
   * View-time redaction 策略(Tier 3, G12)。boundary check 通过后、
   * 返回前由 ManifestAccessor.readSlot 应用。与
   * `AccessBoundary.readable` 中缺席不同:缺席丢字段存在性;redaction
   * 保留形状但值被转换。
   *
   * 与 classification 捆绑:标记 `'pii'` 的字段通常为非受信 roles
   * 声明 redaction 策略。包不从一个推导另一个 — Solutions 显式
   * 声明两者。
   */
  readonly redaction?: {
    /** 看到 redacted 形式的 Roles。其它 roles 看到原始值。 */
    readonly roles: readonly BoundaryRole[];
    /** mask = 模式填充(名字的 张**);hash = sha256(value)(保留
     *  相等比较);omit = 返回对象中属性不存在。 */
    readonly strategy: 'mask' | 'hash' | 'omit';
    /** 'mask' 策略的可选 mask 模板。默认首字符 + '**'。运行时
     *  求值器检查字段的 Zod 类型为缺席时选择合理默认
     *  (字符串得 '***',数字得 0)。 */
    readonly maskTemplate?: string;
  };
}

/**
 * Classification 分类法(Tier 3, G9)。开放字符串联合 — solutions 可
 * 通过传任意字符串扩展。三个核心值在此作为平台词汇文档化;
 * auditors 可以查询它们,确信跨 Solutions 它们意思一致。
 */
export type Classification =
  | 'pii'        // 个人可识别信息
  | 'sensitive'  // 内部敏感数据(非 PII 但受限)
  | 'regulated'  // 受法规合规(HIPAA、FERPA、…)
  | string;

/**
 * 由绑定 schema 的字段名索引的 sidecar map。Generic 约束
 * 确保拼错的 keys 在 `defineObjectType` 调用点是 TS 错误。
 */
export type PropertyMetaMap<S extends z.ZodObject<z.ZodRawShape>> =
  Partial<Record<keyof z.infer<S>, PropertyMeta>>;
```

**每条信息来自哪里**(本文档其余遵循的规则):

| 信息 | 来源 |
|---|---|
| 字段名(apiName) | Zod 对象字面量中的 key |
| 字段类型 | Zod combinator(`z.string()`、`z.number()`、`z.enum([...])`、…) |
| Required vs optional | Zod 中的 `.optional()` modifier |
| Enum 值 | `z.enum([...])` 或 `z.union([z.literal(...)])` 的参数 |
| Per-field semantic | `z.string().describe('Student display name')` |
| Reference target | branded helper:`objectRef('Class')`(返回 branded `z.string()`);ObjectType apiName 通过 brand 恢复 |
| ObjectSet reference | `objectSetRef('struggling')` — 同模式 |
| Picker/治理 hints | `meta` sidecar(本接口) |

Meta 条目**到处可选**。不需要的字段 — `id: z.string()` — 出现在 Zod schema 中但没有 `meta[id]` 条目。Validator(§9.7)只强制 meta map 中*每个使用的 key* 存在于 Zod schema 中;它不要求每个字段都有 meta。

### 3.2 LinkDef

两个 `ObjectType` 之间的命名、typed 关系。

```ts
export type LinkCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

export interface LinkDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** link 目标的 ObjectTypeDef.apiName。 */
  readonly target: string;
  readonly cardinality: LinkCardinality;
  /** 目标上 inverse link 的名字;强烈推荐。 */
  readonly inverse?: string;
  /** @Picker 可以下钻这个 link。 */
  readonly traversable?: boolean;
  /** Agent 推理用的自然语言描述。 */
  readonly semantic: string;
}
```

关键设计决定:

- `inverse` 可选但强烈推荐。没它,你可以 traverse A→B 但不能 B→A,这破坏 @Picker 的"显示什么引用了这个"模式。
- `traversable` 控制 @Picker 是否能跟随这个 link。不是所有关系都该可浏览 — 如 `createdBy` 是元数据,不是老师需要导航的。
- `N:M` 在实现中可能需要支撑 junction 表,但在 schema 级别它就是 `cardinality: 'N:M'` 的 `LinkDef`。

### 3.3 ActionDef

可对一个对象或在一个 manifest 内执行的治理操作。`ActionDef` 在注册时编译到 `ToolDefinition`,使现有 `ToolCallerProxy` pipeline 做强制工作(见 §10)。

```ts
export type AuditLevel = 'none' | 'log' | 'full_diff';

export interface ActionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * 作为 Zod 对象 schema 的 typed 参数。同样 schema 经
   * 桥上的 `ToolCallerProxy.argsSchema`(§10.2)传递,因此
   * proxy 的 sanitize+validate 步骤解析这些精确约束。
   * Per-param `semantic` 住在 schema 内的 `.describe()` 调用。
   */
  readonly params: z.ZodObject<z.ZodRawShape>;
  /**
   * Agent 推理用的声明式 side-effect 标签,如
   * 'mutates:LessonSession.state.phase' 或 'emits:ClassroomEvent'。
   */
  readonly sideEffects: readonly string[];
  /** 此 action 传递性调用的其它 ActionDef.apiNames(§9.5)。 */
  readonly composes?: readonly string[];
  /**
   * 在 dispatch 之前由 checkBoundary 求值的声明式 gates。
   * 如任一 precondition 未满足,action 以结构化
   * unmetPreconditions 列表被拒 — agent 从不看到 "handler
   * 提前返回因为 state 错" 响应。
   *
   * 按 gap-analysis G2(Tier 1)添加:把 "if (phase !== 'practice')
   * 提前返回" 从 agent 看不到的 handler 代码移出,进
   * discoverActions() 可相应过滤的 schema。
   */
  readonly preconditions?: readonly ActionPrecondition[];
  /** 执行前的 human-approval gate。 */
  readonly requiresApproval?: boolean;
  /**
   * 允许调用此 action 的 roles。与
   * AccessBoundary.actions 是 AND-style — 两道门都必须通过。
   */
  readonly allowedRoles: readonly BoundaryRole[];
  /** 调用 session 的 required ApiKeyScopes;ANY-of 语义。 */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];
  readonly auditLevel: AuditLevel;
  /**
   * Typed 返回值(Tier 3, G11)。设置时,桥把解析的
   * 返回附到 `ActionResult.returnValue`,并在 agent 的 projected
   * action descriptor 中包含 schema 的 `zod-to-json-schema` 渲染
   * — agents 可在不调用前推理 Action 返回什么。
   *
   * 大多数 Actions 只返回 state changes(已在 `ActionResult.stateChanges`);
   * `returnType` 是给有用输出是结构化数据的 Actions,agent 应该链上的
   * (如 `bulkFlag` 返回 `{ flagged: Student[], skipped: Student[] }`)。
   */
  readonly returnType?: z.ZodTypeAny;
  /** Agent 消费用的自然语言描述。必填。 */
  readonly semantic: string;
}

/**
 * 声明式 precondition 形状(由 `kind` 区分)。
 * 三种形式覆盖常见情况,无需承诺 Turing 完备的
 * predicate sub-language;更丰富的逻辑通过 `kind: 'named'` 逃生
 * 并注册一个 Predicate 在 OntologyRegistry。
 */
export type ActionPrecondition =
  /** 路径 `path` 处的 manifest state 必须等于 `value`。 */
  | { readonly kind: 'stateEquals'; readonly path: string; readonly value: string | number | boolean | null }
  /** 命名 slot 当前必须绑定(非 null,collection 非空)。 */
  | { readonly kind: 'slotBound'; readonly slot: string }
  /** 在 OntologyRegistry 上注册的命名 predicate;`params` 是可选 context。 */
  | { readonly kind: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

/** packages/backend/src/auth/types.ts ApiKeyScope 的镜像。 */
export type ApiKeyScopeLiteral =
  | 'skills:read' | 'skills:write' | 'skills:execute' | 'skills:delete'
  | 'mcp:read' | 'mcp:write'
  | 'chat' | 'analytics:read' | 'builder' | 'admin';
```

关键设计决定:

- `params: z.ZodObject<...>` — actions 通过 Zod 对象 schema 取 typed、described 参数。同一 schema 是桥(§10.2)上 `ToolCallerProxy.argsSchema` 解析对的,所以无第二表示要保持同步。
- `sideEffects` 是*声明式字符串数组*。Agents 通过检查声明的 side effects 推理 action 是否合适,无需实现细节。(重要:这是 agent-discovery 契约;实际 mutations 在 handler 中发生。)
- `requiresApproval`、`allowedRoles`、`requiredScopes`、`auditLevel` 是 schema 的一部分,不是应用层。Schema *就是*治理声明。
- `requiredScopes` 镜像字面 `ApiKeyScope` 联合,使 ontology 包不必 import 任何 backend;registry 校验值是本联合成员。

### 3.4 ObjectTypeDef

组合:properties + links + actions + picker config。

```ts
export interface PickerConfig {
  readonly icon: string;
  readonly color?: string;
  /** 包含在全文搜索中的 property apiNames 子集。 */
  readonly searchFields: readonly string[];
  /** 值作为 headline 渲染的 property apiName。 */
  readonly titleField: string;
  /** 副标题/摘要行的 property apiName(可选)。 */
  readonly subtitleField?: string;
  /**
   * 允许从声明 picker context 的 manifest 之外的 manifests 引用
   * 此类型(§9.4)。默认:hermetic。
   */
  readonly crossManifestSources?: readonly ('parent' | 'sibling' | 'all')[];
}

export interface ObjectTypeDef<S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** 必填 — 此对象代表什么的整体描述。 */
  readonly semantic: string;
  /**
   * Zod 对象 schema — 结构形状的真源。
   * 字段名是 property apiNames;字段类型决定下游一切
   * (TS inference、JSON Schema projection、`ToolCallerProxy`
   * validation)。Per-field `semantic` 文本住在 schema 内的
   * `.describe('...')` 调用。
   */
  readonly schema: S;
  /** 携带 Zod 没概念的 picker/治理 hints 的 sidecar。 */
  readonly meta?: PropertyMetaMap<S>;
  readonly links: readonly LinkDef[];
  readonly actions: readonly ActionDef[];
  /**
   * 此对象实现的 InterfaceDef apiNames(§3.8, Tier 2)。
   * 注册时 validators 检查结构一致性:实现者的
   * `schema` 必须结构性地包含 `InterfaceDef.requiredSchema` 中每个 key
   * 带兼容 Zod 类型。通过 `OntologyRegistry.getImplementersOf(name)`
   * 启用多态查询。
   */
  readonly implements?: readonly string[];
  /**
   * Domain-rule sidecar — 命名链在 `schema` 上的 .refine() 调用
   * 并向 agent 的 projected view 暴露它们(§3.10, Tier 3, G7)。
   */
  readonly validationRules?: readonly ValidationRuleMeta[];
  /**
   * 绑到 `schema` 上一个 enum-typed 字段的 per-object 生命周期
   * (§3.11, Tier 3, G8)。Validators 检查属性是 z.enum 且
   * transitions 引用有效 enum 值 + 注册的 ActionDefs。
   */
  readonly stateMachine?: StateMachineDef;
  readonly picker?: PickerConfig;
}
```

**从 `defineObjectType<S>({ schema, ... })` 你得到**(无重复声明):

- 一个 typed config 对象,其 `meta` keys 受约束于 `keyof z.infer<typeof schema>` — 拼错是编译期错误。
- 实例的 TS 类型:`type Student = z.infer<typeof StudentSchema>` 在调用点。
- 运行时 introspection:`registry.getObjectType('Student').schema.shape.name` 返回 Zod 字段。
- 任何消费者想要的免费 JSON Schema:`zod-to-json-schema(StudentSchema)`(§7 semantic projection 用)。

`defineObjectType<S>()` helper(在 `src/helpers/define.ts`)是 passthrough,纯为了 TS 从调用推断 `S` 且 meta map keys 受约束。Solutions 从不手写 `ObjectTypeDef<...>`;他们总是通过 helper。

关键设计决定:

- `picker` 嵌在 `ObjectType` 中,不在单独的 UI config。这是"同一 schema、多消费者"原则。
- 无继承 / 无 `extends`。`ObjectType` 是 flat 的。如果两个类型共享字段,这是它们应该共享一个被引用的 `ObjectType`(composition over inheritance)或 `InterfaceDef`(§3.8, 多态契约)的信号。Zod schema 保持可序列化,菱形问题不出现。
- `crossManifestSources` 是 `ObjectType` 从拥有它的 manifest 之外的 manifest 变得可 picker 的*唯一*方式。默认行为是 hermetic。

### 3.5 StreamDef *(新 — §9.3 决议)*

事件流是一等的,区别于 slots,因为其语义是 subscribe-only(push),不是 read-once(pull)。

```ts
export interface StreamDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * 事件 payload 的 ObjectTypeDef.apiName — payload 形状来自
   * 注册 ObjectType 的 Zod schema。给事件也作为一等对象
   * 持久化的 streams 用。
   */
  readonly payloadType?: string;
  /**
   * Inline payload Zod schema,给事件*不*作为
   * 独立 ObjectTypes 持久化(如临时进度 ticks)的 streams 用。
   * `payloadType` 或 `payloadSchema` 必须恰好一个被设;validators 强制。
   */
  readonly payloadSchema?: z.ZodTypeAny;
  /** 必填 — 此 stream 发出什么、何时、订阅者应做什么。 */
  readonly semantic: string;
  /**
   * 运行时的可选 backpressure hint。'drop_oldest' 是
   * 高量观察 streams(GLM 课堂事件)的默认。
   */
  readonly backpressure?: 'drop_oldest' | 'block_producer' | 'unbounded';
}
```

`StreamDef` 出现在 `ManifestDef` 级别(不在 `ObjectTypeDef`)— 它们是*operational context* 的属性,不是任何个别对象的。

### 3.6 Worked example:真实 lesson 需要的五个 `ObjectTypeDef`

为了让原语具体,这是一个 live-lesson `LessonSession` `ManifestDef` 引用的五个 `ObjectTypeDef`。这些住在 solution backend(`solutions/business/live-lesson/backend/src/ontology/`),不在 ontology 包本身。

Zod schema 是形状和 per-field 语义的真源。`meta` sidecar 只带 Zod 没概念的 picker/治理 hints。`objectRef(...)` 和 `objectSetRef(...)` helpers 返回 branded `z.string()` — brand 把被引用的 ObjectType/ObjectSet 名字带入运行时 introspection,无需发明独立的 "ref type"。

```ts
import { z } from 'zod';
import { defineObjectType, objectRef, objectSetRef } from '@kedge-agentic/ontology';

// ─── LessonPlan ────────────────────────────────────────────────
const LessonPlanSchema = z.object({
  id: z.string()
    .describe('Stable identifier; matches the manifest.json directory name.'),
  title: z.string()
    .describe('Headline shown to teacher and students.'),
  subject: z.enum(['math', 'reading', 'science'])
    .describe('Subject area; determines which observation handlers and exercise types apply.'),
  gradeLevel: z.string()
    .describe('Target grade level, free-form Chinese (e.g. "初中二年级").'),
  durationMinutes: z.number()
    .describe('Sum of all readingSteps[].duration; computed from steps.'),
  // Foreign keys live in the schema as branded strings — runtime can
  // recover the target ObjectType from the brand.
  targetClassId: objectRef('Class').optional(),
});
type LessonPlan = z.infer<typeof LessonPlanSchema>;

const LessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  displayName: '教学计划',
  semantic:
    'A teacher-authored plan for a single class session, with sequenced ' +
    'steps and per-step learning objectives. One LessonPlan can back ' +
    'many ClassroomSession instances.',
  schema: LessonPlanSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
    subject: { searchable: true, displayRole: 'subtitle' },
    gradeLevel: { searchable: true },
    durationMinutes: { computed: true },
  },
  links: [
    { apiName: 'targetClass', displayName: '面向班级', target: 'Class', cardinality: 'N:1',
      inverse: 'lessons', traversable: true,
      semantic: 'The class this plan is authored for.' },
    { apiName: 'usesResources', displayName: '使用资源', target: 'Resource', cardinality: 'N:M',
      inverse: 'usedByPlans', traversable: true,
      semantic: 'Slides, videos, worksheets embedded in this plan.' },
  ],
  actions: [
    defineAction({
      apiName: 'adjustDifficulty',
      displayName: '调整难度',
      // Zod object schema; per-param semantic via .describe(); ToolCallerProxy
      // uses this exact schema as argsSchema at the bridge (§10.2).
      params: z.object({
        direction: z.enum(['easier', 'harder'])
          .describe('Which way to nudge the plan difficulty.'),
        reason: z.string()
          .describe('Free-text justification recorded in the audit trail.'),
      }),
      sideEffects: ['mutates:LessonPlan.steps', 'emits:DifficultyAdjusted'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'full_diff',
      semantic: 'Re-paces the plan toward easier or harder content. Use when ' +
        'class metrics show consistent under- or over-performance for ≥3 minutes.',
    }),
  ],
  picker: {
    icon: '📘', color: 'blue',
    searchFields: ['title', 'subject', 'gradeLevel'],
    titleField: 'title',
    subtitleField: 'subject',
  },
});

// ─── Class ────────────────────────────────────────────────
const ClassSchema = z.object({
  id: z.string(),
  name: z.string().describe('Display name shown to teachers, e.g. "初二(3)班".'),
  school: z.string().describe('Which school this class belongs to.'),
  studentCount: z.number().describe('Number of students in `contains`; derived.'),
});

const Class = defineObjectType({
  apiName: 'Class',
  displayName: '班级',
  semantic: 'A persistent roster of students. Many ClassroomSessions reference the same Class.',
  schema: ClassSchema,
  meta: {
    name: { searchable: true, displayRole: 'title' },
    school: { searchable: true, displayRole: 'subtitle' },
    studentCount: { computed: true },
  },
  links: [
    { apiName: 'contains', displayName: '包含学生', target: 'Student', cardinality: '1:N',
      inverse: 'class', traversable: true,
      semantic: 'Students enrolled in this class.' },
    { apiName: 'lessons', displayName: '历史课程', target: 'LessonPlan', cardinality: '1:N',
      inverse: 'targetClass', traversable: true,
      semantic: 'Past and present lesson plans targeting this class.' },
  ],
  actions: [],
  picker: { icon: '👥', color: 'amber', searchFields: ['name', 'school'], titleField: 'name', subtitleField: 'school' },
});

// ─── Student ────────────────────────────────────────────────
const StudentSchema = z.object({
  id: z.string(),
  name: z.string().describe('Student display name.'),
  engagementScore: z.number().min(0).max(100)
    .describe('Rolling engagement score computed from the last 10 ClassroomEvents. Range 0–100.'),
  lastSeenAt: z.string().datetime()
    .describe('Timestamp of the most recent event from this student in the current session.'),
  classId: objectRef('Class'),
});

const Student = defineObjectType({
  apiName: 'Student',
  displayName: '学生',
  semantic: 'A single student in a Class. Mostly read-only from the agent perspective; mutations happen via Submission rather than directly.',
  schema: StudentSchema,
  meta: {
    name: { searchable: true, displayRole: 'title' },
    engagementScore: { computed: true },
    lastSeenAt: { computed: true },
  },
  links: [
    { apiName: 'class', displayName: '所属班级', target: 'Class', cardinality: 'N:1',
      inverse: 'contains', traversable: true,
      semantic: 'The class this student belongs to.' },
  ],
  actions: [
    defineAction({
      apiName: 'flagForIntervention',
      displayName: '标记需关注',
      params: z.object({
        reason: z.string()
          .describe('Why this student needs teacher attention. Recorded verbatim in the alert.'),
        severity: z.enum(['watch', 'urgent'])
          .describe('Watch = surface in dashboard; urgent = teacher push notification.'),
      }),
      sideEffects: ['emits:StudentAlert'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'log',
      semantic: 'Raises a teacher-facing alert for this student. Use when ' +
        'engagementScore drops below 30 or after 3 consecutive incorrect submissions.',
    }),
  ],
  picker: {
    icon: '🧑‍🎓', color: 'green',
    searchFields: ['name'],
    titleField: 'name',
    crossManifestSources: ['sibling'],
  },
});

// ─── Resource ────────────────────────────────────────────────
const ResourceSchema = z.object({
  id: z.string(),
  title: z.string().describe('Resource headline.'),
  kind: z.enum(['slide', 'video', 'worksheet', 'image'])
    .describe('Resource medium. Determines how the player renders it.'),
  url: z.string().url().describe('Resource URL (absolute or backend-relative).'),
});

const Resource = defineObjectType({
  apiName: 'Resource',
  displayName: '教学资源',
  semantic: 'A reusable teaching artifact (slide, video, worksheet) referenced by one or more LessonPlans.',
  schema: ResourceSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
    kind: { searchable: true, displayRole: 'subtitle' },
  },
  links: [
    { apiName: 'usedByPlans', displayName: '被引用', target: 'LessonPlan', cardinality: 'N:M',
      inverse: 'usesResources', traversable: true,
      semantic: 'Lesson plans that embed this resource.' },
  ],
  actions: [],
  picker: { icon: '🎞', color: 'purple', searchFields: ['title', 'kind'], titleField: 'title', subtitleField: 'kind' },
});

// ─── ClassroomEvent ────────────────────────────────────────────────
const ClassroomEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['join', 'submit', 'chat_turn', 'status_change', 'step_complete', 'system'])
    .describe('Event category; mirrors the six handler types in adapters/observer-engine/handlers/.'),
  occurredAt: z.string().datetime()
    .describe('When the event was observed (not when it was processed).'),
  studentId: objectRef('Student').optional(),
  payload: z.record(z.unknown())
    .describe('Event-specific payload. Shape depends on `kind`.'),
});

const ClassroomEvent = defineObjectType({
  apiName: 'ClassroomEvent',
  displayName: '课堂事件',
  semantic: 'One structured event extracted from the live classroom by the ' +
    'GLM-4.7-Flash observation engine. The agent subscribes to a stream of ' +
    'these to maintain awareness.',
  schema: ClassroomEventSchema,
  links: [
    { apiName: 'student', displayName: '关联学生', target: 'Student', cardinality: 'N:1',
      semantic: 'The student this event is about, when applicable.' },
  ],
  actions: [],
});
```

这个例子集中要注意几件事:

- **无重复字段声明。** Student schema 声明 `engagementScore: z.number().min(0).max(100).describe('Rolling engagement score…')` — 名字、类型、范围约束、自然语言描述都在一处。Meta sidecar 只加 `{ computed: true }`。之前同一字段需要 `PropertyDef` literal 中 5 行。
- **`computed: true` 仍然咬。** `Student.engagementScore` 在 meta 中的 `computed: true` 标志告诉 `boundary-check.ts` 不论任何 `AccessBoundary.writable` 声明都拒绝写。Zod schema 不知道 computed-ness;这就是为什么 meta sidecar 存在。
- **`Student.picker.crossManifestSources: ['sibling']`** 是 lesson A 的老师可以 `@` lesson B 名单中学生的*唯一*方式(§9.4)。Picker config 自前设计无变化(Zod 在这上面帮不上忙)。
- **`ClassroomEvent` 无 `picker` block** — 它仅 stream。`OntologyRegistry.getPickableTypes()` 跳过它,所以 `@Picker` 从不把它渲染为顶级选项。
- **`adjustDifficulty.params` 是 Zod 对象 schema**,不是 `PropertyDef[]`。同一 schema 在桥(§10.2)上成为 `ToolCallerProxy.argsSchema`;无第二表示。
- **`objectRef('Class')` 是 branded `z.string()`。** 运行时可以读 brand 知道 `Student.classId` 引用 `Class`;static TS 把它看成 string。这把旧的 `type: 'ref', refTarget: 'Class'` 声明替换为单个 Zod combinator。

### 3.7 FunctionDef — 纯、无副作用的 typed computations

`ActionDef` 是给"做改变 state 的事"。`FunctionDef` 是给"计算什么并告诉我答案"。两者都 agent-callable;区别是语义的,它改变 agent 怎么推理代价和 approval。

```ts
/**
 * A typed, side-effect-free computation. Distinct from ActionDef by intent:
 * functions return values, actions change state.
 *
 * Compiles to a ToolDefinition at registration time (same bridge as ActionDef)
 * but with the audit level pinned at 'log' (never 'full_diff') and the approval
 * gate skipped entirely. The agent's projected view (§11) lists functions in a
 * separate "What you can compute" section, distinct from "What you can do."
 *
 * Added per gap-analysis G1 (Tier 1).
 */
export interface FunctionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** Typed parameters as a Zod object schema (same shape as ActionDef.params). */
  readonly params: z.ZodObject<z.ZodRawShape>;
  /** Shape of the returned value as a Zod schema. Per-field `.describe()`
   *  carries semantic text for the agent's projected view. */
  readonly returnType: z.ZodTypeAny;
  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
  /** Roles allowed to invoke this function. */
  readonly allowedRoles: readonly BoundaryRole[];
  /** Required ApiKeyScopes for the calling session; ANY-of semantics. */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];
  // Deliberately absent:
  //   - sideEffects (functions have none, by definition)
  //   - composes (function composition is a handler concern, not schema)
  //   - preconditions (a precondition that gates a pure read is suspicious;
  //     if needed, use AccessBoundary.readable instead)
  //   - requiresApproval (approval for a read is a category error)
  //   - auditLevel (pinned at 'log' by the bridge — see §10.1)
}
```

**为什么这是独立原语。** 今天,纯读 computation 坍缩为两种不令人满意的形状之一:

- `computed: true` `PropertyDef` — 但 `computed` 是 per-object 且无参数。没办法把 `computeEngagementScore(studentId, windowMinutes) → number` 表达为属性。
- 带 `sideEffects: []` 和 `auditLevel: 'none'` 的 `ActionDef` — 但 schema 那时*在意图上撒谎*。类型中没东西告诉 agent(或人工 reviewer)这*定义上*是安全调用的。Agent 的 projected view 把它与实际 mutations 一起分组在"你能做什么"下面;扫描"什么写 state"的 reviewer 必须读每个 action 的 `sideEffects` 数组过滤纯读出来。

两者都是缺失原语的 workaround。`FunctionDef` 是那个原语。

**Live-lesson 例子。**

```ts
defineFunction({
  apiName: 'computeEngagementScore',
  displayName: '计算参与度',
  params: z.object({
    studentId: objectRef('Student'),
    windowMinutes: z.number().int().min(1).max(60)
      .describe('Time window (minutes) over which to aggregate ClassroomEvents.'),
  }),
  returnType: z.number().min(0).max(100)
    .describe('Engagement score 0–100; 100 = maximally engaged.'),
  allowedRoles: ['agent', 'admin'],
  semantic: 'Read the student\'s recent ClassroomEvents and compute their ' +
    'engagement score. Pure read; use freely without approval concerns.',
});
```

今天这要么是不可见的 service 方法要么是退化的 `ActionDef`;有 `FunctionDef`,它是 discoverable、可调的 computation,区别于任何改 state 的东西。

**Boundary 语义。** `FunctionDef` 由 `AccessBoundary.actions` 门控(与 `ActionDef.apiName` 同一列表)— 无新 boundary 字段。Solutions 通过两个方式区分读 vs 写:(a) per role 它们放进 actions 列表的什么;(b) projected semantic view(§11)在每个标题下分组什么。

### 3.8 InterfaceDef — 跨 ObjectTypes 共享的多态契约

`ObjectTypeDef` 是 flat 的(§3.4:"无继承、无 `extends`")。但重复契约 — "可在 chat 里 `@` 提到的任何东西"、"为审计 PII 标记的任何东西"、"参与父/子层级的任何东西" — 跨多个类型出现。没有多态,契约的每个消费者都必须手工枚举具体类型。`InterfaceDef` 是多态层。

```ts
/**
 * A shared contract that one or more ObjectTypeDefs declare they implement.
 *
 * Structural, not nominal: validators at registration check that each
 * implementor's actual properties/links/actions satisfy the required
 * signatures (matching by apiName and type). No method-dispatch table is
 * generated — the registry simply tracks who implements what.
 *
 * Resolution is at REGISTRATION time, not call time: when ObjectTypeDef
 * declares `implements: ['Mentionable']`, the registry resolves the link
 * once and rejects boot if the type doesn't conform. A Solution that
 * needs runtime polymorphism overrides `OntologyRegistry.getImplementersOf()`
 * with a custom resolver — see Open Question #2 in the gap analysis.
 *
 * Added per gap-analysis G4 (Tier 2).
 */
export interface InterfaceDef<R extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly semantic: string;
  readonly requiredSchema?: R;
  readonly requiredLinks?: readonly InterfaceLinkSignature[];
  readonly requiredActions?: readonly InterfaceActionSignature[];
}

export interface InterfaceLinkSignature {
  readonly apiName: string;
  readonly target: string;
  readonly cardinality: LinkCardinality;
  readonly semantic: string;
}

export interface InterfaceActionSignature {
  readonly apiName: string;
  readonly params: z.ZodObject<z.ZodRawShape>;
  readonly semantic: string;
}
```

**Live-lesson 例子。** 三个类型 — `Student`、`Teacher`、`Parent` — 共享 `Mentionable` 契约(图标 + 可搜索 display name + picker 的 summary 行)和 `Personal` 契约(PII 标记、按 gap-analysis G9+G12 采纳时的 redaction 规则)。没 `InterfaceDef`,"给我本 Solution 中所有注册的 Mentionables" 查询逼消费者枚举具体类型;有它,`registry.getImplementersOf('Mentionable')` 透明地返回三者,加第四个(以后 `StudentGuardian`)变成对每个消费者 discoverable 无变化。

**Registry hook。** `OntologyRegistry.getImplementersOf(interfaceName: string): readonly ObjectTypeDef[]` 返回所有声明 `implements: [..., interfaceName, ...]` 的注册类型。`getInterface(name): InterfaceDef | undefined` 取回契约本身。`registerInterface(def: InterfaceDef): void` 注册;validators(§9.7)对每个现有实现者检查结构一致性。

**Validator 规则(加到 §9.7)。** 当 `ObjectTypeDef.implements: ['X']` 被声明,registry 把 `X` 解析为 `InterfaceDef` 并跑三项检查:`X.requiredSchema.shape` 中每个 key 出现在实现者的 `schema.shape` 中带结构兼容的 Zod 类型(validator 并行 walk 两个 schemas);每个 `X.requiredLinks` 条目在实现者 `links[]` 中有匹配的 apiName/target/cardinality;每个 `X.requiredActions` 条目有匹配 apiName 且其 params schema 是签名 params schema 的结构超集。不匹配类型、缺失成员、未注册 interface 都在 boot 时抛 `RegistrationError`。

### 3.9 ObjectSetDef — 命名、typed、filtered 的集合

Agent 推理中的常见形状:"本 session struggling 的学生集合"、"过去 3 节课用的 resources"、"等张老师批改的 submissions"。今天这些是带硬编码 filter 逻辑烤进 manifest 的 derived slots,且不能作为 Action 参数传递或跨 manifest 引用。`ObjectSetDef` 让它们一等。

```ts
/**
 * A named, typed, filterable collection of objects of a given ObjectType.
 *
 * Two registrations of an ObjectSetDef with the same `apiName` are the same
 * set (identity by name, not by filter structure — even if two sets happen
 * to compute the same filter, they're distinct unless the apiName matches).
 * This is the explicit "structural equality with explicit apiName" decision
 * from gap-analysis Open Question #4.
 *
 * Added per gap-analysis G6 (Tier 2).
 */
export interface ObjectSetDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly objectType: string;
  readonly filter: SetFilter;
  readonly orderBy?: readonly OrderClause[];
  readonly defaultLimit?: number;
  readonly semantic: string;
}

export type SetFilter =
  | { readonly op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; readonly path: string; readonly value: string | number | boolean | null }
  | { readonly op: 'in'; readonly path: string; readonly values: readonly (string | number | boolean)[] }
  | { readonly op: 'has'; readonly path: string }
  | { readonly op: 'and' | 'or'; readonly clauses: readonly SetFilter[] }
  | { readonly op: 'not'; readonly clause: SetFilter }
  | { readonly op: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

export interface OrderClause {
  readonly path: string;
  readonly direction: 'asc' | 'desc';
}
```

**Live-lesson 例子。** `struggling = ObjectSetDef { objectType: 'Student', filter: { op: 'lt', path: 'engagementScore', value: 30 }, orderBy: [{ path: 'engagementScore', direction: 'asc' }] }`。在 live-lesson backend 注册一次。Agent 可通过 `readSlot` 读它如果 manifest slot target 它;Action `bulkFlagForIntervention(set: ObjectSet<Student>, reason)` 可以把它作为参数;另一个 manifest(未来 `SemesterPlan`)可以引用它而不重新实现 filter 逻辑。

**Slot 集成。** `SlotDef.target`(§4.2)获得第三 discriminant:`{ kind: 'objectSet', name: string }`。指向 ObjectSet 的 slot 按定义是 collection-typed(无需 `collection: true`)。

**Action 参数集成。** 在 Zod action params schema 内用 `objectSetRef('struggling')` — 它返回 branded `z.string()`,其 brand 把 ObjectSet apiName 带入运行时 introspection。例子:`params: z.object({ targets: objectSetRef('struggling').describe('目标集合'), reason: z.string() })`。

**为什么 filter 表达式是 first-order。** 按 gap-analysis Open Question #3:Turing 完备的 predicate sub-language 很快变成安全面(sandbox、资源限制、fixpoint-iteration 关切)。First-order 对 80% 情况够(比较 + 布尔 + 属性访问);`'named'` 逃生通道通过在 registry 注册命名 `Predicate` 覆盖剩 20% — 实现住在 solution 代码,可被 review。

**路径解析。** `SetFilter` 中每个 `path` 通过绑定 `ObjectType` 的 Zod schema 经 `schema.shape` walk 解析。`path: 'engagementScore'` 对 `objectType: 'Student'` 有效,因为 `StudentSchema.shape.engagementScore` 存在;`path: 'enagmentScore'`(typo)在 `registerObjectSet()` 抛 `RegistrationError`。这是 Zod-first 的胜利之一 — 路径与运行时数据 parse 对的同一形状校验,所以编译过的 filter 就是会对预期形状的行执行的 filter。

**Registry hook。** `OntologyRegistry.registerObjectSet(def)`、`.getObjectSet(name)`、`.getObjectSetsForType(typeName)`。Schema-distribution endpoint(§9.6)在序列化 payload 中包含 ObjectSets;`getSchemaDigest()` 与其它东西一起 hash 它们。

### 3.10 ValidationRuleMeta — 把 domain 约束暴露给 agent(Tier 3, G7)

Zod 已经做*结构*校验(类型、format、范围)。它原生不向其它消费者表面的是*domain-rule* 校验 — "除非 `gradeLevel` === '高中',否则 `durationMinutes` ≤ 60" 型跨字段约束。Zod 原生工具是 `.refine()` / `.superRefine()`,parse 时工作良好,但对 agent 的 projected view(以及想枚举"什么规则治理 LessonPlan?"的 compliance reporters)不可见。`ValidationRuleMeta` 是让 refines discoverable 的 sidecar。

```ts
/**
 * Metadata exposing a Zod refinement rule to the agent and to compliance
 * tooling. The actual validation logic lives in the .refine() / .superRefine()
 * call on the ObjectTypeDef.schema; the meta entry just gives that anonymous
 * predicate a name, severity, and natural-language explanation.
 *
 * Convention: refine() with a structured params object that carries `name`
 * matching a key in `validationRules`; the runtime cross-references.
 *
 * Added per gap-analysis G7 (Tier 3).
 */
export interface ValidationRuleMeta {
  readonly name: string;
  readonly severity: 'error' | 'warn';
  readonly message: LocalizedString;
  readonly semantic: string;
}

// Usage — on ObjectTypeDef:
const LessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  schema: LessonPlanSchema.refine(
    (plan) => plan.durationMinutes <= 60 || plan.gradeLevel.startsWith('高中'),
    { message: '课程时长不应超过 60 分钟（高中除外）', params: { name: 'duration_cap' } }
  ),
  validationRules: [
    {
      name: 'duration_cap',
      severity: 'error',
      message: { 'zh-CN': '课程时长不应超过 60 分钟（高中除外）',
                 'en': 'Lesson duration must not exceed 60 minutes (high school excepted).' },
      semantic: 'Caps lesson duration at 60 min for K-12; relaxed for 高中 ' +
        'because high-school lessons commonly run 90 min in Chinese curricula.',
    },
  ],
});
```

为什么这个形状而不是"声明式 predicate 表达式":

- Refines 可表达任何东西;受限 sub-language 不能。逃生阀是规则本身;agent-facing 面只是关于规则的元数据。
- Solutions 已经写 Zod refines(live-lesson 的 `manifest.schema.ts` 有它们)。我们不要求任何人在 custom DSL 中重新表达工作的代码。
- `params: { name: 'duration_cap' }` 约定意味着 validator 能确定性地把 refine 链到其 meta 条目,运行时能用 meta 的 semantic+message 表面 "规则 X 失败" 而不是 Zod 的字符串化 path。

**Validator 规则(§9.7)。** 当 `ObjectTypeDef.validationRules` 设置,数组中每个 `name` 必须作为 `params.name` 出现在某个链到 `schema` 的 `.refine()` 上。反向也强制(每个命名 refine 有 meta 条目)。无 `params.name` 的匿名 refines 允许但不会被 projected 到 agent — 用 lint 标记,不是硬错误。

### 3.11 StateMachineDef — 每对象生命周期(Tier 3, G8)

`ManifestDef.lifecycle`(§4.5)覆盖 manifest 整体。个别对象常有自己 state-machine:`Submission` 走 `draft → submitted → graded → reviewed`,某些 transitions 要 approval。今天这住在 service 方法代码,对 agent 不可见。`StateMachineDef` 作为 schema 暴露它。

```ts
/**
 * Per-object lifecycle bound to a single enum-typed property on the
 * ObjectType's Zod schema. Validators verify the property exists and is
 * a z.enum; transition `from`/`to` values are checked against the enum.
 *
 * Added per gap-analysis G8 (Tier 3).
 */
export interface StateMachineDef {
  readonly property: string;
  readonly transitions: readonly Transition[];
}

export interface Transition {
  readonly from: string;
  readonly to: string;
  readonly action?: string;
  readonly requiresApproval?: boolean;
  readonly semantic: string;
}

// Usage on ObjectTypeDef (added field):
const Submission = defineObjectType({
  apiName: 'Submission',
  schema: z.object({
    id: z.string(),
    status: z.enum(['draft', 'submitted', 'graded', 'reviewed']),
  }),
  stateMachine: {
    property: 'status',
    transitions: [
      { from: 'draft', to: 'submitted', action: 'submitSubmission',
        semantic: 'Student submits their work.' },
      { from: 'submitted', to: 'graded', action: 'gradeSubmission',
        semantic: 'Teacher records a grade.' },
      { from: 'graded', to: 'reviewed', action: 'reviewSubmission',
        requiresApproval: true,
        semantic: 'Department head reviews graded submission. Requires approval.' },
    ],
  },
});
```

**Validator 规则(§9.7)。** `StateMachineDef.property` 必须引用 `ObjectTypeDef.schema.shape` 上一个 key,其 Zod 类型是 `z.enum(...)`。Transitions 中每个 `from`/`to` 必须是 enum 选项之一。每个命名 `action` 必须是注册的 `ActionDef.apiName`,其 params 包含识别目标对象实例的方式(validator 检查 `id` param 或匹配 ObjectType 的 objectRef param)。

**Boundary 语义。** 对 state 属性的写绕过正常 boundary-check 可写性,改为咨询 state machine:写只在从当前值到提议值有 `Transition` *且* role 对 transition 的 `action`(设置时)有 `actions` 权限时允许。由 `boundary-check.ts` 通过新 `op: { kind: 'transition', objectType, property, from, to }` 强制。

**为什么 per-object 生命周期与 manifest 生命周期分开。** Manifest 生命周期 hooks(§4.5)在 operational *context* 上触发 — session activate、slot change。Object state machines 治理个别 *entities*,可能寿命长且独立于任何 session — Submission 跨多个 ClassroomSession 走 `draft → reviewed`。把两者混淆会逼每个有生命周期的 Object 包在自己的 ManifestDef 中。

---

## 4. Layer 2: Manifest composition

这是核心创新,也是把 `kedge-ontology` 与通用 schema 库区分开来的东西。

### 4.1 Manifest 解决的问题

Flat `ObjectType` 能描述"LessonPlan 是什么"。但不能描述"当老师正在执行一节课时,什么对象在范围内、什么 state 存在、Agent 被允许做什么"。那是*组合 operational context*,是 Agents 实际操作的单位。

Live-lesson backend 一直在临时摸索这个概念:`Lesson.manifestJson`(`solutions/business/live-lesson/backend/src/adapters/persistence/entities/lesson.entity.ts:30-31`)是自由形式 JSON blob;`solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts` 是它的 Zod sanity check。`ManifestDef` 是该模式的形式化。

### 4.2 SlotDef

`Slot` 是 `Manifest` 中的 typed 占位符,在运行时绑到具体对象实例(或实例集合)。

```ts
/**
 * Slot target discriminator. Three forms:
 *  - 'objectType': bind to an ObjectTypeDef instance (the default case).
 *  - 'manifest': nest a child manifest (§9.2 — manifest nesting).
 *  - 'objectSet': bind to an ObjectSetDef (§3.9, Tier 2). Collection-typed
 *    by definition; `SlotDef.collection: true` is implied and need not be set.
 */
export type SlotTarget =
  | { readonly kind: 'objectType'; readonly apiName: string }
  | { readonly kind: 'manifest'; readonly name: string }
  | { readonly kind: 'objectSet'; readonly name: string };

export interface SlotDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly target: SlotTarget;
  /** True = 绑到多个实例;false/undef = 单个实例。 */
  readonly collection?: boolean;
  readonly required?: boolean;
  /**
   * 从另一个 slot 派生本 slot 绑定的 dot-path 表达式,
   * 如 'class.contains'(从 `class` slot 跟随 Class.contains LinkDef)。
   * 由 manifest/resolve.ts 解析。
   */
  readonly derivedFrom?: string;
  /** Agent 推理用的自然语言描述。必填。 */
  readonly semantic: string;
}
```

关键设计决定:

- `target.kind === 'manifest'` 启用 manifest 嵌套(§9.2)。运行时把子 boundaries 组合在父 boundaries 之上。
- `derivedFrom` 避免冗余数据绑定:如果 `class` slot 绑定了,`students` 可以是 `derivedFrom: 'class.contains'`,resolver 跟随 link。
- `required` slots 在未绑定时阻塞 manifest 激活。

### 4.3 StateDef

不属于任何个别对象的 manifest 级 state。Lesson session 中的例子:当前教学阶段、活跃 resource 索引、session 是否暂停干预。

```ts
export interface StateDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * 本 state 字段的 Zod schema。直接用 combinators:
   * `z.enum(['waiting', 'practice', 'discuss'])`、`z.boolean()`、
   * `z.string()`、`z.number().int().min(0)`。Per-state semantic 通过
   * schema 上 `.describe()` 是允许的,但下面的 `semantic`
   * 仍必填(它描述*state changes 何时发生*,这与
   * 单个值意味什么不同)。
   */
  readonly schema: S;
  /** Manifest 激活时的初始值。对 `schema` 类型检查。 */
  readonly initial: z.infer<S>;
  /** 必填 — 本 state 字段意味什么、何时变。 */
  readonly semantic: string;
}

// 单字段例子:
const phaseState = defineStateField({
  apiName: 'phase',
  displayName: '当前阶段',
  schema: z.enum(['waiting', 'listen', 'practice', 'discuss', 'takeaway', 'ended']),
  initial: 'waiting',
  semantic: 'Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter order.',
});
```

关键设计决定:

- State 不用 `objectRef(...)` — state 是值,不是指针。指针放 slots。
- State 字段用 `z.enum([...])` 让 agent 知道有效 transitions 而无需查询 backend;`zod-to-json-schema` 在 §11 中把 enum 暴露给 projected view。
- State 变更通过 `ManifestAccessor.writeState` 走,受 `AccessBoundary` checks 和审计日志管制。

### 4.4 AccessBoundary

声明特定 role 在 manifest 内能看到什么、能做什么。

```ts
/**
 * Manifest 内的逻辑 role。机械映射到现有
 * 平台 roles + scopes — 表见 §10.3。
 */
export type BoundaryRole =
  | 'agent'        // 在 manifest 内操作的 AI agent
  | 'picker'       // @Picker UI 消费者(通常 end-user 驱动)
  | 'admin'        // 平台 / solution admin
  | string;        // Solution 定义的 custom roles 允许

export interface AccessBoundary {
  readonly role: BoundaryRole;
  /**
   * Slot 名字、dot-paths、或 predicate-scoped 条目。'*' 通配符
   * 只对 'admin' role 允许。
   *
   * 接受两种形式(按 gap-analysis G5, Tier 2):
   *  - 路径字符串:'plan' 或 'plan.objective' — 授无条件访问。
   *  - Predicate 条目:{ slot, where } — 只对满足 BoundaryPredicate
   *    的 rows/instances 授访问(见 §5.5)。启用 row-level
   *    安全("agent 只读*本* manifest 的 class 中 Students")。
   */
  readonly readable: readonly BoundaryPathEntry[];
  /**
   * 通常是 readable 的严格子集。Agents 通常只该
   * 写 manifest state,不写底层业务对象。
   * 与 readable 同形状。
   */
  readonly writable: readonly BoundaryPathEntry[];
  /** 本 role 可调的 ActionDef.apiNames。 */
  readonly actions: readonly string[];
  /** 本 role 可订阅的 Streams(StreamDef.apiNames)。 */
  readonly subscribes?: readonly string[];
}

/**
 * AccessBoundary 路径条目。要么无条件路径,要么带
 * row-level predicate 的路径。Predicate sub-language 见 §5.5。
 */
export type BoundaryPathEntry =
  | string
  | {
      readonly slot: string;
      readonly where: BoundaryPredicate;
    };
```

关键设计决定:

- `readable`/`writable` 接受 slot 名字或到属性的 dot-paths。`['plan']` 授整个 `LessonPlan`;`['plan.objective', 'plan.knowledgePoints']` 只授那些。
- `actions` 列出本 role 可调的 `ActionDef`。与 `ActionDef` 自身的 `allowedRoles` 组合,这创造双门:manifest 必须允许它*且* action 必须允许 role。
- `'*'` 通配符只对 `'admin'` 支持,从不该用于 agent 访问 — validators 警告。

### 4.5 LifecycleDef

Manifest 生命周期事件的 hooks,声明为 `ActionDef` apiNames(不是实现)。

```ts
export interface LifecycleDef {
  /** Manifest 实例创建/启动时触发的 ActionDef apiName。 */
  readonly onActivate?: string;
  /** Manifest 实例结束时触发。 */
  readonly onDeactivate?: string;
  /** Slot 绑定变化时触发。 */
  readonly onSlotChange?: string;
  /** Manifest state transitions 时触发。 */
  readonly onStateChange?: string;
}
```

这些引用 `ActionDef` apiNames,不是函数实现。实际执行由实现 `ManifestAccessor` 接口的人处理(通常是 NestJS backend)。

### 4.6 ManifestDef

组合。

```ts
/**
 * Semver 风味的版本字符串。每个 manifest 实例携带它
 * 创建时的 schemaVersion;migrations 是显式的(§9.1)。
 */
export type SchemaVersion = string;

export interface ManifestDef {
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly schemaVersion: SchemaVersion;
  /** 必填 — 本 manifest 作为 operational context 代表什么。 */
  readonly semantic: string;
  readonly slots: readonly SlotDef[];
  readonly streams?: readonly StreamDef[];
  readonly state: readonly StateDef[];
  readonly boundaries: readonly AccessBoundary[];
  readonly lifecycle?: LifecycleDef;
  /**
   * 声明式变更-notification 规则(§4.8, Tier 3, G10)。设置时,
   * 运行时通过现有 notification 子系统(SSE + push)触发;
   * schema 是"何时通知什么"的真源。
   */
  readonly notifications?: readonly NotificationRule[];
  /**
   * 当本 manifest 嵌在另一个内(SlotDef.target.kind ===
   * 'manifest'),父 role 应该传播吗?默认:false(子
   * boundaries 用自己的 role mapping 独立求值)。
   */
  readonly inheritParentRole?: boolean;
}
```

`ManifestDef` 与 `ObjectTypeDef` 一起在 `OntologyRegistry` 中注册。它通过 `apiName` 引用 `ObjectType`。把 `ObjectType` 想成"名词",`ManifestDef` 想成把名词排成可操作 context 的"场景"。

### 4.7 Worked example:完整 `LessonSession` `ManifestDef`

把 §3.6 放在一起:这是真实组合 manifest 长什么样。同样的提醒 — 这住在 `solutions/business/live-lesson/backend/src/ontology/lesson-session.manifest.ts`,不在 ontology 包。

```ts
const LessonSession: ManifestDef = {
  name: 'LessonSession',
  displayName: '课堂会话',
  schemaVersion: '1.0.0',
  semantic:
    'A single in-progress run of a LessonPlan with a specific Class. Composes ' +
    'the static plan + class + resources with the live event stream and runtime ' +
    'phase state. The agent operates within this context to observe and coach.',

  slots: [
    {
      apiName: 'plan',
      displayName: '教学计划',
      target: { kind: 'objectType', apiName: 'LessonPlan' },
      required: true,
      semantic: 'The lesson plan being executed. Bound once at session creation; never reassigned mid-session.',
    },
    {
      apiName: 'class',
      displayName: '班级',
      target: { kind: 'objectType', apiName: 'Class' },
      required: true,
      semantic: 'The class participating. Bound at session creation.',
    },
    {
      apiName: 'students',
      displayName: '学生',
      target: { kind: 'objectType', apiName: 'Student' },
      collection: true,
      derivedFrom: 'class.contains',
      semantic: 'Students enrolled in the bound class. Derived — auto-resolved from `class.contains`, not separately populated.',
    },
    {
      apiName: 'resources',
      displayName: '可用资源',
      target: { kind: 'objectType', apiName: 'Resource' },
      collection: true,
      derivedFrom: 'plan.usesResources',
      semantic: 'Resources embedded in the bound plan. Derived from `plan.usesResources`.',
    },
  ],

  streams: [
    {
      apiName: 'events',
      displayName: '课堂事件流',
      payloadType: 'ClassroomEvent',
      backpressure: 'drop_oldest',
      semantic:
        'Push stream of ClassroomEvent emitted by the GLM-4.7-Flash observation ' +
        'engine as the class progresses. Drop-oldest backpressure: the agent is ' +
        'expected to react to recent events, not replay history.',
    },
  ],

  state: [
    defineStateField({
      apiName: 'phase',
      displayName: '当前阶段',
      schema: z.enum(['waiting', 'listen', 'practice', 'discuss', 'takeaway', 'ended']),
      initial: 'waiting',
      semantic:
        'Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter ' +
        'order. Writable by agent and teacher; advances trigger onStateChange.',
    }),
    defineStateField({
      apiName: 'activeStepId',
      displayName: '当前步骤ID',
      schema: z.string().nullable(),
      initial: null,
      semantic: 'Current readingSteps[].id within the active phase. Null until phase leaves "waiting".',
    }),
    defineStateField({
      apiName: 'pausedForIntervention',
      displayName: '已暂停干预',
      schema: z.boolean(),
      initial: false,
      semantic:
        'True if the session is paused for teacher intervention (e.g. ≥5 students stuck). ' +
        'Writable by agent; teacher can override via dashboard.',
    }),
  ],

  boundaries: [
    {
      role: 'agent',
      readable: ['plan', 'class', 'students', 'resources'],
      writable: ['phase', 'activeStepId', 'pausedForIntervention'],
      actions: ['adjustDifficulty', 'flagForIntervention'],
      subscribes: ['events'],
    },
    {
      role: 'picker',
      readable: ['plan', 'class', 'students', 'resources'],
      writable: [],
      actions: [],
    },
    {
      role: 'admin',
      readable: ['*'],
      writable: ['*'],
      actions: ['*'],
      subscribes: ['events'],
    },
  ],

  lifecycle: {
    onActivate: 'startObservationStream',
    onDeactivate: 'generateSessionReport',
    onStateChange: 'broadcastStateToFrontend',
  },
};
```

这个声明具体给你买到什么:

- **Agent 的 system prompt 自动生成。** §11 把本 manifest projection 为 `system-prompt` markdown 片段,agent 在 session 启动时收到;`solution.json` 中人写的 prompt 缩为"你是 lesson observer" + 行为指南。
- **@Picker 的菜单自动生成。** 老师在本 session 内看到 `plan / class / students / resources` 作为可引用类型,因为 `picker` role 的 `readable` 列出了它们。
- **`writeState('phase', 'practice')` 受治理。** 当 agent(或老师 dashboard)调它,`checkBoundary` 确认 `phase` 在 writer 的 `writable` 列表。无应用代码做此检查。
- **`executeAction('flagForIntervention', { ... })` 受治理两次。** 首先 `checkBoundary` 确认 agent 被允许(`'flagForIntervention'` 在 `actions` 中);然后 `ToolCallerProxy` 强制 `ActionDef.requiredScopes: ['chat']` 并写审计行。Action 的 handler 从不看到未授权调用。

### 4.8 NotificationRule — 声明式变更通知(Tier 3, G10)

今天通知老师手机当 `phase` 变化,要求 handler 代码调 SSE broadcaster、push-notification service,或两者。通知目标是隐式的 — 审查"什么时候通知什么"要求读每个 handler。`NotificationRule` 让它声明式:schema 变成"什么时候触发什么"的真源,运行时通过现有 core notification 子系统 dispatch。

```ts
/**
 * Declarative rule firing when a matched event occurs inside a manifest
 * instance. Evaluated by the runtime after the triggering operation
 * commits (state write succeeds / action succeeds / stream event delivered).
 *
 * Added per gap-analysis G10 (Tier 3).
 */
export interface NotificationRule {
  readonly on: 'stateChange' | 'actionResult' | 'streamEvent';
  readonly match: BoundaryPredicate;
  readonly channel: NotificationChannel;
  readonly semantic: string;
}

export type NotificationChannel =
  | { readonly kind: 'sse'; readonly target: string }
  | { readonly kind: 'push'; readonly target: string }
  | { readonly kind: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };
```

**用法例子。** 当 phase 进入 `practice` 时通知老师手机:

```ts
const LessonSession = defineManifest({
  notifications: [
    {
      on: 'stateChange',
      match: { op: 'eq', path: 'state.phase', value: 'practice' },
      channel: { kind: 'push', target: 'session.teacher.deviceToken' },
      semantic: 'Wake the teacher when class enters practice phase — they ' +
        'should be circulating to observe students working.',
    },
    {
      on: 'actionResult',
      match: {
        op: 'and',
        clauses: [
          { op: 'eq', path: 'action.apiName', value: 'flagForIntervention' },
          { op: 'eq', path: 'action.params.severity', value: 'urgent' },
        ],
      },
      channel: { kind: 'push', target: 'session.teacher.deviceToken' },
      semantic: 'Surface urgent intervention flags as push notifications, ' +
        'not just dashboard updates.',
    },
  ],
});
```

**Validator 规则(§9.7)。** 每个 `match` predicate 的 `PathExpr` 通过合适的 Zod schema 解析(`on: 'stateChange'` 走 state schema、`'actionResult'` 走 action params、`'streamEvent'` 走 stream payload)。每个 `kind: 'named'` channel 名字必须是注册的 NotificationChannel impl。

**为什么不让 handlers 自己调 notifyTeacher()?** 因为那对四个下游消费者不可见:agent(应该知道"如果我以 severity=urgent emit flagForIntervention,老师会被通知")、审计报告("显示 10 月触发的每个 push notification")、隐私 review(需要枚举 per user 的 notification channels)、运维-debug 体验(notification endpoint 上的 404 应该可追溯到 schema 声明的规则,不是隐藏 service 调用)。声明式通知是 schema-as-truth-source 原则(§1.7 原则 5)应用到 side-channels。

---

## 5. Layer 3: Accessor protocols

### 5.1 ManifestAccessor

这是所有消费者实现来与 manifest 实例交互的**接口**。`kedge-ontology` 定义接口;即见 backend 提供实现(通常包装来自 `packages/context-layer` 的 `EntityContextProvider` 和 `ToolCallerProxy`)。

```ts
export interface ManifestAccessor {
  /** Accessor 在其下操作的身份。 */
  readonly role: BoundaryRole;
  readonly manifestName: string;
  readonly manifestInstanceId: string;

  /** 读绑定到 slot 的对象。 */
  readSlot(name: string): Promise<unknown>;

  /** 读 manifest 级 state(支持 dot-path)。 */
  readState(path: string): Promise<unknown>;

  /** 写 manifest 级 state(boundary-checked、audited)。 */
  writeState(path: string, value: unknown): Promise<ActionResult>;

  /** 从 slot 的对象跟随 LinkDef 到相关对象。 */
  traverse(slot: string, link: string): Promise<unknown>;

  /** 列出当前 role 可用的 actions(schema-derived)。 */
  discoverActions(): Promise<readonly ActionDescriptor[]>;

  /** 执行一个 action(boundary-checked,通过 ToolCallerProxy audited)。 */
  executeAction(
    apiName: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult>;

  /** 订阅一个 stream(StreamDef)。Handler 每个事件被调用。 */
  subscribeStream(
    name: string,
    handler: (event: unknown) => void | Promise<void>,
  ): Promise<{ readonly unsubscribe: () => void }>;
}

export interface ActionDescriptor {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly semantic: string;
  /** Agent 的 tool-use API 校验对的同一 Zod schema。 */
  readonly params: z.ZodObject<z.ZodRawShape>;
  readonly sideEffects: readonly string[];
  readonly requiresApproval: boolean;
}
```

关键设计决定:

- 接口全 async。连 `discoverActions()` 都 async,允许在动态 state 上过滤的实现。
- 每次 `writeState` / `executeAction` 调用在到达实现前都经过 `boundary-check.ts`(纯函数)。Boundary check 在包中,不在应用代码。
- `executeAction` 返回 `ActionResult` 带显式 `stateChanges`(改了什么)、`pendingApproval`(如果 action 需要人审)、`auditId`(可追溯性 — 引用 `ToolCallerProxy` 写的现有 `tool_events` 表)。
- **通过 Zod 推断的 typed slot 读。** 具体的 `ManifestAccessor<M>`(其中 `M` 是 `ManifestDef` 实例)可以把 `readSlot(name)` 收窄为 `Promise<z.infer<SlotSchema<M, K>>>`。这是 opt-in — callers 可以保持 `Promise<unknown>` 如果不需要收窄。映射类型住在 `accessor/types.ts`;运行时代价为零(仅 TS)。

### 5.2 boundary-check.ts

纯函数:给定 `ManifestDef`、role、operation,返回 `BoundaryDecision`。这是包内唯一一块运行时逻辑(其它都是 types 和 interfaces)。

当 `AccessBoundary.readable` / `writable` 条目是 predicate-scoped(Tier 2, §4.4 + §5.5),`checkBoundary` 也接收被求值的候选行(通过扩展的 `BoundaryCheckInput` 形状传)并 per row 求 `BoundaryPredicate`。非 predicate 路径条目等同于 `where: { op: 'has', path: '' }` always-true — 对不采纳 predicates 的 Solutions 无行为变更。

```ts
export interface BoundaryCheckInput {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;
  readonly op:
    | { readonly kind: 'read'; readonly path: string }
    | { readonly kind: 'write'; readonly path: string }
    | { readonly kind: 'action'; readonly actionApiName: string }
    | { readonly kind: 'subscribe'; readonly streamApiName: string };
}

export interface BoundaryDecision {
  readonly allowed: boolean;
  /** 拒绝原因(human-readable)。 */
  readonly reason?: string;
  /** 允许且 action 要求时,必须触发 approval 流。 */
  readonly requiresApproval?: boolean;
  /**
   * 当 action 因 preconditions 失败被拒,失败的 predicates
   * 在此列出(每个求值为 false 的 ActionPrecondition 一条)。
   * 用于 discoverActions() 渲染"available actions"过滤 + 用于
   * projected semantic view 解释*为什么*一个 action 当前不可调。
   *
   * 按 gap-analysis G2(Tier 1)添加。
   */
  readonly unmetPreconditions?: readonly string[];
}

export function checkBoundary(input: BoundaryCheckInput): BoundaryDecision;
```

被使用:

- NestJS backend 在执行操作前(`ToolCallerProxy` 桥把 `checkBoundary` 加到其 permission 步骤)。
- Vue/React 前端显示/隐藏 UI 元素(`@Picker` 只显示 traversable slots 和 pickable 类型)。
- Agent runtime 过滤 `discoverActions()`。

### 5.3 ActionResult

任何 state-mutating 调用(`writeState`、`executeAction`)的结构化结果。

```ts
export interface ActionResult<R = unknown> {
  readonly success: boolean;
  readonly stateChanges: readonly StateChange[];
  /**
   * Typed 返回值,对 `ActionDef.returnType` 解析(Tier 3, G11)。
   * 仅声明 returnType 的 Actions 存在;纯 state-mutators 留它 undefined
   * 且消费者读 `stateChanges`。调用点推断类型:`z.infer<typeof actionDef.returnType>`。
   */
  readonly returnValue?: R;
  /** Action 要求 commit 前人审时设置。 */
  readonly pendingApproval?: string;
  /** 引用 ToolCallerProxy 写的现有 tool_events 审计行。 */
  readonly auditId: string;
  readonly error?: { readonly code: ActionErrorCode; readonly message: string };
}

export interface StateChange {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export type ActionErrorCode =
  | 'boundary_denied'
  | 'validation_failed'
  | 'pending_approval'
  | 'handler_error'
  | 'tool_not_found';
```

`ActionErrorCode` 是 `packages/backend/src/tool-caller/types.ts` 中 `ToolResult` 失败 codes 的故意超集,加两个 ontology-专属(`boundary_denied`、`pending_approval`)。

### 5.4 参考实现骨架(NestJS,solution 端)

`ManifestAccessor` 接口住在本包;具体实现住在 `packages/backend/src/ontology/`(按 ADR-0001 它也不能住在 solution backend,因为到 `ToolCallerProxy` 的桥需要 core-package 访问)。Solution backends 注入这个 service 并传 manifest 实例 ID。

```ts
// packages/backend/src/ontology/default-manifest-accessor.service.ts
@Injectable()
export class DefaultManifestAccessor implements ManifestAccessor {
  constructor(
    private readonly registry: OntologyRegistry,           // 来自 @kedge-agentic/ontology
    private readonly proxy: ToolCallerProxyService,        // 现有
    private readonly entityCtx: EntityContextProvider,     // 现有 — 来自 context-layer
    private readonly sessionMeta: SessionMetadataService,  // 现有 — per session KV
    private readonly auditSink: ToolCallAuditSink,         // 现有
  ) {}

  readonly role: BoundaryRole;
  readonly manifestName: string;
  readonly manifestInstanceId: string;

  async readSlot(name: string): Promise<unknown> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'read', path: name },
    });
    if (!decision.allowed) throw new BoundaryDeniedError(decision.reason);

    const slot = manifest.slots.find((s) => s.apiName === name);
    if (!slot) throw new Error(`Unknown slot: ${name}`);

    if (slot.derivedFrom) return this.resolveDerived(slot);

    const binding = await this.sessionMeta.get(this.manifestInstanceId, `slot:${name}`);
    if (!binding) return slot.collection ? [] : null;
    return this.entityCtx.getContext(binding as string, this.role);
  }

  async writeState(path: string, value: unknown): Promise<ActionResult> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'write', path },
    });
    if (!decision.allowed) {
      return failureResult('boundary_denied', decision.reason ?? 'denied');
    }

    const before = await this.sessionMeta.get(this.manifestInstanceId, `state:${path}`);
    await this.sessionMeta.set(this.manifestInstanceId, `state:${path}`, value);

    const auditId = await this.auditSink.record({
      sessionId: this.contextSessionId(),
      solutionId: this.contextSolutionId(),
      actingUserId: this.contextActingUserId(),
      tool: `__manifest_state_write:${this.manifestName}:${path}`,
      strippedFields: [],
      outcome: 'ok',
      argsRedacted: { path, value },
      startedAt: Date.now(),
      durationMs: 0,
    });

    return {
      success: true,
      stateChanges: [{ path, before, after: value }],
      auditId,
    };
  }

  async executeAction(apiName: string, params: Record<string, unknown>): Promise<ActionResult> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'action', actionApiName: apiName },
    });
    if (!decision.allowed) {
      return failureResult('boundary_denied', decision.reason ?? 'denied');
    }
    if (decision.requiresApproval) {
      const approvalId = await this.requestApproval(apiName, params);
      return { success: false, stateChanges: [], pendingApproval: approvalId,
               auditId: '', error: { code: 'pending_approval', message: 'awaiting human approval' } };
    }

    // 交给 ToolCallerProxy — 这是 §10.2 的桥。
    // Proxy 的 6 步 pipeline(sanitize / validate / permission /
    // inject / dispatch / audit)做剩下的,包括写
    // 成为我们 auditId 的 tool_events 行。
    const result = await this.proxy.invoke(
      { tool: this.qualifyToolName(apiName), args: params },
      this.executionContext(),
    );

    if (!result.ok) {
      return failureResult(result.code as ActionErrorCode, result.reason);
    }
    return {
      success: true,
      stateChanges: this.extractStateChanges(result),
      auditId: this.proxy.lastAuditId,
    };
  }

  // ...readState、traverse、discoverActions、subscribeStream 简洁起见省略。
}
```

要注意的事:

- **`DefaultManifestAccessor` 在实例上携带 `role`、`manifestName`、`manifestInstanceId`**,不是每个方法调用都传。Per session-x-role 配对构造一个;传给 agent handlers。
- **Slot 读总是通过 `EntityContextProvider`** — 不重造轮子。Provider 已经知道如何按 id 给 role 加载 entity;我们只加 boundary check。
- **State 写用 `SessionMetadataService`**(core 中现有的 per-session KV)。对大多数 manifests,state 舒适地适配 256 KB/session 预算。带更大 state 的 Solutions 可以替换自己的 provider。
- **Action 执行交给 `ToolCallerProxy`** 不变。Ontology 包不重新实现 sanitize/validate/audit;它在现有 pipeline 前面插入新 `boundary_denied` 门。
- **生命周期 hooks**(`onActivate`、`onDeactivate`、`onStateChange`、`onSlotChange`)通过同一 `executeAction` 路径触发 — 运行时在 session 启动时简单调 `executeAction(manifest.lifecycle.onActivate!, {})`。所以 hooks 免费继承治理 + 审计。
- **Redaction pipeline**(Tier 3, G12):当 `readSlot` 返回对象,accessor walk `ObjectTypeDef.meta` 对每个可读属性,如果 role 在 `redaction.roles` 中就应用 `redaction.strategy`。`mask` 用模板替换(按 Zod 类型默认);`hash` 用 sha256(value) 替换保留相等;`omit` 从返回对象删除属性。Redaction 在 boundary check 后、返回前跑 — 所以被允许 reader 仍看到*masked* 值而不是无,这对推理字段存在性的下游代码重要。
- **Notification dispatch**(Tier 3, G10):每次成功 state 写或 action 执行后,运行时求值 `ManifestDef.notifications`;对每个匹配规则,调 channel 的 dispatch handler(`sse`/`push` 内置;`kind: 'named'` 通过 registry 解析)。Dispatch 失败 logged 但不回滚触发操作 — 通知是 best-effort,不是事务性。

### 5.5 BoundaryPredicate — 共享 predicate sub-language

三个原语(`AccessBoundary` §4.4、`ObjectSetDef.filter` §3.9、`ActionDef.preconditions` §3.3)都需要小 predicate 语言。包不做三个独立设计,而是定义一个 `BoundaryPredicate` 形状到处复用。按 gap-analysis Open Question #3,语言故意**first-order**:无函数调用、无量词、无 fixpoint iteration。更丰富逻辑通过 `'named'` 形式逃生,dispatch 到注册在 `OntologyRegistry` 的 `Predicate`。

```ts
/**
 * 对 (a) 请求者的 ExecutionContext、(b) 被求值的 slot 或 row、
 * (c) manifest state 的 first-order predicate。
 *
 * 被使用:
 *  - AccessBoundary path entries(row-level 安全)— §4.4
 *  - ObjectSetDef filters — §3.9(SetFilter 是结构子集)
 *  - ActionDef preconditions(kind: 'named' 逃生通道)— §3.3
 *
 * 按 gap-analysis G5(Tier 2)添加。
 */
export type BoundaryPredicate =
  | { readonly op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; readonly path: PathExpr; readonly value: PredicateValue }
  | { readonly op: 'in'; readonly path: PathExpr; readonly values: readonly PredicateValue[] }
  | { readonly op: 'has'; readonly path: PathExpr }
  | { readonly op: 'and' | 'or'; readonly clauses: readonly BoundaryPredicate[] }
  | { readonly op: 'not'; readonly clause: BoundaryPredicate }
  | { readonly op: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

/**
 * 带 discriminant 前缀指示其 root 的 path 表达式:
 *  - 'ctx.actingUserId' → ExecutionContext.actingUserId
 *  - 'row.engagementScore' → 被求值 row 上的字段
 *  - 'state.phase' → 路径 'phase' 处的 manifest state
 *  - 'slot.<slotName>.<...>' → traverse 进绑定 slot
 *
 * 无前缀的裸路径被解释为 'row.'(常见情况)。
 */
export type PathExpr = string;

export type PredicateValue = string | number | boolean | null;
```

**Row-level boundary 的 live-lesson 例子。** `LessonSession` 的 `agent` boundary 今天读:

```ts
{ role: 'agent', readable: ['students', 'events'], ... }
```

G5 后,同一意图 — "agent 只读本 session class 中学生的事件" — 编码为:

```ts
{
  role: 'agent',
  readable: [
    'students',
    {
      slot: 'events',
      where: {
        op: 'in',
        path: 'row.student.id',
        values: ['__derived_from_slot:students.id'],  // 求值时解析
      },
    },
  ],
}
```

运行时 `checkBoundary` 解析 slot-derived 值集,per row 求 predicate,只返回匹配行。Agent 从不看到 session 名单之外的事件 — 主张在 schema 中,不是 handler 代码。

**跨原语复用。** `ObjectSetDef.filter` 结构上是 `BoundaryPredicate` 的子集(初始无 `'named'` 分支;可扩展)。`ActionPrecondition.kind: 'named'` 与 `BoundaryPredicate.op: 'named'` dispatch 到同一 `Predicate` registry。用 `registerPredicate('isInPracticePhase', impl)` 注册的一个 predicate 同时可作为 Action precondition 和 ObjectSet filter — 单一真源。

**为什么 first-order。** Turing-完备的 predicate sub-language 带真实代价:sandbox 关切、求值-资源限制、debug 困难、对 LLM 推理不透明。First-order 对 80% 情况够;`'named'` 形式用 code-reviewed 实现覆盖其余。把语言提升到更丰富语义需要 ADR;按 gap-analysis §5 Q3 我们在这里明确谨慎。

**通过 Zod 解析 path。** 每个 `PathExpr` 通过三个 Zod schemas 之一解析 — row 的 `ObjectType.schema`(对 `row.<field>`)、manifest 的 state 字段 schema(对 `state.<field>`)、或绑定 slot 的 schema(对 `slot.<name>.<field>`)。解析 walk `.shape` 拒绝最终段不存在的路径或中间段不 traverse `z.object` 的路径。这在任何使用 predicate 的 `ManifestDef` / `ObjectSetDef` / `ActionDef` 注册时强制 — 坏路径永远到不了运行时。

**Registry hook。** `OntologyRegistry.registerPredicate(name: string, impl: PredicateImpl): void`。`PredicateImpl` 是函数 `(ctx: PredicateEvalContext, params?) => boolean`。晚注册的 predicates(在引用它们的 `ManifestDef` 已经注册之后)触发 re-validation pass 且可能抛 `RegistrationError` 如果引用的 schema 现在无效 — 与 §9.7 同样的 fail-fast 哲学。

---

## 6. 跨切面:Registry

Registry 是所有 `ObjectTypeDef` 和 `ManifestDef` 的查找表,以及 schema 分发的真源(§9.6)。

```ts
export class OntologyRegistry {
  // Core 注册
  registerObjectType(def: ObjectTypeDef): void;
  registerManifest(def: ManifestDef): void;
  registerFunction(def: FunctionDef): void;          // Tier 1 (§3.7)
  registerInterface(def: InterfaceDef): void;        // Tier 2 (§3.8)
  registerObjectSet(def: ObjectSetDef): void;        // Tier 2 (§3.9)
  registerPredicate(name: string, impl: PredicateImpl): void;  // Tier 2 (§5.5)

  // Core 查找
  getObjectType(apiName: string): ObjectTypeDef | undefined;
  getManifest(name: string): ManifestDef | undefined;
  getFunction(apiName: string): FunctionDef | undefined;
  getInterface(name: string): InterfaceDef | undefined;
  getObjectSet(name: string): ObjectSetDef | undefined;
  getPredicate(name: string): PredicateImpl | undefined;

  /** 所有有 picker config 的 ObjectTypes(给 @Picker 根菜单)。 */
  getPickableTypes(): readonly ObjectTypeDef[];

  /** 一个类型上所有标记 traversable 的 links。 */
  getTraversableLinks(typeName: string): readonly LinkDef[];

  /** 哪些 manifests 把这个类型作为 slot 包含("这个在哪用?")。 */
  getManifestsForType(typeName: string): readonly ManifestDef[];

  /**
   * 所有声明 `implements: [..., interfaceName, ...]` 的 ObjectTypes。
   * 在注册时解析(Open Question #2 — registration-time
   * dispatch);需要运行时多态的 Solution 用 custom resolver 覆盖
   * 本方法。
   *
   * 按 gap-analysis G4(Tier 2)添加。
   */
  getImplementersOf(interfaceName: string): readonly ObjectTypeDef[];

  /** 由给定 ObjectType 支撑的所有 ObjectSets(给跨 set introspection)。 */
  getObjectSetsForType(typeName: string): readonly ObjectSetDef[];

  /**
   * 跨所有注册 ObjectTypes 携带给定 classification tag 的所有
   * 属性(Tier 3, G9)。驱动 compliance 报告如
   * "列出 Solution X 可访问的每个 PII 字段。"
   * 返回 `{ objectType, fieldKey, meta }` 元组。
   */
  getPropertiesByClassification(tag: Classification): readonly Array<{
    readonly objectType: string;
    readonly fieldKey: string;
    readonly meta: PropertyMeta;
  }>;

  /** 注册命名 NotificationChannel impl(Tier 3, G10)。 */
  registerNotificationChannel(name: string, impl: NotificationChannelImpl): void;
  getNotificationChannel(name: string): NotificationChannelImpl | undefined;

  /**
   * 把 `displayName: LocalizedString` 为给定 locale 解析为具体字符串,
   * 按设计原则 6(§1.7)fallback。
   * 按 gap-analysis G3(Tier 1)添加。
   */
  getDisplayName(def: { displayName: LocalizedString }, locale?: string): string;

  /**
   * Per-property display label resolver。如果设置 `meta[fieldKey].displayName`,
   * 返回它;否则 fallback 到字段的 Zod `.description` 文本;
   * 最终 fallback 到字段 key 本身。被 projected
   * semantic view(§11)和 @Picker 使用。
   */
  getFieldDisplayName(objectType: string, fieldKey: string, locale?: string): string;

  /**
   * 注册 schema 的稳定 content-hash。驱动
   * GET /api/v1/ontology/schema ETag header(§9.6)。
   *
   * 以任何顺序注册同一组 defs 的两个 registries
   * 必须产生相同 digest。实现:通过
   * `zod-to-json-schema`(跨 Zod 版本稳定)规范化 Zod schemas,
   * 与按 apiName/name 排序的非 schema defs concat,sha256。
   * Predicate *names* 被 hash;predicate impl bodies 不
   * (它们住代码,不是 schema)。
   */
  getSchemaDigest(): string;
}
```

Registry 每进程实例化一次并共享。Solution backends 在 startup 填充它(与今天 `SolutionToolkitRegistry.register()` 同一生命周期 — 见 `packages/backend/src/tool-caller/solution-toolkit-registry.ts`)。

注册是**validating** — 每次 `register*()` 调用跑完整 `src/schema/validators.ts` 套件(§9.7)并在第一次违反时抛。这是让 schema 治理主张可信的门。

### 6.1 Solution boot 时注册长什么样

模式:每个 solution 的 `*.module.ts` 调 `OnModuleInit.onModuleInit()`,先注册 ObjectTypes(使 manifests 可以引用它们),后注册 manifests。

```ts
// solutions/business/live-lesson/backend/src/ontology/ontology.module.ts
@Module({
  imports: [/* …现有… */],
  providers: [LessonSessionAccessor /* …现有 services… */],
})
export class OntologyModule implements OnModuleInit {
  constructor(private readonly registry: OntologyRegistry) {}

  onModuleInit() {
    // 顺序要紧:ObjectTypes 在引用它们的 ManifestDefs 之前,
    // 子 manifests 在父 manifests 之前(如果你按 §9.2 用嵌套)。
    try {
      this.registry.registerObjectType(LessonPlan);
      this.registry.registerObjectType(Class);
      this.registry.registerObjectType(Student);
      this.registry.registerObjectType(Resource);
      this.registry.registerObjectType(ClassroomEvent);
      this.registry.registerManifest(LessonSession);
    } catch (err) {
      if (err instanceof RegistrationError) {
        // 不要吞下 — 坏 schema 必须响亮地 fail boot,使 dev 在
        // 客户之前抓到它。
        Logger.error(`[ontology] registration failed: ${err.toString()}`);
        throw err;
      }
      throw err;
    }
  }
}
```

Validator 在这一刻抓什么(代表性 — 完整列表在 §9.7):

| 违反 | 例子 | 何时抓 |
|---|---|---|
| `refTarget` 未注册 | `LessonPlan.targetClass` 说 `target: 'Class'` 但 `Class` 从未注册 | 悬空引用之后的第一次 `registerManifest`/`registerObjectType` 调用 |
| `derivedFrom` 路径无效 | `students` slot 说 `derivedFrom: 'class.containz'`(typo) | `registerManifest(LessonSession)` |
| AccessBoundary 引用未知 slot | `agent` boundary 说 `actions: ['adjustDifficultie']` | `registerManifest(LessonSession)` |
| 空 `semantic` | 任何带 `semantic: ''` 的原语 | 匹配的 `register*` 调用 |
| 循环 link 链 | `A.next → B`、`B.next → C`、`C.next → A` 全 `cardinality: '1:1'` | 周期中最后一个的 `registerObjectType` |
| 非 admin role 上的 `'*'` 通配符 | `agent` boundary 写 `readable: ['*']` | `registerManifest` |

`RegistrationError` 携带失败引用(slot 名字、link apiName 等)和触发的规则,所以 boot log 直指坏声明。

---

## 7. 跨切面:Semantic projection

本模块回答:**Agent 怎么"看"一个 manifest?**

当 Agent 进入 manifest context,它不收到原始 TypeScript 类型。它收到一个 projected view:LLM 消费用的可用东西的结构化描述。`semantic/project.ts` 接 `ManifestDef` + role 并产 `ProjectedManifest`;`semantic/formats/` 中的 sub-formatters 把它渲染为具体消费形状。

```ts
export type ProjectionFormat =
  | 'anthropic-tools'      // Claude Code 的 Tool-use JSON schema
  | 'system-prompt'        // 内联到 system prompts 的 Markdown 片段
  | 'mcp-tools';           // ToolCallerProxy 的 MCP tool descriptors

export interface ProjectedManifest {
  readonly summary: string;
  readonly readableSlots: readonly ProjectedSlot[];
  readonly writableState: readonly ProjectedState[];
  readonly availableActions: readonly ActionDescriptor[];
  readonly subscribableStreams: readonly ProjectedStream[];
}

export function projectManifest(
  manifest: ManifestDef,
  registry: OntologyRegistry,
  role: BoundaryRole,
  format: ProjectionFormat,
): unknown; // 形状取决于 format — 见 §11 例子
```

**Pipeline(Zod-first 修订)。** 对每个 role-readable slot,projector:

1. 解析 slot 的 `ObjectType` 并读其注册的 Zod `schema`。
2. 把 schema 跑过 `zod-to-json-schema` 得到结构 JSON Schema(字段名、类型、enum 值、format 约束)。
3. 对 per-field `semantic` 文本,walk schema 的 `.shape` 读每字段的 `.description`(通过 `z.string().describe('...')` 设置)。
4. 对 picker / 治理 hints(`searchable`、`displayRole`、`computed`),读 `ObjectType.meta` sidecar。
5. 组合 (1)+(2)+(3) 进 per-slot `ProjectedSlot` 条目 — 结构 + 语义 + 呈现一形状中。

对每个 role-callable action,同一 pipeline 跑 `ActionDef.params` — action 的参数 schema 是 `z.object()`,所以 `zod-to-json-schema(actionDef.params)` 直接产 JSON Schema(这正是 `ToolCallerProxy` 解析对的 schema,所以 agent 看到的与被校验的匹配)。对 `FunctionDef`,`params` 和 `returnType` 同样对待。

对 state 和 streams,同样:Zod 给结构,`.describe()` 给 per-field 语义,无 meta sidecar(state 和 streams 无呈现层)。

包提供数据;消费 Agent runtime 决定如何组装它进最终 prompt 或 tool list。§11 中具体 worked examples。

---

## 8. 各片如何连接 — lesson session 例子

这不是规定性 domain 建模。这是包原语如何组合的图示。(交叉引用:live-lesson 现有的 `manifestJson` + `manifest.schema.ts` + `board-data.js` 是本预-形式化版本。)

### 场景

老师启动一节课。Agent 需要观察班级、调节奏、建议干预。@Picker 需要让老师在课间引用 resources 和 students。

### 什么被定义(由 live-lesson solution,不是 kedge-ontology)

1. **ObjectTypeDefs** for `LessonPlan`、`Resource`、`Class`、`Student`、`ClassroomEvent` — 各带 properties、links、actions、picker config。这些是 domain-specific 住在应用层。
2. **一个 ManifestDef** 叫 `LessonSession`,把上面组合进 operational context:
   - Slots 绑定具体 plan、class、resources、students。
   - `StreamDef` `events` 包装 GLM 课堂观察事件流(§9.3)。
   - State 追踪执行阶段、活跃 resource、暂停 flags。
   - `AccessBoundary` 定义观察 Agent 能看什么、做什么。
   - 生命周期 hooks 触发观察启动/停止和报告生成。
3. **Registry 填充** 在 solution startup — 所有 `ObjectType` 和 `ManifestDef` 注册。`ActionDef` 自动在 `SolutionToolkitRegistry` 注册为 `ToolDefinition`。

### 运行时发生什么

1. 老师启动一节课 → backend 创建一个 manifest 实例,填充必需 slots(plan、class),解析 derived slots(从 `class.contains` 的 students)。
2. @Picker 基于 `ObjectTypeDef.picker.crossManifestSources` 和 traversable links 渲染可用 references — 老师可以在本 session context 内 `@` 一个 student 或一个 resource。
3. Agent runtime 通过 `ManifestAccessor` 加载 manifest:
   - 读 projected semantic view 理解发生什么。
   - 订阅 `events` stream(GLM 观察层的 ClassroomEvent stream)。
   - 基于事件决定是 `writeState('phase', 'practice')` 还是 `executeAction('adjustDifficulty', { ... })`。
   - 所有操作经过 `checkBoundary`;所有 action 调用流过 `ToolCallerProxy` 产生 `tool_events` 审计记录。
4. 课结束 → 生命周期 `onDeactivate` 触发 → 生成 summary。

### kedge-ontology 提供什么 vs 应用提供什么

| 关切 | `kedge-ontology`(包) | 即见应用 |
|---|---|---|
| 类型定义 | `LinkDef`、`ActionDef`、`ObjectTypeDef`、`FunctionDef`、`StreamDef`、`InterfaceDef`、`ObjectSetDef`、`PropertyMeta` + Zod re-export | 教育 domain 的具体 `ObjectTypeDef`(在 solution backends)— 每个拥有 Zod schema + sidecar meta |
| Composition model | `SlotDef`、`StateDef`、`AccessBoundary`、`ManifestDef` | 具体 `ManifestDef`(`LessonSession` 等) |
| Access protocol | `ManifestAccessor` interface、`checkBoundary` | `ManifestAccessor` impl(NestJS service 包装 `ToolCallerProxy` + `EntityContextProvider`) |
| Discovery | `OntologyRegistry` interface + impl | Solution startup 时的注册调用 |
| Agent 集成 | Semantic projection 工具 | Agent 框架 + prompt engineering |
| 数据持久化 | 无 | 数据库、事件流、文件存储 |
| UI 组件 | 无 | `context-layer-react` 中的 `@Picker` |

### 8.5 端到端 trace:一次 `flagForIntervention` 调用

一个 agent action 的具体请求/响应 trace,从观察到审计行。帮锚定抽象。

**Setup**:lesson session `code=HX3KM7` 活跃。`phase='practice'`。Agent 已订阅 `events` stream 4 分钟。

1. **观察事件到达。** GLM-4.7-Flash 发出 `ClassroomEvent { kind: 'submit', student: 'stu_42', payload: { correct: false, attempt: 3 } }`。观察 engine 把它写到 live 事件 channel。
2. **Agent 通过 stream 订阅收到。** `ManifestAccessor.subscribeStream('events', handler)` 在 session 激活时设置。Handler 把事件投递到 agent 的 tool-use context。
3. **Agent 推理 + 调 action。** 读 projected `system-prompt` 片段(从 §11.3 生成给 `agent` role),它知道 `flagForIntervention` 存在并取 `{ reason, severity }`。它判定这是第三次错答并发出 action 调用。
4. **桥拦截。** `actionToToolDefinition` 把 `flagForIntervention` 注册为 live-lesson toolkit 下的 `ToolDefinition`。Agent 的调用命中 `ToolCallerProxyService.invoke({ tool: 'student.flagForIntervention', args: {...} }, executionContext)`。
5. **Step 1(sanitize)。** `sanitizeArgs` 剥离 agent 可能试图注入的任何 reserved 字段(如 `__solutionId`、`__actingRole`)。本次调用没剥任何。
6. **Step 2(validate)。** `argsSchema.parse(cleaned)` 跑从 `ActionDef.params` 生成的 Zod schema。`{ reason: '...', severity: 'urgent' }` 通过;`severity: 'critical'` 会以 `severity: Invalid enum value` 失败。
7. **Step 3(ontology boundary check — 新)。** 桥 handler 调 `checkBoundary({ manifest: LessonSession, role: 'agent', op: { kind: 'action', actionApiName: 'flagForIntervention' } })`。`LessonSession.boundaries[role='agent'].actions` 包含 `flagForIntervention`,所以 `allowed: true`。(如果 agent 在 role `picker` 下绑定,这会返回 `allowed: false, reason: 'agent action denied for role picker'`,step 4 永不跑。)
7b. **Step 3.5(precondition 求值 — Tier 1,按 gap-analysis G2)。** 同一 `checkBoundary` 调用求 `flagForIntervention.preconditions`。对本 action 唯一 precondition 可能是 `{ kind: 'slotBound', slot: 'class' }` — 在 session 创建时绑定,满足。如果调的是 `adjustDifficulty` 带 `{ kind: 'stateEquals', path: 'phase', value: 'practice' }`,而当前 phase 是 `'discuss'`,`checkBoundary` 会返回 `{ allowed: false, unmetPreconditions: ['phase must equal "practice"'] }`,step 8 永不跑。重要:本门*只*对通过 ontology 桥注册的 ActionDef-derived tools 跑;无 `ActionDef` 的 legacy MCP tools 跳过它(对 live-lesson 现有 `emit_*_card` 在 Phase 3 迁移它们之前无行为变更)。
8. **Step 4(context 注入)。** Handler 收到 `ToolInvocation { tool: 'student.flagForIntervention', args: { reason, severity }, context: ExecutionContext { solutionId, sessionId, actingUserId, ... } }`。Agent *永*不可能自己设置那些 context 字段。
9. **Step 5(dispatch)。** Solution 端 action handler(如 `StudentService.flagForIntervention(args, context)`)跑。它写一行 `StudentAlert` 到 live-lesson DB,广播 SSE `student_alert` 事件给老师 dashboard,返回 `{ ok: true, content: [{ type: 'text', text: '已标记' }] }`。
10. **Step 6(audit)。** `ToolCallerProxyService.audit()` 写一条 `ToolCallAuditEntry` 到 `tool_events` 表:
    ```text
    sessionId      = sess_abc123
    solutionId     = live-lesson
    actingUserId   = teacher_zhang
    tool           = student.flagForIntervention
    strippedFields = []
    outcome        = ok
    argsRedacted   = { reason: '...', severity: 'urgent' }
    startedAt      = 1714449900123
    durationMs     = 47
    ```
    因为 `ActionDef.auditLevel === 'log'`,无 diff payload 附上。(如果是 `'full_diff'`,writer 还会持久化 handler 期间任何 state mutations 的 `stateChanges`。)
11. **结果回到 agent。** Proxy 返回 `{ ok: true, content: [{ type: 'text', text: '已标记' }] }`。Agent 的 tool-use loop 用下个事件继续。

全程,agent 的面保持 `{ tool, args }`。身份、role、audit-id、state-change 记录 — 全部平台断言。三个独立门保护调用(sanitize、validate、boundary-check),第四个(proxy 的 `requiredPermissions`-stub-成为-真)在 permission engine 跟上时落地。

### 8.6 Before / after:当一节课变成 operating context 时变了什么

本小节通过对比今天的教育-IT 系统与 ontology-driven LessonSession 不同来让 §1.4 semantic-vs-kinetic 区别具体 — 不是在它们存什么,而在 agent(和人工老师)实际能*做*什么。

| 能力 | 今天的教育-IT 系统(仅 semantic) | 带 kinetic 层的 LessonSession |
|---|---|---|
| **知道这节课存在** | 是 — DB row、dashboard tile、报表 | 是 — `ObjectTypeDef LessonPlan` + `Class` 注册 |
| **读静态事实** | 是 — 查 lesson plan、roster、schedule | 是 — `readSlot('plan')`、`readSlot('class')`、`readSlot('students')` |
| **实时观察班级** | 也许 — 如果有人建了 custom dashboard。Agent 无访问。 | **一等** — `subscribeStream('events')` 投递 ClassroomEvent push notifications;agent 对每个事件反应 |
| **知道我们在课的哪里** | 带外 — 老师心智模型,或硬编码 handler 逻辑 | **State 字段** — `readState('phase')`、`readState('activeStepId')`;读经过 `checkBoundary` |
| **记录观察/判断** | Custom service 调用、custom DB 写、临时审计(或无) | **`writeState`** — boundary-checked、audit-logged,无第二路径 |
| **触发干预** | Custom handler 决定谁可调、需什么 scopes、是否要老师 approval | **`executeAction('flagForIntervention', {...})`** — `ActionDef.allowedRoles` + `requiredScopes` + `preconditions` + `requiresApproval` 全声明;`ToolCallerProxy` 强制 |
| **审计 agent 行为** | 散乱 — 取决于每个 handler 是否记得 log | **通用** — per action 一行 `tool_events`;`auditLevel: 'full_diff'` 扩展到 before/after state |
| **加新 agent capability** | 新 service 方法 + 新 dashboard 接线 + 新 audit hook + 新权限规则 | **一个 `defineAction({...})`** — registry 在 boot 校验;桥自动生成 `ToolDefinition`;projection 自动暴露给 agent |

右列不是"左列加更多 features 拴上"。它是不同*种*系统:operational 层*是* schema,agent 是 operational 层的参与者(不是 exported view 的消费者),观察与 action 的边界坍缩为一个治理契约。

这就是 §1.4 叫"看到和做到之间的鸿沟"的区别。对只需要左列的 Solutions,现有 live-lesson `manifest.json` + service-method-per-feature 模式好。对 agent 需要作为真实参与者的 Solutions — "agent 不应能做 X" 是*安全属性*而不是*希望未实现行为* — 右列是唯一诚实答案,这是本包存在为之启用的。

---

## 9. 设计决定 *(以前的"open questions" — 现已解决)*

七个都在 2026-05-29 设计 pass 锁定。每个带其决定、考虑的备选、为什么。

### 9.1 Schema 版本化

**决定**:每实例不可变。每个 manifest 实例携带它创建时的 `schemaVersion`。Registry 暴露 `migrateInstance(name, fromV, toV)` 作为显式 opt-in 操作返回 `MigrationPlan`;运行时从不静默升级。

**为什么**:教育局审计需要可复现。6 个月前记录的实例 state 今天必须可对同一 schema 重放。Live-migration 是诱人 shortcut,会静默使旧审计 trails 无效 — debug 比显式 migration 代价贵。

### 9.2 Manifest 嵌套

**决定**:允许。`SlotDef.target` 是接受 `{ kind: 'objectType' }` 或 `{ kind: 'manifest' }` 的区分联合。Boundary check 组合:子 role 默认*拒绝*,除非子 manifest 声明 `inheritParentRole: true`。

**为什么**:SemesterPlan / multi-LessonSession composition 是近期需求(教育客户计划在 2026 年底之前做学期级 dashboards)。默认 hermetic 保护审计清晰度;显式 opt-in 保留便利情况。

### 9.3 事件语义

**决定**:一等。新 `StreamDef` 原语(在 `ManifestDef` 级别,`SlotDef` 的兄弟)。Streams 暴露 subscribe-only 契约;`ManifestAccessor` 获得 `subscribeStream(name, handler)`。Streams *不是* slots。

**为什么**:GLM 课堂观察流是 push,不是 pull — 建模为 `collection: true` slot 会误导 Agent 推理延迟、backpressure、replay 语义。独立原语阻止该混淆。

### 9.4 跨 manifest references

**决定**:默认限制、opt-in。`ObjectTypeDef.picker` 声明 `crossManifestSources: ('parent' | 'sibling' | 'all')[]` 给邻近 manifests 的 @Picker 可见性。Agent 操作仍 hermetic — 无论声明如何,从不跨 manifest 写。

**为什么**:教育场景需要"这个学生先前 lesson 的历史"在 picker 中可用,但写隔离必须为审计保持(lesson A 中的 Agent 必须从不静默 mutate 从 lesson B 视角看到的 Student 对象)。

### 9.5 Action composition

**决定**:是,声明。`ActionDef` 有可选 `composes: readonly string[]` 列出它传递性调用的其它 action apiNames。每个 sub-action 在执行时通过自己的 `checkBoundary` + `ToolCallerProxy` validation;composition 是透明的。

**为什么**:Agent 必须传递性地推理 side effects。隐藏 composition 破坏 discovery model — Agent 以为 `adjustDifficulty` 是只读因为表面 ActionDef 这么说,但它实际下面调 `insertResource`,可以采取 schema 看起来禁止的 actions。

### 9.6 Schema 分发

**决定**:运行时通过 REST + ETag。新 `GET /api/v1/ontology/schema` endpoint 用从 `getSchemaDigest()` 派生的 `ETag` header 服务 `serializeRegistry()` 输出。前端 + Agent 在 session 启动时 fetch;`If-None-Match` 短路未变 schemas。

**为什么**:"schema 是数据"原则和现有 solution 热重载(`solutions/business/demo-sandbox/.../solution-register.service.ts` 已经 watch 磁盘上 `skills/` 并在文件变更时 re-register)都对抗 build-time bundling 故事。带内容-hash 缓存的运行时分发给我们动态注册的新鲜度,无需为每个请求付。

### 9.7 Validation 深度

**决定**:最大,在注册时。`src/schema/validators.ts` 强制(Zod-first 修订):

*Zod 本身处理* — 字段类型、required vs optional、enum 值有效性、数值范围约束、字符串 format 约束。我们不重复这些 checks;如果 Zod schema parses,它就 parses。

*Validator 强制的 Ontology 层规则*:

- `LinkDef` 链或 `SlotDef.derivedFrom` 路径中无循环 refs。
- 所有 `LinkDef.target` / `SlotDef.target` 引用解析到注册 ObjectTypes(或,对 `kind: 'manifest'`,注册 manifests;对 `kind: 'objectSet'` — Tier 2 — 注册 ObjectSets)。
- 任何 `z.object(...)` schema 内每个 `objectRef('X')` brand(ObjectTypes、ActionDef params、StateDef 等)引用注册 ObjectType `X`。`objectSetRef('X')` 同。
- 所有 `derivedFrom` dot-paths 通过声明的 `LinkDef` 解析。
- 所有 `AccessBoundary.{readable,writable,actions,subscribes}` 引用解析到声明的 slots/actions/streams。带 `where` predicates 的路径条目(Tier 2, §5.5):predicate 中每个 `PathExpr` 通过匹配 Zod schema 解析(`row.<field>` → `ObjectType.schema.shape`;`state.<field>` → state schema;`slot.<name>.<field>` → 绑定 slot schema);每个 `op: 'named'` predicate 名字必须注册。
- 所有 `LifecycleDef` action apiNames 是注册的 `ActionDef`。
- 所有 `ActionDef.preconditions`(Tier 1):`kind: 'stateEquals'` 路径解析到声明的带 `z.literal`/`z.enum`-兼容 schema 的 state 字段;`kind: 'slotBound'` slot 名字在 manifest 上存在;`kind: 'named'` 名字已注册。
- **Interface 一致性**(Tier 2, G4):当 `ObjectTypeDef.implements: ['X']`,interface `X` 已注册*且*其 `requiredSchema.shape` 被实现者的 `schema.shape` 结构性满足(每个 required 字段以兼容 Zod 类型出现,通过 `.shape` introspection);`requiredLinks` 和 `requiredActions` 按 apiName + 兼容签名匹配。晚 `registerInterface()` re-validates 现有实现者。
- **ObjectSet 有效性**(Tier 2, G6):`objectType` 解析到注册 ObjectType;filter 中每个 `path` 通过该 ObjectType 的 schema 解析;`'named'` filters 引用注册 Predicates。
- **Meta-key 有效性**(新 — Tier 1 schema-first 重构):`ObjectTypeDef.meta: { ... }` 中使用的每个 key 必须存在于 `schema.shape`。拼错 meta keys 在编译期被 `PropertyMetaMap<S>` generic 约束抓且在运行时被 validator 抓。
- **StreamDef payload 排他性**:`payloadType`(ObjectType 引用)或 `payloadSchema`(inline Zod)恰好设一个,从不两个。
- **Validation-rule 链接**(Tier 3, G7):`ObjectTypeDef.validationRules` 中每个 `name` 必须作为 `params.name` 出现在链到 `schema` 的某个 `.refine()` 上;反之,schema 上每个命名 refine 有 meta 条目。无 `params.name` 的匿名 refines 允许(无错误)但不被 projected。
- **State-machine 一致性**(Tier 3, G8):`stateMachine.property` 是 `schema.shape` 上一个 key,其 Zod 类型是 `z.enum(...)`。`Transition.from`/`Transition.to` 每个是 enum 选项之一。每个 `Transition.action`(如设置)是注册的 ActionDef apiName,其 params 让 handler 识别目标实例。
- **Notification predicate 解析**(Tier 3, G10):每个 `NotificationRule.match` predicate 路径通过触发-合适 Zod schema 解析(`on: 'stateChange'` 走 state schema、`'actionResult'` 走 action params、`'streamEvent'` 走 stream payload)。每个 `kind: 'named'` channel 名字是注册 impl。
- **ActionDef.returnType 有效性**(Tier 3, G11):设置时,必须是有效 Zod schema(可 parseable);编译期类型检查。
- 声明 `semantic` 的每个原语 `semantic` 非空(validators 拒绝空字符串)。
- `'*'` boundary 通配符只在 `role: 'admin'` 下出现。

`register*()` 在第一次违反时抛 `RegistrationError` 带失败引用。晚注册(如 InterfaceDef 在其实现者之后注册)触发 re-validation pass;如果任何现有实现者现在违反一致性,晚 `registerInterface()` 调用抛且 registry 保持 pre-call 状态。

**为什么**:Schema 注册在 solution startup 跑一次 — validation 代价摊销。坏 schema 到达 production 对治理主张是 catastrophic;"我们在 Agent 试图用时运行时校验"意味着 catastrophe 交付给客户而不是在 boot 时抓住。

---

## 10. 与现有基础设施的协调

本包不在真空中落地。Repo 已经有工作的重叠原语。每个的处理在下面。

### 10.1 概念 → 原语映射

> 提醒:"Disposition" 列描述*SPEC 级*发生什么。实现按 [impl plan](./kedge-ontology-implementation-plan.zh.md) 的 5 阶段构建落地。说 "Move + generalize" 或 "Add new" 的 disposition 不意味今天代码存在。

| Ontology 概念 | 现有原语(路径) | Disposition |
|---|---|---|
| `OntologyRegistry` | `EntityRegistry`(`packages/context-layer/src/core/entity-registry.ts`) | Move + generalize 进 `@kedge-agentic/ontology`。`EntityRegistry` 变成薄重导出 wrapper 保持向后兼容。 |
| `ObjectTypeDef.picker` | `ReferenceableOptions`(`packages/context-layer/src/core/interfaces.ts:3-21`) | 重构:`ReferenceableOptions` 变成 `ObjectTypeDef.picker` 的 projection(legacy callers 继续工作;新 callers 直接注册 `ObjectTypeDef`)。 |
| `ManifestAccessor.readSlot` / `.traverse` | `EntityContextProvider.getContext` / `.search`(`packages/context-layer/src/core/interfaces.ts:247-254`) | 组合,不替换:默认 `ManifestAccessor` impl 为 slot-scoped 读包装 `EntityContextProvider`。 |
| `ActionDef` 执行 | `DocumentEditProvider`(`packages/context-layer/src/core/document-edit-provider.ts`)对 document 编辑;`ToolCallerProxy` 对其它 | `DocumentEditProvider` 保持处理 document `str_replace` / `field_set`(在 recipe-book 中 well-tested)。一般 `ActionDef` 执行编译到 `ToolDefinition` 并用 `ToolCallerProxy`。 |
| `ActionDef` 治理 pipeline | `ToolCallerProxyService` 6 步 pipeline(`packages/backend/src/tool-caller/tool-caller-proxy.service.ts`) | 逐字复用。`ActionDef` → `ToolDefinition` 在注册;proxy 的 sanitize/validate/permission/inject/dispatch/audit pipeline 做工作。 |
| `ActionDef.auditLevel` | `ToolCallAuditEntry` + `tool_events` 表(`packages/backend/src/tool-caller/types.ts:141`) | 现有审计 infra 尊重 `auditLevel`:`'none'` 跳过写,`'log'` 写现有字段,`'full_diff'` 用 `stateChanges` 扩展。 |
| `AccessBoundary.role` | `UserRole` + `ApiKeyScope`(见 §10.3) | `BoundaryRole` 机械映射 — 无新权限 engine。 |
| `ManifestDef` 运行时存储 | `Lesson.manifestJson`(live-lesson)+ `SessionMetadata`(core,`packages/backend/src/sessions/entities/session-metadata.entity.ts`) | `ManifestDef` 仅 schema。实例像之前 per-solution 存;`SessionMetadata` 是运行时 state 的推荐位置(≤256 KB/session — 见 entity 注释)。 |
| `LifecycleDef` hooks | 今天:NestJS service 方法 | Hook `apiName` → 通过 `SolutionToolkitRegistry` 注册 service-method。 |
| `FunctionDef`(§3.7, Tier 1) | (无 — 全新) | 全新。像 `ActionDef` 编译到 `ToolDefinition` 但桥固定 `auditLevel: 'log'`(从不 `'full_diff'`)且完全跳过 approval gate。§11 中独立 projection 桶。 |
| `ActionDef.preconditions`(§3.3, Tier 1) | 今天:handler 端 early-return 检查 | 由 `checkBoundary` 在 proxy pipeline 的 step 3.5 求值。`BoundaryDecision.unmetPreconditions` 结构化报告失败,使 `discoverActions()` 可过滤。 |
| `LocalizedString` displayName(§3.0, Tier 1) | 今天:到处 `displayName: string` | 与纯字符串的联合 — 对单语言 Solutions 无破坏变更;多语言 Solutions opt in。Resolver `OntologyRegistry.getDisplayName(def, locale?)` 处理 fallback。 |
| `InterfaceDef`(§3.8, Tier 2) | (无 — 全新) | 全新。Solution 端采纳:声明一个 Interface(如 `Mentionable`),在 ObjectTypeDefs 加 `implements: ['Mentionable']`;registry 在 boot 校验结构一致性。Picker / agent 查询通过 `registry.getImplementersOf('Mentionable')` 而非枚举具体类型。 |
| `ObjectSetDef`(§3.9, Tier 2) | 今天:带硬编码 filter 的 derived slot | 全新原语;今天 derived slots 变成 `{ kind: 'objectSet', name }` slot targets 指向注册 ObjectSets。Actions 可取 `type: 'objectSet'` 参数。Schema-distribution endpoint(§9.6)在 ETagged payload 包含 ObjectSets。 |
| Predicate-scoped `AccessBoundary`(§4.4 + §5.5, Tier 2) | 今天:仅路径字符串列表 | 路径字符串仍接受(无破坏变更)。新条目形状 `{ slot, where: BoundaryPredicate }` 启用 row-level 安全。`checkBoundary` 在带 row context 调用时 per row 求 predicates;对 legacy string entries fallback 到 always-true。Predicate impl bodies 住 solution 代码通过 `registerPredicate(name, impl)`。 |
| Zod-first schema 层(§3.1 / §3.4 / §3.6) | live-lesson `manifest.schema.ts`、creator-mcp-server `schemas.ts`、`ToolCallerProxy.argsSchema: ZodTypeAny` | 无新约定。每个 `ObjectTypeDef.schema` 和 `ActionDef.params` 上定义的 Zod schemas 是 repo 其余已经用的*同一形状*。`ToolCallerProxy` 直接把我们的 `actionDef.params` 作为其 `argsSchema`。放弃自定义 `PropertyDef` 类型系统,改用已经工作的。 |
| `ValidationRuleMeta`(§3.10, Tier 3) | 今天:Zod `.refine()` 调用工作但对 agent 不可见 | 在 `ObjectTypeDef` 加 `validationRules` sidecar。每条目命名 `.refine()`(通过 `params: { name }` 约定)并给它 semantic+severity+message 元数据。通过 §11 projection 给 agent;通过 registry 可查询。 |
| `StateMachineDef`(§3.11, Tier 3) | 今天:handler 端 state-transition 检查 | 扩展 `ObjectTypeDef` 带 `stateMachine?: { property, transitions[] }`。Boundary check 对声明的 transitions 求 `op: { kind: 'transition' }`。每个 Transition 可命名一个 ActionDef,其 handler 就是 transition(继承 audit + approval)。 |
| `PropertyMeta.classification` + `redaction`(§3.1 扩展, Tier 3 — G9+G12) | 今天:临时 handler 端 PII 过滤 | Per-property sidecar 条目。`getPropertiesByClassification(tag)` 启用 compliance 报告。Redaction pipeline(§5.4)对 `readSlot` 结果基于 `redaction.roles` 成员应用 `mask` / `hash` / `omit`。 |
| `NotificationRule`(§4.8, Tier 3, G10) | 今天:per use case handler 端 SSE/push 调用 | `ManifestDef.notifications` 声明 trigger + predicate + channel。每次成功 state 写 / action / stream event 后运行时求值。通过现有 SSE relay + push 子系统路由;命名 channels 通过 `registerNotificationChannel`。 |
| `ActionDef.returnType` + `ActionResult.returnValue`(§3.3 + §5.3 扩展, Tier 3, G11) | 今天:结构化返回放 `ToolResult.content[0].text` 作为 JSON 让 agent re-parses | 用 Zod schema 声明;桥把解析的返回附到 `ActionResult.returnValue`。Agent 的 projected action descriptor 包含 `zod-to-json-schema(returnType)`,使 agents 可在调用前推理返回形状。 |
| Semantic projection | (无 — 全新) | 全新。`semantic/project.ts` + 三个 sub-formatters。 |
| Schema distribution endpoint | (无 — 全新) | 全新。`GET /api/v1/ontology/schema`(impl plan 的 Phase 3)。 |

### 10.2 ToolCallerProxy 桥(关键链接)

让 `ActionDef` 可执行的桥长这样(伪代码 — 具体实现按 ADR-0001 住 `packages/backend`):

```ts
function actionToToolDefinition(
  action: ActionDef,
  handler: ActionHandler,
  manifest: ManifestDef,
): ToolDefinition {
  // action.params 已经是 Zod 对象 schema — 无需转换。
  const argsSchema = action.params;
  return {
    name: action.apiName,
    description: action.semantic,
    argsSchema,
    requiredPermissions: action.requiredScopes ?? [],
    visibility: { roles: action.allowedRoles },
    handler: async ({ args, context }) => {
      // 1. Ontology boundary check(ManifestDef-aware)
      const decision = checkBoundary({
        manifest,
        role: contextToBoundaryRole(context),
        op: { kind: 'action', actionApiName: action.apiName },
      });
      if (!decision.allowed) {
        return { ok: false, code: 'permission_denied', reason: decision.reason ?? 'boundary denied' };
      }
      // 2. Approval gate
      if (decision.requiresApproval) {
        return { ok: false, code: 'permission_denied', reason: 'pending_approval' };
      }
      // 3. Dispatch 到 solution handler(已经过 proxy 的 sanitize/validate)
      return handler({ args, context });
    },
  };
}
```

Proxy 仍然做 6 步(sanitize / validate / permission-stub / inject / dispatch / audit);boundary check 插入 permission 步骤。无新 pipeline;一个新门。

### 10.3 AccessBoundary → 现有 auth 映射

`BoundaryRole` 是面向 ontology 的标签。到平台真实 auth 模型的映射是机械的:

| `BoundaryRole` | Required `ApiKeyScope`(any-of) | 典型 `UserRole` | 备注 |
|---|---|---|---|
| `'agent'` | `'chat'`、`'mcp:read'`,加 `action.requiredScopes` | n/a(session-bound,不是 user-role-bound) | 身份来自 session 创建时设置的 `ExecutionContext.actingUserId`;agent 从不断言 role。 |
| `'picker'` | `'chat'`(读)、`'skills:execute'`(应用) | `'viewer'` 或更高 | UI 驱动;用户身份从认证浏览器 session 通过 `RequestContext.userId` 流来。 |
| `'admin'` | `'admin'` 或 `'builder'` | `'admin'` | 在 `readable`/`writable`/`actions` 允许 `'*'` 通配符。 |
| `<custom string>` | per-action 通过 `ActionDef.requiredScopes` 声明 | per-solution 在注册时校验 | Solutions 可声明如 `'teacher'`、`'principal'`;映射表是 solution-specific config。 |

Solutions 在与 `OntologyRegistry.registerManifest()` 同一生命周期注册其 custom-role 映射表。映射存在 registry,由 `checkBoundary` 在 `role` 是 custom string 时咨询。

### 10.4 现有包中*不*变的

- `packages/context-layer/src/core/document-edit-provider.ts` — 保持当前形状;原样工作。`EditOperation` 联合(`str_replace` / `field_set`)是 document edits 的正确级别,与 `ActionDef` 粒度无关。
- `packages/agent-runtime/src/sync/sync-engine.ts` — 正交层(文件/artifact 同步)。`ManifestAccessor` 可能调它持久化 slot-bound documents,但同步逻辑本身未触碰。
- `packages/backend/src/tool-caller/*` — 不变。§10.2 中的桥住在新文件(`packages/backend/src/ontology/*`);对 proxy 无编辑。
- `packages/backend/src/sessions/entities/session-metadata.entity.ts` — 不变。Manifest 实例运行时-state 的推荐存储原样复用。

### 10.5 实际 `ToolCallerProxy` 6 步 pipeline(当前代码,供参考)

让无 repo 访问的读者能看到桥接入什么,这是来自 `packages/backend/src/tool-caller/tool-caller-proxy.service.ts` 的活代码(摘录,保留注释):

```ts
async invoke(
  request: ToolCallRequest,
  context: ExecutionContext,
): Promise<ToolResult> {
  const startedAt = Date.now();

  // Step 1: strip reserved fields from agent-supplied args.
  const { cleaned, stripped } = sanitizeArgs(request.args);
  if (stripped.length > 0) {
    this.logger.warn(
      `Tool "${request.tool}" call by session ${context.sessionId} ` +
      `(actingUserId=${context.actingUserId ?? 'none'}) tried to set ` +
      `reserved fields: ${stripped.join(', ')} — silently stripped`,
    );
  }

  const resolved = this.registry.resolveTool(context.solutionId, request.tool);
  if (!resolved) {
    const result: ToolResult = { ok: false, code: 'tool_not_found', reason: `...` };
    await this.audit(request, context, stripped, cleaned, result, startedAt);
    return result;
  }

  // Step 2: schema validation of sanitized args.
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = resolved.definition.argsSchema.parse(cleaned);
  } catch (err) {
    const reason = err instanceof ZodError ? this.formatZodError(err) : `Invalid...`;
    const result: ToolResult = { ok: false, code: 'validation_failed', reason };
    await this.audit(request, context, stripped, cleaned, result, startedAt);
    return result;
  }

  // Step 3: permission check — STUB. Always allow.
  // When the permission engine lands, this checks
  // resolved.definition.requiredPermissions against context.permissions.
  // ← THIS is the step where checkBoundary slots in for ActionDef-derived tools.

  // Step 4: assemble the ToolInvocation. ExecutionContext is the
  // caller's claim — we do NOT derive any field from `args` here.
  const invocation: ToolInvocation = {
    tool: resolved.qualifiedName,
    args: parsedArgs,
    context,
  };

  // Step 5: handler dispatch. We catch unexpected throws and turn
  // them into a documented failure shape — the agent should never
  // see an HTTP-style crash.
  let result: ToolResult;
  try {
    result = await resolved.definition.handler(invocation);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`Tool "${request.tool}" handler threw...: ${msg}`);
    result = { ok: false, code: 'handler_error', reason: `... failed: ${msg}` };
  }

  // Step 6: audit (always).
  await this.audit(request, context, stripped, parsedArgs, result, startedAt);
  return result;
}
```

`audit()` 方法通过可插拔 `ToolCallAuditSink` 写一条 `ToolCallAuditEntry` 到 `tool_events` 表;如无 sink 接线,它 fallback 到 logger 带一次性 "wire a sink" 警告。**无调用路径从不跳过审计。** 这是 ontology 包构建之上的契约。

`ActionDef` 在画面时变什么:在注册时,桥包装 handler 使 step 5 变成两阶段 — 先 `checkBoundary`(对 ontology-aware tools 作为 step 3),然后真实 handler。其它五步未触碰。

---

## 11. Semantic projection 格式 — worked examples

本节让 §7 具体。给一个小 `ObjectTypeDef`(3 属性、2 links、1 action),显示每个 `ProjectionFormat` 发出什么。

### 11.1 输入

```ts
const LessonPlanSchema = z.object({
  title: z.string()
    .describe('Short headline shown to the teacher and students.'),
  subject: z.enum(['math', 'reading', 'science'])
    .describe('Subject area; constrains which observation handlers apply.'),
  durationMinutes: z.number()
    .describe('Expected wall-clock duration in minutes; informs pacing decisions.'),
});

const lessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  displayName: '教学计划',
  semantic: 'A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.',
  schema: LessonPlanSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
  },
  links: [
    { apiName: 'targetClass', displayName: '面向班级', target: 'Class',
      cardinality: 'N:1', inverse: 'lessons', traversable: true,
      semantic: 'The class this plan is authored for.' },
    { apiName: 'usesResources', displayName: '使用资源', target: 'Resource',
      cardinality: 'N:M', inverse: 'usedByPlans', traversable: true,
      semantic: 'Resources (slides, videos, worksheets) embedded in this plan.' },
  ],
  actions: [
    defineAction({
      apiName: 'adjustDifficulty',
      displayName: '调整难度',
      params: z.object({
        direction: z.enum(['easier', 'harder'])
          .describe('Which way to nudge the plan difficulty.'),
        reason: z.string()
          .describe('Free-text justification recorded in the audit trail.'),
      }),
      sideEffects: ['mutates:LessonPlan.steps', 'emits:DifficultyAdjusted'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'full_diff',
      semantic: 'Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.',
    }),
  ],
});
```

### 11.2 Format A — `'anthropic-tools'`(Claude Code tool-use)

```json
{
  "tools": [
    {
      "name": "LessonPlan.adjustDifficulty",
      "description": "Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.\n\nSide effects:\n  - mutates:LessonPlan.steps\n  - emits:DifficultyAdjusted",
      "input_schema": {
        "type": "object",
        "required": ["direction", "reason"],
        "properties": {
          "direction": {
            "type": "string",
            "enum": ["easier", "harder"],
            "description": "Which way to nudge the plan difficulty."
          },
          "reason": {
            "type": "string",
            "description": "Free-text justification recorded in the audit trail."
          }
        }
      }
    }
  ]
}
```

### 11.3 Format B — `'system-prompt'`(Markdown 片段)

```markdown
## Context: LessonPlan (教学计划)

A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.

### Readable fields
- `title` (标题, string): Short headline shown to the teacher and students.
- `subject` (学科, enum: math | reading | science): Subject area; constrains which observation handlers apply.
- `durationMinutes` (时长, number): Expected wall-clock duration in minutes; informs pacing decisions.

### Traversable relationships
- `targetClass` → Class (N:1): The class this plan is authored for.
- `usesResources` → Resource (N:M): Resources (slides, videos, worksheets) embedded in this plan.

### Available actions
- **adjustDifficulty** (调整难度) — Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.
  - Side effects: mutates `LessonPlan.steps`, emits `DifficultyAdjusted`
  - Audit level: full_diff (before/after state recorded)
  - Params:
    - `direction` (easier | harder): Which way to nudge the plan difficulty.
    - `reason` (string): Free-text justification recorded in the audit trail.
```

### 11.4 Format C — `'mcp-tools'`(MCP tool descriptors)

```json
{
  "tools": [
    {
      "name": "lessonplan__adjust_difficulty",
      "description": "Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.",
      "inputSchema": {
        "type": "object",
        "required": ["direction", "reason"],
        "properties": {
          "direction": { "type": "string", "enum": ["easier", "harder"] },
          "reason": { "type": "string" }
        }
      }
    }
  ]
}
```

注意约定:

- Format A 用 `input_schema`(Anthropic)。
- Format C 用 `inputSchema`(MCP)并通过 `<namespace>__<action>` snake_case 工具名。
- 三者都逐字带 `semantic` 文本 — LLM 读同一描述,不论 transport。

**JSON 从哪来**:Formats A 和 C 各是一行 — `zod-to-json-schema(actionDef.params)` 逐字产 `input_schema` / `inputSchema` body,包括 Zod schema 内每个 `.describe()` 调用的 `description` 文本。Projector 把那个输出包在 format-specific 信封(`name`、`description`)里,无其它。Format B(Markdown)走同一 Zod schema 并 per field 渲染一个 bullet — 同源数据,不同呈现。要点:Zod 作为单一真源,projector 是薄 renderer,不是类型系统的重新实现。

### 11.5 Manifest 级 projection — 完整 `LessonSession` 视图

`projectManifest(manifestDef, registry, role, format)` walk role 的 `AccessBoundary`,只包含 readable slots / writable state / allowed actions / subscribable streams,并发出 per-object 和 per-state projections 的联合。输出是 Agent 进入 manifest context 时收到的 — 忠实的、role-scoped、语义丰富的其操作环境视图。

这是 `system-prompt` format 应用到 §4.7 的 `LessonSession` `ManifestDef`、为 `role: 'agent'` projected 的:

```markdown
# Operating context: LessonSession (课堂会话)

You are operating inside a single in-progress run of a LessonPlan with a specific Class. The static plan + class + resources are bound for the duration of the session; the live event stream and runtime phase state evolve as the lesson unfolds.

## What you can see (readable)

### Slot `plan`: LessonPlan (教学计划)
A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.
Fields: title (string), subject (math|reading|science), gradeLevel (string), durationMinutes (number, computed).
Traversable: targetClass → Class, usesResources → Resource[].

### Slot `class`: Class (班级)
A persistent roster of students at a school.
Fields: name (string), school (string), studentCount (number, computed).
Traversable: contains → Student[], lessons → LessonPlan[].

### Slot `students`: Student[] (学生列表)  [derived from class.contains]
Students enrolled in the bound class.
Fields per student: name (string), engagementScore (number, computed, range 0–100), lastSeenAt (datetime, computed).

### Slot `resources`: Resource[] (可用资源)  [derived from plan.usesResources]
Resources embedded in the bound plan.
Fields per resource: title (string), kind (slide|video|worksheet|image), url (string).

## What you can change (writable)

- `phase` (enum: waiting | listen | practice | discuss | takeaway | ended, initially `waiting`):
  Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter order.
- `activeStepId` (string, initially null):
  Current readingSteps[].id within the active phase.
- `pausedForIntervention` (boolean, initially false):
  True if the session is paused for teacher intervention (e.g. ≥5 students stuck).

## What you can subscribe to (streams)

- `events` (payload: ClassroomEvent, backpressure: drop_oldest):
  Push stream of ClassroomEvent emitted by the GLM-4.7-Flash observation engine as the class progresses.

## What you can do (actions)

### `adjustDifficulty(direction, reason)`
Re-paces the plan toward easier or harder content. Use when class metrics show consistent under- or over-performance for ≥3 minutes.
- `direction` (easier | harder, required): Which way to nudge the plan difficulty.
- `reason` (string, required): Free-text justification recorded in the audit trail.
- Side effects: mutates LessonPlan.steps, emits DifficultyAdjusted.
- Audit level: full_diff (before/after recorded).

### `flagForIntervention(reason, severity)`
Raises a teacher-facing alert for a student. Use when engagementScore drops below 30 or after 3 consecutive incorrect submissions.
- `reason` (string, required): Why this student needs teacher attention.
- `severity` (watch | urgent, required): Watch = surface in dashboard; urgent = teacher push.
- Side effects: emits StudentAlert.
- Audit level: log.
```

同一 manifest,projected 为 `anthropic-tools`,产两个 tool definitions(`LessonSession.adjustDifficulty`、`LessonSession.flagForIntervention`)带从每个 ActionDef 的 `params` 派生的 `input_schema` — agent 的 tool-use API 直接看到它们。作为 `mcp-tools`,同两个编译到通过 `SolutionToolkitRegistry`(§10.2 的桥机制)注册的 MCP tool descriptors。

重要的,同一 manifest 的 `picker` role projection 会完全省略 `## What you can change` 和 `## What you can do` 节(那些 boundaries 为空),并包含 scoped 为只读 reference 的 `students` 和 `resources` slots。同一 `ManifestDef` 按 role 产不同视图 — 这是 schema 的工作。

---

## 12. FAQ

reviewers 和外部读者的常见问题。

**Q:为什么 Zod-first 而非自定义 `PropertyDef`?**
A:三个理由。(1) **避免重复 TS 已经表达的。** 早期版本定义 `PropertyDef` 带 `apiName / type / required / enumValues / refTarget / ...` — 其中每个都是 TypeScript+Zod 已经编码的(`z.string()`、`.optional()`、`z.enum([...])`、branded refs)。写两次创造漂移和 TS-vs-runtime 不一致。(2) **匹配 repo 现有约定。** `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`、`creator-mcp-server`、`ToolCallerProxy.argsSchema` 全是 Zod-based。引入平行自定义形状会让本包是*奇怪的那个*。(3) **schema-distribution endpoint(§9.6)的免费运行时序列化** 通过 `zod-to-json-schema` — 同一库服务 agent 的 anthropic-tools 和 mcp-tools projections(§11)。`PropertyMeta` sidecar(§3.1)幸存,因为 Zod 真正没有 "@Picker 中可搜索" 或 "computed-因此-从不可写" 的概念 — 那些是治理/呈现 hints,不属于 value-shape 语言。

**Q:为什么不直接用 Palantir Foundry / OSDK?**
A:两个不可谈判。(1) 我们最大客户是中国政府/教育局,他们部署不了 Palantir。(2) 我们模型是 CcaaS — 我们 ship 一个客户用自己 Solutions 扩展的平台,不是闭源 workbench。Foundry 价值是集成数据 infra;我们有自己的。我们借 Palantir 概念模型(Objects + Links + Actions + 治理),不是他们产品。

**Q:这看起来是很多新抽象。最小版本交付什么价值?**
A:[implementation plan](./kedge-ontology-implementation-plan.zh.md) 的 Phase 1 — 仅 schema 原语、registry、validators — 已经让 Solution 写第一个 `ObjectTypeDef` 并让 validators 在 boot 抓住格式错误声明。仅此已经比今天自由形式 `manifest.json` 进一步。完整回报(Picker 自动渲染、agent 自动 prompt)在 Phase 2 和 3 落地,但包从 Phase 1 起就有用。

**Q:这怎么与现有 `EntityRegistry` 和 `ReferenceableOptions` 交互?**
A:`EntityRegistry` 变成 `OntologyRegistry` 的薄重导出 wrapper。`ReferenceableOptions` 变成 `ObjectTypeDef.picker` 的 projection。现有调用点(recipe-book、React `AtPicker`)继续工作不变。新调用点注册完整 `ObjectTypeDef`。处理表见 §10.1;per-phase migration 见 impl-plan。

**Q:为什么到处要求 `semantic`?**
A:因为 LLM 是主要消费者。没 `.describe()` 文本的字段(以及没对象级 `semantic` 的原语)对 agent 不透明 — agent 看到名字和类型,必须猜意义,以代价高的 debug 方式搞错。让 per-primitive `semantic` 在注册时必填,并强烈鼓励 Zod schemas 中 per-field `.describe()` 调用,保证 shipped schema 至少最小地 agent-readable。`semantic` 的空字符串检查在 validator 套件(§9.7);per-field `.describe()` 社交强制(code review),不是 validator,因为合理自解释字段(`id: z.string()`)不该因缺描述被拒。

**Q:Action composition(§9.5)不破坏封装吗?**
A:相反 — 它*阻止*隐藏 composition。今天调 `adjustDifficulty` 的 agent 没办法知道 handler 内部也调 `insertResource`。`composes: ['insertResource']` 声明把那事实表面到 agent 对 action 的视图。Agent 然后可以选择调 `adjustDifficulty` 知道完整传递性 side-effect 面,或如果任何 sub-action 被禁就拒绝。

**Q:为什么不在专用表存 `ManifestDef` 实例?**
A:三个理由。(1) Solutions 在存储需求上差太多 — recipe-book 用内存 state,live-lesson 用 SQLite,企业 solution 可能用 Postgres + Redis。强加单存储模型会把每个 Solution 推进 backend 重设计。(2) `SessionMetadata` 已存在(key-value、256KB/session 预算)且覆盖大多数情况。(3) 对*不*适配的 state(大学生名册、长事件历史),Solution 应该拥有存储决定 — ontology 包工作止于访问协议。

**Q:我能声明无 agent boundary 的 manifest — 仅给 @Picker?**
A:能。`boundaries` 数组要求存在但允许只包含 solution 实际用的 roles。仅 picker manifest 声明 `[{ role: 'picker', readable: [...], writable: [], actions: [] }]` 别无其它。Agent role 就不会被 projected。

**Q:Offline / 断线操作怎样?Schema endpoint(§9.6)需要 backend。**
A:Schema endpoint 是*更新*用的。Agents 和前端应缓存 schema(由 `getSchemaDigest()` 索引),在 backend 不可达时从缓存操作。对真 offline-only Solutions,build-time bundling 仍可能 — `OntologyRegistry` 的 defs 是纯对象,你可以在 build time 序列化并 ship 在前端 bundle。运行时分发是推荐,不是硬性要求。

**Q:这与 GraphQL schema 怎么不同?**
A:GraphQL 描述数据层的 query/mutation 形状。`kedge-ontology` 描述*operational context* — manifest 绑对象、*加*运行时 state、*加* per-role access boundary、*加*生命周期、*加*审计/approval 策略。更接近 "Palantir Ontology 遇见 Spring Security 遇见 Statecharts" 而非 GraphQL。你*也*可以把你的 `ObjectTypeDef` 暴露为 GraphQL — 没东西阻止 Solution 自动生成 schema — 但那是 export 选项,不是竞争概念。

**Q:如果 schema 在运行时分发,版本化在哪适合?**
A:按 spec §9.1,每个*manifest 实例*携带其创建时 `schemaVersion`。运行时 endpoint 总是服务最新注册 schema。如果实例在 v1 下创建而 v2 现在 live,运行时对实例的冻结 v1 schema 解析(registry 保留旧版本直到显式 evict,这就是 `migrateInstance` 是 opt-in 的原因)。这是驱动决定的审计-可复现要求。

**Q:Action pre-conditions 怎样(如 "phase 必须 `practice` 对 `adjustDifficulty`")?**
A:按 gap-analysis G2 建模 — 见 §3.3 中 `ActionDef.preconditions`。区分联合(`stateEquals` / `slotBound` / `named`)覆盖常见情况;`checkBoundary` 在 proxy pipeline(§8.5)的 step 3.5 求值它们。`discoverActions()` 尊重同样求值,使 agent 只看到当前可调 actions。原本推迟;被 [gap analysis](./kedge-ontology-gap-analysis.zh.md#g2--action-preconditionstier-1) 提升到 Tier 1,因为 handler 端检查对 agent 推理和 reviewers 不可见。

**Q:为什么 `FunctionDef` 与带 `auditLevel: 'none'` 的 `ActionDef` 分开?**
A:意图清晰。Agent 对"无代价可调"(`FunctionDef` — 纯读、永无 approval、无 state mutation 可能)和"有效可调"(`ActionDef` — 可 mutate、可需 approval、audit-tracked)推理不同。把两者坍缩到一个原语逼每个消费者(agent、reviewer、审计 pipeline、semantic projection)从 `sideEffects.length === 0 && auditLevel === 'none'` 重新派生区别。独立原语让意图结构化。见 [gap-analysis G1](./kedge-ontology-gap-analysis.zh.md#g1--function-typestier-1)。

**Q:为什么 `displayName` 是联合(`string | Record<...>`)而不总是 `Record`?**
A:常见情况的向后兼容。今天调用点全传 `displayName: '教学计划'` — 单中文字符串。到处强迫 `Record<string, string>` 会是每个 Solution 的破坏变更来满足未来需求。联合(`LocalizedString = string | Readonly<Record<string, string>>`)意味着单语言 Solutions 写更简单形式不变;多语言 Solutions 通过传 map opt in。见设计原则 6(§1.7)和 [gap-analysis G3](./kedge-ontology-gap-analysis.zh.md#g3--displayname-上的-i18ntier-1)。

**Q:Interface Types / Object Sets / row-level predicates 怎样?**
A:按 gap-analysis G4/G5/G6 采纳 — `InterfaceDef`(§3.8)、`ObjectSetDef`(§3.9)、`BoundaryPredicate`(§5.5)。Tier 2 项一旦 Tier 1 中结构性模式证实,就从"推迟"提升到"merged";原本后果分析见 [gap-analysis Tier 2](./kedge-ontology-gap-analysis.zh.md#tier-2--✓-merged-入-design-spec2026-05-29)。

**Q:为什么 `InterfaceDef` 不是 TypeScript 式 interface 继承?**
A:两个理由。(1) 继承会与设计原则 1 — "schema 是数据,不是代码" — 冲突。声明为数据的 Interfaces 可通过 `getSchemaDigest()` 和 schema-distribution endpoint 传递;TS 继承不能。(2) 结构一致性(在注册时按 apiName + 类型匹配)意味着 ObjectType 可以实现在不同包定义的 Interface,无需 extends 类。Registry 追踪实现图;ObjectTypeDefs 保持 flat。

**Q:何时用 `ObjectSetDef` vs `derivedFrom` slot?**
A:`derivedFrom` 给*跟随这个 link 得相关实例* — `class.contains` 中的 `students` 是图 traversal。`ObjectSetDef` 给*应用这个 filter 表达式得子集* — `struggling`(`engagementScore < 30` 的 Students)是 query,不是 traversal。两者组合:slot 可 target 一个 ObjectSet,其 objectType 本身通过 traversal 达到。经验规则:如果你会为它写 SQL `WHERE`,它是 ObjectSet;如果你会写 `JOIN`,它是 `derivedFrom` link。

**Q:为什么 predicate sub-language 是 first-order?我不会需要表达更复杂规则吗?**
A:可能会,有时。逃生通道是 `'named'` 形式:在 registry 注册一个 `Predicate` 实现(`registerPredicate('isInPracticePhase', impl)`),任何 `BoundaryPredicate` / `SetFilter` / `ActionPrecondition` 可按名字引用。First-order 语言覆盖 ≥80% 需求(按 gap-analysis Q3 推理)且保持 trivially 可求值。更丰富表达式通过命名 predicate 实现的 code review — 对非平凡逻辑的正确 review 面。

**Q:G5 落地时 `AccessBoundary.readable: ['students']` 会怎样?**
A:无 — 它继续工作。`BoundaryPathEntry` 是联合(`string | { slot, where }`),所以纯路径字符串仍有效。Tier 2 merge 对不采纳 predicates 的 Solutions 无破坏。

**Q:Classification tags / state machines / validation rules / notifications / action returns 怎样?**
A:全按 gap-analysis G7/G8/G9+G12/G10/G11 merged。见:`ValidationRuleMeta`(§3.10)、`StateMachineDef`(§3.11)、`PropertyMeta.classification` + `.redaction`(§3.1)、`NotificationRule`(§4.8)、`ActionDef.returnType` + `ActionResult.returnValue`(§3.3 + §5.3)。原本 gap analysis 中文档化的 "promotion criteria" 是会触发 merge 的;用户选择在 criterion 触发之前 graduate 它们以避免 Phase 3+ rework。

**Q:为什么 `ValidationRuleMeta` 是 sidecar 而不是声明式规则表达式?**
A:因为 Zod `.refine()` 和 `.superRefine()` 已经表达任意 domain 规则,且 Solutions 今天写它们(live-lesson 的 `manifest.schema.ts` 有)。建一个平行声明式 predicate 语言要么比 Zod refines 表达力差(强制 fall-back 到 refines 反正)要么重复工作。Sidecar 给 refine 一个名字 + agent-facing semantic,这是唯一缺的。

**Q:何时用 `StateMachineDef` vs `ActionDef.preconditions`?**
A:`preconditions` 在任意 state 上门控*单个 Action*。`StateMachineDef` 在一个 enum-typed 字段上声明*合法 transitions 的完整图*,并把每个 transition(可选)绑到一个 Action。经验规则:如果你有一个 Action 其调用依赖 state,用 `preconditions`。如果你有一个字段其值移动经 ≥3 个 state 带命名 transitions,用 `StateMachineDef` — 你获得合法下一 states 的穷尽枚举,agent 可通过 `discoverTransitions(instance)` 读。

**Q:为什么 redaction 是"字段不在 `AccessBoundary.readable`"之外的独立概念?**
A:不同语义。从 `readable` 缺席意味字段对该 role 不存在 — `readSlot` 返回不带它的对象。Redaction 保留形状:字段存在但其值被 masked/hashed/omitted-but-keyed。做 `if (student.name)` 的下游代码继续工作;需要真值的代码无意义。当消费者的*结构*依赖字段存在性选 redaction;当你要字段从类型完全消失选 absence-from-readable。

---

## 13. 来自现有 repo 的参照模式

如果你在实现本包的部分或其第一个 solution adoption 且想要 worked precedent,这些是 repo 中已经最接近的模式。

### 13.1 Solution 端类型注册 → `recipe-book`

`solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` 是拥有 serialize + edit 给 domain entity 的 `EntityContextProvider` 实现的最干净现有例子。当你写第一个 real type 的 `ObjectTypeDef`,把 Solution 端接线建模在这上:一个 NestJS service 扩展 `DocumentEditProvider`、注册自己到 registry、实现抽象方法。Migration 故事(Phase 2)就是:保持本 provider 无变化工作;在它旁边加一个 `ObjectTypeDef`;让 legacy `register()` 和新 `registerObjectType()` 调用在 module 的 `OnModuleInit` 中都触发。

### 13.2 round-trippable 富内容的 Block transforms → `recipe-book`

`solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts` 显示 per-Solution `TransformRegistry` 模式:domain-specific block type(`ingredient`)注册 `detect / serialize / deserialize` 使它通过 HTML 注释经 markdown 往返。这是 properties 包括需要 `str_replace` 编辑支持的富内容的 entities 的模式。`entity-document` 包机制已经处理这个;这种 entity 的 `ObjectTypeDef` 简单地在对应属性用 `type: 'json'` 并把消费者指向现有 `DocumentEditProvider` 基础设施。

### 13.3 作为 ActionDef-handler 容器的 Stdio MCP server → `creator-mcp-server`

`solutions/business/live-lesson/creator-mcp-server/src/index.ts` 是今天 stdio MCP server 的标准例子:三个 tools(`emit_todo_card`、`emit_questions_card`、`emit_verify_card`)声明为静态 Tool 对象,在 `CallToolRequestSchema` handler 中按名字 dispatch,带输入 Zod validation 和 JSON-stringified 输出,被 `EventMapperService` 重新解析为 SSE `output_update` events。Phase 3 落地后的 migration target 是:三个中每个变成 `ChatPanel` `ObjectTypeDef`(或类似)上的 `ActionDef`,`solution.json` 的 `proxyEnabled: true` 保持现有审计接线,agent 的 system prompt 从 `ActionDef.semantic` 自动生成而不是在 `appendSystemPrompt` 手写。

### 13.4 Schema-as-data,renderer-as-pure-function → live-lesson 的 board

`solutions/business/live-lesson/frontend/.../board-data.js` + `board-renderer.js` 是 "schema 是数据" 原则(§1.7 原则 1)的现有先例。`board-data.js` 是老师黑板的可序列化描述;`board-renderer.js` 是把它变成 DOM 的纯函数。同样的架构拆分适用于 `ObjectTypeDef`(数据)与 `@Picker`(renderer)之间的关系:当 picker 变成 schema-driven(Phase 3 后),React 组件是 `OntologyRegistry.getPickableTypes()` 输出的纯函数。

### 13.5 Zod-driven manifest validator → `live-lesson/backend/src/schemas/manifest.schema.ts`

live-lesson 中现有 `manifest.schema.ts` 是 "validation 深度" 决定(§9.7)的实践 — 它组合 ~15 个内 schemas 校验一个 lesson manifest、加载时 fail fast、返回结构化错误。Ontology 包的 `src/schema/validators.ts` 应瞄准同等的 fail-fast、结构化-错误覆盖,但应用于元-schema(ObjectTypeDefs / ManifestDefs)而非单个 domain 的 manifest 形状。

### 13.6 平台-断言身份模式 → `tool-caller-proxy.service.ts`

`ToolCallerProxy` 源本身(`packages/backend/src/tool-caller/tool-caller-proxy.service.ts`)是 repo 中写本包任何代码之前要内化的最重要模式。读文件 header 中文档化的 6 步和 §10.5 中实现。Ontology 的贡献是*加法* — 一个第 7 道门插入 step 3、`auditLevel: 'full_diff'` 的丰富审计行、permission engine 落地时 `requiredPermissions` 可指向的稳定位置。

---

## 附录 A — TypeScript 片段索引

为快速导航:

| Interface | 定义于 § |
|---|---|
| `PropertyMeta`、`PropertyMetaMap`(替代旧 `PropertyDef`/`PropertyType`) | §3.1 |
| `LinkDef`、`LinkCardinality` | §3.2 |
| `ActionDef`、`AuditLevel`、`ApiKeyScopeLiteral` | §3.3 |
| `ObjectTypeDef`、`PickerConfig` | §3.4 |
| `StreamDef` | §3.5 |
| `SlotDef`、`SlotTarget` | §4.2 |
| `StateDef` | §4.3 |
| `AccessBoundary`、`BoundaryRole` | §4.4 |
| `LifecycleDef` | §4.5 |
| `ManifestDef`、`SchemaVersion` | §4.6 |
| `ManifestAccessor`、`ActionDescriptor` | §5.1 |
| `BoundaryCheckInput`、`BoundaryDecision`、`checkBoundary` | §5.2 |
| `ActionResult`、`StateChange`、`ActionErrorCode` | §5.3 |
| `OntologyRegistry` | §6 |
| `ProjectionFormat`、`ProjectedManifest`、`projectManifest` | §7 |
