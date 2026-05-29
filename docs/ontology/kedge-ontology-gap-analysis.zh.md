# kedge-ontology vs Palantir Ontology — Gap Analysis

> [design spec](./kedge-ontology-design.md) 和 [implementation plan](./kedge-ontology-implementation-plan.md) 的伴侣文档。
>
> 英文原版:[kedge-ontology-gap-analysis.md](./kedge-ontology-gap-analysis.md)。
>
> **目的**:对我们从 Palantir Ontology 借了什么、刻意拒绝了什么、漏了应该加什么做诚实清单。本文档对每项都有强观点;附上理由,让未来读者可以推翻任一行。

---

## 0. TL;DR

每行一个 gap。**Tier 1** = 现在就加(Phase 1 PR);**Tier 2** = MVP follow-up;**Tier 3** = Solution 真正需要时再采纳;**Tier 4** = 明确非目标。

| # | Gap | 类别 | Tier | 推荐 |
|---|---|---|---|---|
| G1 | **Function Types** — 纯的、无副作用的 typed computations,区别于 Actions | 类型系统 | **1** | 加 `FunctionDef` 作为 `ActionDef` 的兄弟。今天的"computed property"和"auditLevel: 'none' 的 Action"都在意图上撒谎。 |
| G2 | **Action preconditions** — 门控 dispatch 的声明式 predicate | 治理 | **1** | 加 `ActionDef.preconditions`。今天每个"如果 `phase !== 'practice'`"检查都住在 handler 代码,agent 看不到。 |
| G3 | **`displayName` 上的 i18n** — schema 中的多语言标签 | 生命周期 | **1** | 把 `displayName: string` 提升为 `displayName: LocalizedString`。便宜,通过联合可选(纯字符串仍工作)。教育客户中文优先;英文后续上。 |
| G4 | **Interface Types** — 多个 `ObjectTypeDef` 共享的 polymorphism contract | 类型系统 | **2 ✓ merged** | design spec §3.8 中 `InterfaceDef`;`ObjectTypeDef.implements`;§9.7 结构一致性 validator。 |
| G5 | **Predicate-based AccessBoundary** — row-level 安全表达式,不只是路径列表 | 治理 | **2 ✓ merged** | §4.4 中 `BoundaryPathEntry` 联合;§5.5 中 `BoundaryPredicate` sub-language。`'named'` 通过 `registerPredicate` 提供逃生通道。 |
| G6 | **Object Sets 作为一等类型** — 命名、typed、filtered 的集合 | 类型系统 | **2 ✓ merged** | §3.9 中 `ObjectSetDef`;`SlotTarget.kind: 'objectSet'`;Action 参数用 `PropertyType: 'objectSet'`。 |
| G7 | **声明式 validation rules** — 与 schema 类型分离的业务约束 | 行为 | **3 ✓ merged** | design spec §3.10 中 `ValidationRuleMeta` sidecar,命名 Zod `.refine()` 调用并向 agent projection + compliance 查询暴露它们。 |
| G8 | **Object-level state machines** — 每实例生命周期,不只 manifest 级别 | 行为 | **3 ✓ merged** | §3.11 中 `StateMachineDef`;绑到 z.enum 字段;transitions 可选命名一个 ActionDef 以获得治理+审计;boundary check 中 `op: { kind: 'transition' }`。 |
| G9 | **Classification tags** — 属性 + actions 上的 PII / sensitive / regulated 标记 | 治理 | **3 ✓ merged** | `PropertyMeta.classification: readonly Classification[]`(§3.1)。策划的核心分类法 `'pii' \| 'sensitive' \| 'regulated'` + 开放字符串扩展。`registry.getPropertiesByClassification(tag)` 用于 compliance 查询。 |
| G10 | **变更通知模型** — 数据变更上的 webhook / pub-sub | 行为 | **3 ✓ merged** | §4.8 中 `NotificationRule` + `NotificationChannel`;声明在 `ManifestDef.notifications`;内置 `sse` / `push` channel + 通过 `registerNotificationChannel` 的 `kind: 'named'` 逃生通道。 |
| G11 | **Action result schema** — Action 返回的 typed 声明 | 行为 | **3 ✓ merged** | `ActionDef.returnType?: z.ZodTypeAny`(§3.3);解析的返回作为 `ActionResult.returnValue` 交付(§5.3);通过 `zod-to-json-schema(returnType)` 向 agent 投影。 |
| G12 | **Property-level redaction / masking** — view-time PII 保护 | 治理 | **3 ✓ merged** | `PropertyMeta.redaction?: { roles, strategy, maskTemplate? }`(§3.1)。§5.4 中的 pipeline:boundary check 后、返回前应用 `mask` / `hash` / `omit`。按计划与 G9 捆绑。 |
| G13 | **Lineage / provenance** — "什么产生了这条 `StudentAlert`?"图 | 生命周期 | **4** | 不建。现有 `tool_events` audit 表已经提供 per-call 可追溯性。完整 lineage graph 是 Foundry 规模问题;我们没有。 |
| G14 | **带 PR review 的 Schema branching** — 提议 ontology 变更供人工 review | 生命周期 | **4** | 不建。Solution 注册已经 restart 便宜;在 Solution backend 自己的 code review 处门控。在此加 workflow infra 会重复 review 面。 |
| G15 | **Object Set 版本化** — 快照一个 filtered set 以便复现 | 生命周期 | **4** | 不建。Manifest-instance 版本化(design §9.1)覆盖了客户真正需要的审计复现。Set-level 快照是 over-engineering。 |
| G16 | **Datasource binding** — 外部数据到 ObjectTypes 的声明式映射 | 类型系统 | **4** | 不建。CcaaS 没有统一数据平面(每个 Solution 拥有自己的 DB);强加 binding 层会逼每个 Solution 做 backend 重写,没有回报。 |
| G17 | **MDM / golden records** — 去重、规范实体解析 | 行为 | **4** | 不建。Solution 专属关切;本包只会碍事。 |
| G18 | **Geospatial / time-series 作为一等 property 类型** | 类型系统 | **4** | 不建。`type: 'json'` 覆盖罕见情况。提升为一等会拉进坐标系约定、indexing 语义、chart-rendering 决定,这些应该住在 Solution。 |
| G19 | **Workshop / Quiver — 应用构建器 UI** | (范围外) | **4** | 不建。ADR-0001 实际上禁止它:应用层是每个 Solution 自己的前端。我们提供 schema;Solutions 提供 UI。 |
| G20 | **自有 property type system** — 拥有我们自己的 `PropertyType` 联合、`PropertyDef` 形状等 | 类型系统 | **(cleared — 设计上不同)** | 委托给 Zod(运行时)+ TypeScript(编译期)。仓库其余地方已经到处用 Zod(live-lesson `manifest.schema.ts`、ToolCallerProxy `argsSchema`)。拥有平行类型系统会逼 solutions 把每个字段声明两次。见 §2.6。 |

**Tier 1 在 [impl plan](./kedge-ontology-implementation-plan.md) 的 Phase 1 同一个 PR 落地。** Tier 2 在 Phase 3 上线后、第一个真实 `ManifestDef` 证明 MVP 后 graduate 进 design spec。Tier 3 有下面 per-item 文档化的明确 *promotion criteria*。Tier 4 关闭;重开需要 ADR。

---

## 1. 方法论

### 1.1 本文档里"Palantir Ontology"指什么

我基于 Palantir Foundry Ontology 和 AIP 层的公开材料,这些是训练时可获得的。具体概念:

- **Object Types**(带 properties 的 typed 业务对象)
- **Link Types**(typed 关系)
- **Action Types**(治理的写操作)
- **Function Types** / **Functions on Objects**(typed、可部署、无副作用或有副作用的 computations)
- **Interface Types**(polymorphism / 跨 Object Types 的共享 contract)
- **Object Sets**(一等 typed 集合)
- **Branching**(在隔离中提议 ontology 变更,review 后合并)
- **Lineage**(从 datasource 经 transformation 到 ontology 的 provenance graph)
- **Workshop / Quiver / Slate**(Ontology 之上的应用构建器层)
- **AIP Agent Studio**(把 Ontology 绑为 tools 的 LLM agents)
- **Row-level / column-level 安全**(按 row 过滤用户看什么、按 column 掩码用户看什么的 predicates)

我**不**引用具体 Palantir API 语法或 licensing 细节 — 那些会变,我不想把设计决定锚定在可能演化的东西上。Gap analysis 在概念级工作。哪里我说"Palantir 做 X",请读作"Palantir Ontology 的公开概念模型做 X" — 不是"我们应该匹配 Palantir 的具体 API"。

### 1.2 "适用于 CcaaS"指什么

只有四个条件都成立,一个 Palantir 能力才*适用*于 kedge-ccaas:

1. **它通过 ADR-0001** — 该能力不要求我们在 core 拥有 domain entities 或持有统一数据平面。(否决 datasource binding、MDM、完整 lineage。)
2. **它服务 agents *和* humans** — Palantir 把 Workshop 的大部分建给点按钮的 humans。我们需要每个原语既 human-friendly(Picker)又 agent-friendly(semantic projection)。(直接否决 Workshop;不否决 Workshop 构建之上的*概念*。)
3. **我们的客户会部署它** — 中国政府/教育局不会接受要求 Foundry 级别基础设施的部署。(否决完整 lineage graph;论证运行时 schema 分发。)
4. **落地的第一个 Solution 证明我们需要它** — 我们不做预先脚手架。(把 Tier 3 与 Tier 2 分开:Tier 2 = "live-lesson MVP 需要它";Tier 3 = "第二或第三个 Solution 会需要它"。)

### 1.3 Tier 标签指什么

| Tier | 含义 | 本 PR 上的动作 |
|---|---|---|
| 1 | 概念错误 — 缺失的原语把两个不同意图坍缩成一个,或迫使重复模式进入 handler 代码 | 立刻合并入 design spec(本 PR) |
| 2 | 第一 MVP follow-up — design spec 没它也对,但第一个真实 Solution 会想要 | 留在本文档;impl plan Phase 3 后 graduate |
| 3 | "Solution 提出时再采纳" — 有用,但没具体触发就预先做 | 留在本文档,带明确 promotion criterion |
| 4 | 非目标 — gap 真实;对我们具体部署模型,代价 > 价值 | 留在本文档作为决策存档;重开需要 ADR |

---

## 2. Gap 清单

### 2.1 类型系统 gaps

#### G1 · Function Types(Tier 1)

**问题。** 今天我们有 `ActionDef`(治理、审计、可能 approval-gated)和 `computed: true` 的 `PropertyDef`(单对象上只读派生值)。没有形状对应"agent 可带参数调用的 typed、无副作用 computation" — 例如*"给这两个学生和一个时间窗,返回他们的交互图"*。这坍缩为两者之一:
- `computed` 属性 — 但 `computed` 是 per-object 且无参数。
- `auditLevel: 'none'` 且空 `sideEffects` 的 `ActionDef` — 但 schema 那时就在意图上撒谎:没东西告诉 agent(或 reviewer)这*定义上*是安全调用的。

**Live-lesson 例子。** `computeEngagementScore(studentId, windowMinutes) → number`。今天这要么是 Service 方法(agent 看不到,需要手工 prompt)要么是退化的 Action。都不对。

**Palantir 做法。** Functions on Objects(FoO)— typed、可部署、在 schema 级声明,以无副作用区分于 Actions。inspect ontology 的 agent 知道哪些调用是 cost-free 的。

**我们加什么(Tier 1)。** 新 `FunctionDef` 作为 `ActionDef` 的兄弟。概念形状:`{ apiName, displayName, params, returnType, semantic, allowedRoles }`。无 `sideEffects`、无 `auditLevel`、无 `preconditions`、无 `requiresApproval` — 其纯净性是结构性的。在桥层,FunctionDef 派生的 `ToolDefinition` 只记录 `'log'` 级审计(从不 `'full_diff'`),且 `checkBoundary` 完全跳过 approval gate。

**不加的后果。** Agent 将继续需要手写提示来区分"你可以随便调"与"这会写 DB"。每个为此区分花的 prompt-engineering 小时都是缺失原语的隐藏症状。

---

#### G4 · Interface Types(Tier 2)

**问题。** 多个 `ObjectTypeDef` 经常共享一个 contract:"任何可以在 chat 里 `@` 提到的东西"、"任何可以在 full-diff 级别审计的东西"、"任何参与父/子层级的东西"。今天,满足这些 contract 是重复自己 — 每个 `ObjectType` 重新声明相同的 properties。

**Live-lesson 例子。** `Student`、`Teacher`、`Parent` 都会是 `Mentionable`(图标 + 可搜索名字 + 显示模板)和 `Personal`(PII 标记、redaction 规则)。今天强制"每个 Mentionable 有 `searchFields` 声明"的唯一方式是 reviewer 警惕。

**Palantir 做法。** Interface Types — 声明 required properties + links + actions 的抽象 contract;Object Types 声明 `implements: [...]`。Picker/agent/audit 层可以查询"给我所有注册的 `Mentionable`"而不命名个别类型。

**我们加什么(Tier 2)。** `InterfaceDef`(apiName + required property/link/action signatures + semantic)和 `ObjectTypeDef.implements: readonly string[]`。注册时 validator 检查实现类型的实际 signatures 匹配 interface(结构一致性,不是 nominal)。`OntologyRegistry.getImplementersOf(interfaceName)` 启用"所有 Mentionables"查询。

**不加的后果。** 每个新 domain(教育之后)手工重建 Mentionable / Auditable / Hierarchical 模式。模式跨类型不可见;reviewer 强制不了。

---

#### G6 · Object Sets 作为一等类型(Tier 2)

**问题。** *命名、typed、filtered 的对象集合* 到处临时出现。"本 session struggling 的学生"。"过去 3 节课用的 resources"。"等张老师批改的 submissions"。今天这些是带硬编码 filter 逻辑的 derived slots 烤进 manifest,且不能:
- 作为 Action 参数传递(`bulkFlag(studentSet: ObjectSet<Student>, reason)`)
- 从另一个 manifest 引用(`SemesterPlan` 显示"跨多个 LessonSession struggling 的学生")
- 通过已知 query key 缓存或失效

**Live-lesson 例子。** 今天 `students` slot 带 `derivedFrom: 'class.contains'` 是退化情况 — 未过滤,就"全部"。没有语法对应"engagementScore < 30 的学生"作为可复用的命名 set。

**Palantir 做法。** Object Sets 是一等 — 用对一个 Object Type 的 filter 表达式定义它们;它们可以传递、版本化、用作参数或 join target。

**我们加什么(Tier 2)。** `ObjectSetDef { apiName, objectType, filter: SetFilter, semantic }`。`SlotDef` 可以 target 一个 object set(`target: { kind: 'objectSet', name }`)。Actions 可以接 `ObjectSet<T>` 参数。Filter 是一个小的声明式表达式语言(≥、≤、==、in、has、and/or)— 设计上不是图灵完备的沙盒。

**不加的后果。** 多对象批量 actions("flag this set 里所有 students")迫使 handler 一个一个迭代。derived 集合的跨 manifest 复用变成 copy-paste。

---

### 2.2 治理 gaps

#### G2 · Action preconditions(Tier 1)

**问题。** 今天每个 Action handler 开头都是同样模式:"如果 `phase !== 'practice'` 提前返回"。这种 pre-dispatch validation 对 agent 不可见 — agent 只通过尝试并失败才学到约束。

**Live-lesson 例子。** `adjustDifficulty` 只应在 `phase === 'practice'` 时可调;`endLesson` 只应在 `phase ∈ {'discuss', 'takeaway'}` 时可调。今天,两个检查都在 handlers 里,`discoverActions()` 不论状态如何都欢快地列出它们。

**Palantir 做法。** Action Type preconditions — 对周围状态的声明式 predicates;运行时在 dispatch 前求值它们,暴露"当前 context 可用 actions"过滤为已满足 preconditions 的。

**我们加什么(Tier 1)。** `ActionDef.preconditions: readonly ActionPrecondition[]`。形状是小的区分联合:state-equality(`{ kind: 'stateEquals', path, value }`)、slot-bound(`{ kind: 'slotBound', slot }`)、custom-named predicate(`{ kind: 'named', name, params? }`)。`checkBoundary` 在 role check 之后、dispatch 之前求值它们;失败返回 `{ allowed: false, unmetPreconditions: [...] }`。`discoverActions()` 尊重同样的求值,使 agent 只看到当前实际可调的 actions。

**不加的后果。** 两个代价:prompt-engineering("提示:除非 phase 是 practice,否则别调 adjustDifficulty")和看起来像 agent confusion 的静默失败。

---

#### G5 · Predicate-based AccessBoundary(Tier 2)

**问题。** 今天 `AccessBoundary.readable` 是路径字符串列表:`['plan', 'class', 'students']`。没有语法对应*row-level* 过滤,如"agent 可读所有 `ClassroomEvent` 但只是*本 manifest's class 中*学生的"。我们近似为读整个 slot 然后信任 handler 不泄露;那不是安全主张,是契约。

**Live-lesson 例子。** `LessonSession.boundaries[role='picker'].readable: ['students']` 当前意味"读绑定 class 附着的所有 students"。如果 lesson A 中的老师按 `@` 跨到 lesson B 的名单 — § 9.4 的 `crossManifestSources: ['sibling']` 机制 — 我们得到 B 名单的*全部*,不是"B 中曾出现在 A 的 students"。没有 predicates,跨 manifest references 比应该更粗。

**Palantir 做法。** Object Types 上的 row-level 安全表达式;predicates 可引用请求者的身份(`currentUser.id === student.teacher_id`)或任意字段。

**我们加什么(Tier 2)。** `readable` 和 `writable` 接受路径字符串(今天形式)或 `{ slot: string, where: BoundaryPredicate }`。Predicates 引用 (a) 请求者的 `ExecutionContext`、(b) slot 绑定对象字段、(c) manifest state。与 `ObjectSetDef.filter`(G6)同样的表达式 sub-language — 共享 parser。

**不加的后果。** 跨 manifest references 仍粗。审计级 row-level 主张必须在 handler 代码做;schema 证明不了。

---

#### G9 · Classification tags(Tier 3)

**问题。** Properties 和 actions 不带关于法规分类(PII、sensitive、regulated)的元数据。今天 compliance reports 是 case-by-case:"这个 property 是 PII 字段吗?" 通过读 property 名字猜来回答。

**Live-lesson 例子。** `Student.name` 是 PII;`Student.engagementScore` 是派生分析;`flagForIntervention.reason` 是老师写的自由文本,可能偶然包含 PII。今天都没标记。

**Palantir 做法。** Object Types / properties / actions 上的 classification tags;classification-aware 查询(如"列出 Solution X 过去 30 天访问的所有 PII 字段")运行在元数据层。

**我们加什么(Tier 3 — 第一个 Solution 提出时)。** 在 `PropertyDef` 和 `ActionDef` 上加 `classification?: readonly Classification[]`。`Classification` 是开放 enum(`'pii' | 'sensitive' | 'regulated' | string`),让 Solutions 可扩展分类法。Audit sink 可读它用于 compliance 报告。

**Promotion criterion。** 第一次教育局审计要求"显示 live-lesson agent 在 2026 年 10 月访问的每个 PII property"。

**不加的后果。** Compliance 报告仍手工。直到我们拿到第一个审计要求都可接受;之后就贵了。

---

#### G12 · Property-level redaction / masking(Tier 3)

**问题。** 一些观察者 role 应看到 property 被 mask,不是缺失。"系统审计员看到学生名字显示为 张**"与"学生名字不在审计员可读列表"不同 — 后者丢字段存在性;前者保留形状。

**我们加什么(Tier 3)。** 与 G9 捆绑:`PropertyDef.redaction?: { roles: readonly BoundaryRole[], strategy: 'mask' | 'hash' | 'omit' }`。`ManifestAccessor.readSlot` 在 boundary check 后、返回前应用 redaction。

**Promotion criterion。** 与 G9 同 — 一起采纳。

---

### 2.3 行为 gaps

#### G7 · 声明式 validation rules(Tier 3)

**问题。** 今天 schema validation 是结构性的("`phase` 是这些 enum 值之一")。它不是 domain-rule-aware("`duration` ≤ 60 分钟除非 `gradeLevel === '高中'`")。Domain rules 住在 handler 代码,agent 和其他消费者看不到。

**Live-lesson 例子。** `LessonPlan.durationMinutes` 应为小学 ≤ 45、初中 ≤ 60、高中 ≤ 90。今天这住在 `LessonService.validateLessonPlan()`,直到 `create` 调用失败 agent 才知道。

**Palantir 做法。** 按 Object Type 声明的 Validation Rules;每次写时求值;以结构化原因向 agent 和人工 reviewer 暴露失败。

**我们加什么(Tier 3)。** `ObjectTypeDef.validationRules?: readonly ValidationRule[]`。`ValidationRule = { name, expression: BoundaryPredicate, severity: 'error' | 'warn', message: LocalizedString }`。写时由 `checkBoundary` 求值;失败在 `ActionResult.error` 中以 `validationFailures: [...]` 字段浮出。

**Promotion criterion。** 第一个有超过 3 条 domain rules 当前住在同一 Object Type 的 service 方法的 Solution。

---

#### G8 · Object-level state machines(Tier 3)

**问题。** `LessonSession` `ManifestDef` 有生命周期 hooks(`onActivate`、`onDeactivate`)。但个别对象常有自己的生命周期 — `Submission` 转换 `draft → submitted → graded → reviewed`,某些转换需要 approval。今天这是 service 方法代码;agent 不知道从给定 state 出哪些 transitions 合法。

**Palantir 做法。** 一些 Object Types 声明 state-machine 列;transitions 是一等操作,带自己的 preconditions 和 audit 策略。

**我们加什么(Tier 3)。** `ObjectTypeDef.stateMachine?: { property: string, transitions: readonly Transition[] }` 其中 `Transition = { from, to, action?: string, requiresApproval?: boolean, semantic }`。命名的 `action`(如果存在)是执行 transition 的 `ActionDef` — 免费给我们治理+审计。

**Promotion criterion。** 第一个有 Object Type 其预期生命周期有 ≥4 个不同 state 的 Solution。

---

#### G10 · 变更通知模型(Tier 3)

**问题。** 今天通知老师手机当 `phase` 改变,需要 handler 代码调一个 SSE broadcaster、push-notification service、或两者。通知目标不在 schema 中声明 — 审计"什么时候通知什么"需要读每个 handler。

**我们加什么(Tier 3)。** `ManifestDef.notifications?: readonly NotificationRule[]` 其中 `NotificationRule = { on: 'stateChange' | 'actionResult' | 'streamEvent', match: BoundaryPredicate, channel: NotificationChannel, semantic }`。运行时通过现有 core 通知子系统触发;schema 变成真源。

**Promotion criterion。** 跨 Solutions 第三个独立 notification handler 实现。

---

#### G11 · Action result schema(Tier 3)

**问题。** `ActionResult.stateChanges` 是唯一结构化返回面。更丰富的返回(如 `bulkFlag` 返回 per-student 结果列表)被塞进底层 `ToolResult.content[0].text` 作为 JSON blob,agent 通过尝试再解析。

**我们加什么(Tier 3)。** `ActionDef.returnType?: PropertyDef`(或 `ObjectTypeDef` 引用)— 声明结果除 state changes 外是什么。桥把 typed 返回附到 `ActionResult.returnValue: unknown` 带文档化形状。

**Promotion criterion。** 第一个有用返回超过单个 state-change 记录的 Action。

---

### 2.4 生命周期 gaps

#### G3 · `displayName` 上的 i18n(Tier 1)

**问题。** `displayName: string` 是单语言。我们主要客户是中国政府教育;某些 Solutions 某时会需要英文;今天 schema 中没有放英文标签的地方。

**Live-lesson 例子。** `LessonPlan.displayName = '教学计划'` — 好。但同一 `ObjectTypeDef` 某时会需要 `'Lesson Plan'` 给英文本地化老师 dashboard。Solution backend 当前通过忽略 `displayName` 做自己的 i18n 来解决;schema 丢信息。

**Palantir 做法。** 元数据层的本地化标签带默认 locale fallback。

**我们加什么(Tier 1)。** 引入 `LocalizedString = string | Readonly<Record<string, string>>`(联合,所以纯字符串仍工作 — 对不在乎的 Solution 无破坏变更)。把 design spec 中每个 `displayName: string` 换为 `displayName: LocalizedString`。`OntologyRegistry.getDisplayName(def, locale?)` 是返回匹配 locale 或 fallback 到默认的薄 resolver。

**不加的后果。** Schema-driven UIs(Phase 3 后的 picker)无法以英文渲染。后加 i18n 是每个消费者 typed-API 的破坏变更;现在加是非破坏联合。

---

#### G13 · Lineage / provenance(Tier 4)

**它会做什么。** 追踪"这条 `StudentAlert` 是 session `sess_abc` 中的 `flagForIntervention` 调用产生的,作为对 `Submission sub_42` 触发的 `ClassroomEvent ev_xyz` 的响应"。对事故调查有用。

**为什么不做。** `tool_events` 审计表已经提供 per-call 可追溯性 — `auditId` 链接 Action → invocation context → 原始 session。完整 Palantir lineage graph 是*transformation* lineage(datasource → dataset → derived dataset → ObjectType),这里不适用,因为我们没有 datasource binding(G16)。如果真实事故要求审计日志拿不到的传递性追踪,重开。

---

#### G14 · 带 PR review 的 Schema branching(Tier 4)

**它会做什么。** Solution 维护者针对一个 branch 提议 ontology 变更;reviewers 批准;merge 把变更推到 live。

**为什么不做。** Solution 注册已经 restart 便宜 — gate 是 Solution backend 自己的 code review。在此加 branching infra 会重复 review 面。如果某客户跨多个独立维护的 Solution backend 共享一个 Solution 的 ontology(今天没有此场景),重开。

---

#### G15 · Object Set 版本化(Tier 4)

**它会做什么。** 快照一个 filtered set("2026-05-29 10:30 struggling 的学生")以便复现。

**为什么不做。** Manifest-instance 版本化(design §9.1)覆盖客户实际需要的审计复现("用原 schema 重放本 session state")。Set-level 版本化是我们不付存储代价的细粒度便利。如果 compliance 要求"决定时点 struggling 学生的精确名单"带字节稳定身份,重开。

---

### 2.5 Cleared — 刻意不采纳

本节最重要:它解释了我们*作为 gaps 接受*的 gaps,因为关闭它们的代价超过对我们具体部署模型的价值。未来贡献者应该通过写 ADR 来挑战这些,不是偷偷溜进实现。

#### G16 · Datasource binding

Palantir 的 Ontology 坐在 Foundry 的统一数据平面上:每个 Object Type 声明哪些 dataset(s) 支撑它,运行时从那些 datasets 物化对象带完整 lineage。我们没有统一数据平面 — 每个 Solution 拥有自己的 DB、ORM、持久层 — *强加*一个会逼每个 Solution 做 backend 重写。Ontology 保持存储无关;Solutions 注册 `EntityContextProvider` 桥到自己的数据层。

#### G17 · MDM / golden records

主数据管理 — 把 "Acme Corp" 和 "Acme Corporation" 去重到一个规范实体 — 高度 domain-specific。需要它的第一个 Solution 应该在自己 backend 用 domain-aware 匹配规则解决。把 MDM 放在本包要么无用(对哪些字段是身份性的无观点)要么侵入(逼每个 Solution 采纳单个匹配框架)。

#### G18 · Geospatial / time-series 作为一等 property 类型

Palantir 把 geo-shapes 和 time-series 提升为 typed properties 带内置 operators(spatial join、temporal interpolation)。需要这些的少数 Solutions 可以用 `type: 'json'` 加自己约定。提升为一等会拉进坐标系选择(WGS84? GCJ-02 因为我们在中国?)、indexing 语义、chart-rendering 决定,这些应该住在 Solution。如果一半活跃 Solutions 独立开始需要相同的 temporal-query 原语,重开。

#### G19 · Workshop / Quiver / Slate — 应用构建器 UI

Palantir 在 Ontology 之上 ship Workshop(dashboards)、Quiver(分析师 notebooks)、Slate(自定义 UIs)。我们模型中每个 Solution 拥有自己的前端;ADR-0001 实际上禁止我们拥有应用层。我们提供 schema;Solutions 提供 UI。未来 schema-driven `@Picker`(Phase 3+ follow-up)是 Solution UIs 的*构建块*,不是 Workshop。

它不是竞争性遗漏的第二个理由:**Palantir 自己也不在教育部署 Workshop** — 他们不规模化销售到教育垂直(见 design spec §1.0)。我们不是"在我们 domain 的应用层落后于 Palantir";我们在 Palantir 没 ship 任何应用层的 domain 操作。我们这里的缺席是非竞争决定,不是 feature gap。

#### 为什么具体是这些。

上面每项在抽象上看都很诱人 — 每个 Foundry demo 都强调它们。CcaaS context 因具体原因反驳每一项(无数据平面 / 无规范实体观点 / 两个 Solutions 都不共享空间需求 / 每个 Solution 拥有 UI)。在此写下它们的纪律就是不追求 parity for parity's sake 的纪律。

### 2.6 G20 · 类型系统委托给 Zod + TypeScript

**Palantir 做什么。** Palantir 的 Ontology 拥有一个 property 类型系统 — 原始类型、validation 规则、format 约束、enum 定义、外键解析。这对 Foundry 有意义:它拥有数据平面(Datasets → Pipeline Builder → Ontology),所以端到端拥有类型。

**我们做什么。** 我们不拥有数据平面(按 ADR-0001 — 每个 Solution 拥有自己 DB)。在本包拥有平行 property 类型系统会逼每个 Solution 把每个字段声明两次:一次在自己 TS interface(或 Zod schema、ORM entity),一次在我们的 `PropertyDef`。这是早期本设计陷入的失败模式;用户诊断为"在 TypeScript 之上建一个我们不需要的元类型系统",触发了成为当前 §3.1 的重构。

Zod-first 重构委托类型层:

- **运行时类型**:Zod(`z.string()`、`z.enum([...])`、`z.object({...})`、`.optional()`、`.describe('...')`)。Zod 已经在仓库中为同样目的存在:`solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`、`solutions/business/live-lesson/creator-mcp-server/src/schemas.ts`、`packages/backend/src/tool-caller/types.ts`(`ToolDefinition.argsSchema: ZodTypeAny`)。引入平行自定义形状会让本包是不一致的那个。
- **编译期类型**:`z.infer<typeof Schema>` — TS 类型来自 Zod schema。无需单独的 `interface Student { ... }` 保持同步。
- **传输格式**:`zod-to-json-schema(schema)` 用于 schema-distribution endpoint(design spec §9.6)和 agent 的 anthropic-tools / mcp-tools projections(§11)。
- **本包中存活下来的**:`PropertyMeta` — 一个小 sidecar 带 `searchable`、`displayRole`、`computed`、每属性 `displayName` i18n 覆盖。这些是 Zod 没有概念的治理/呈现 hints。Sidecar 由 `keyof z.infer<Schema>` 索引,所以拼错的 key 在 `defineObjectType` 调用点是 TS 错误。

**为什么这是 "cleared — 设计上不同"**:不是我们选择留开的 gap,不是推迟的采纳。是由我们部署模型驱动的对 Palantir Ontology 有意结构性差异。属于 §2.5 家族而非 §2.1(原 Tier 4 类型系统项住的地方),因为*意图* — 拥有一个类型系统 — 对我们 context 是错的,不是我们在它下面会建的具体 feature 错。

见 design spec §3.1(新 `PropertyMeta`)、§3.6(用 Zod 的 worked examples)、§10.1(reconciliation 表中委托的行)、§12 FAQ("为什么 Zod-first 而非自定义 PropertyDef?")。

---

## 3. 分 Tier 推荐(带后果)

上面的 Tier 分配是推荐。本节把它们重述为一个有序列表,每行带"如果我们推翻这个会怎样"的 call-out,使 reviewer 可以一行一行地不同意。

### Tier 1 — 现在合并入 design spec(本 PR)

- **G1 `FunctionDef`** · 如果不加,每个区分"可自由调"vs"有效"的 prompt 都把解释放在 system prompt 里而不是 schema 中。
- **G2 Action preconditions** · 如果不加,agents 会反复调 handler 拒绝的 actions,浪费 turn;reviewers 完全看不到门控逻辑。
- **G3 `displayName` 上的 i18n** · 如果不加,后加 i18n 破坏每个消费者的 typed API;现在加是免费的(与 string 联合)。

### Tier 2 — ✓ merged 入 design spec(2026-05-29)

原本处理是"Phase 3 上线后 graduate"。提前 graduate 因为 Tier 1 merge 证明了结构性模式(一个共享 sub-language、registry-resolved 原语、fail-fast validation)— 模式建立后,加另外三个原语的边际代价小,而*不*加它们的后果已经在设计讨论中浮现。

- **G4 Interface Types** · merged → design spec §3.8 `InterfaceDef`;§3.4 `ObjectTypeDef.implements`;§6 `OntologyRegistry.getImplementersOf()`;§9.7 结构一致性 validator。
- **G5 Predicate-based AccessBoundary** · merged → §4.4 `BoundaryPathEntry` 联合(对纯字符串向后兼容);§5.5 `BoundaryPredicate` sub-language + named-predicate 逃生通道;§9.7 路径/名称解析 validator。
- **G6 Object Sets 作为一等** · merged → §3.9 `ObjectSetDef` + `SetFilter`;§4.2 `SlotTarget.kind: 'objectSet'`;§3.1 `PropertyType: 'objectSet'` + `objectSetType?`;§6 `getObjectSet()` / `getObjectSetsForType()` / `registerObjectSet()`。

**Merge 期间共享基础设施得到整合。** 三个 Tier 2 项都复用同一个 first-order predicate sub-language(§5.5 的 `BoundaryPredicate`)。`ObjectSetDef.filter` 结构上是 `BoundaryPredicate` 的子集;`ActionPrecondition.kind: 'named'` 和 `BoundaryPredicate.op: 'named'` 都 dispatch 到通过 `OntologyRegistry.registerPredicate()` 注册的同一个 `PredicateImpl`。一个 predicate 定义跨三个原语可复用 — 单一真源。

### Tier 3 — ✓ merged 入 design spec(2026-05-29)

原本处理是"带命名 promotion criteria 采纳"。提前 graduate 因为 Zod-first 重构(G20)让每项边际代价小 — `validationRules` 是 Zod refines 之上的 sidecar;`stateMachine` 绑到 schema 中已存在的 z.enum 字段;`classification` + `redaction` 是已存在的 `PropertyMeta` 的额外字段;`notifications` 复用 §5.5 BoundaryPredicate language;`returnType` 就是个 Zod schema。五项,~6 KB design-doc 增加,无新基础设施。

- **G7 Validation rules** · merged → design spec §3.10 `ValidationRuleMeta`(命名 Zod refines 的 sidecar);§3.4 `ObjectTypeDef.validationRules`;§9.7 validator 强制名称链接到 refine `params.name`。
- **G8 Object-level state machines** · merged → §3.11 `StateMachineDef` + `Transition`;§3.4 `ObjectTypeDef.stateMachine`;§9.7 validator 强制 enum-field 绑定和 transition-value 有效性;§5.5 boundary check 获得 `op: { kind: 'transition' }`。
- **G9 Classification tags** + **G12 Redaction** · 一起 merged → §3.1 `PropertyMeta.classification: readonly Classification[]` + `PropertyMeta.redaction?: { roles, strategy, maskTemplate? }`;§6 `OntologyRegistry.getPropertiesByClassification(tag)`;§5.4 ManifestAccessor 中的 redaction pipeline。
- **G10 Change notifications** · merged → §4.8 `NotificationRule` + `NotificationChannel`;§4.6 `ManifestDef.notifications`;§6 `OntologyRegistry.registerNotificationChannel(name, impl)`;§9.7 validator 强制 predicate-path 解析。
- **G11 Action result schema** · merged → §3.3 `ActionDef.returnType?: z.ZodTypeAny`;§5.3 `ActionResult.returnValue?`;§11 projection 在 action descriptor 中包含 `zod-to-json-schema(returnType)`。

**共享基础设施杠杆**。与之前 Tier 2 merge 一样,Tier 3 便宜 graduate 因为基础决定已经付清。`validationRules` 复用 Zod `.refine()`(替代方案 — 单独的 predicate 表达式语言 — 在 §5 Q3 被拒绝)。`NotificationRule.match` 复用 §5.5 的 `BoundaryPredicate`。`Classification` 是开放字符串联合,镜像 `BoundaryRole` 的可扩展模式。`redaction.strategy` 是封闭 enum,因为运行行为是有界的。Tier 3 面**零**新增 sub-language — 每个新字段插入到为 Tier 1+2 建的基础设施。

### Tier 4 — 明确非目标

- **G13–G19** · 重开任一需要 ADR。上面的 cost / value 分析是记录的理由。

---

## 4. 对现有 design spec 的影响(每 Tier graduate 时)

对未来 merge 做预算有用。每行估计列出 gap 移入 spec 时在 `kedge-ontology-design.md` 内的编辑足迹。

| Gap | Tier | design spec 中变的 §§ | 估计编辑大小 |
|---|---|---|---|
| G1 FunctionDef | 1 | 新 §3.7;§10.1 reconciliation 行;§12 FAQ 条目;§2.1 public-API export 列表 | ~1.5 KB |
| G2 Preconditions | 1 | §3.3 ActionDef 扩展;§5.2 BoundaryDecision 扩展;§8.5 trace 获得 step 7.5 | ~1 KB |
| G3 i18n | 1 | §3 顶部新 `LocalizedString` 类型;§§3.1–4.6 TS blocks 中机械替换;§1.7 Principle 6 | ~1 KB 总 |
| G4 InterfaceDef | 2 ✓ merged | 新 §3.8;§6 Registry 获得 `getImplementersOf`;§9.7 validator 获得结构一致性规则 | ~3 KB(实际) |
| G5 Predicate boundary | 2 ✓ merged | §4.4 AccessBoundary 联合;新 §5.5 BoundaryPredicate sub-language spec;validator 更新 | ~4 KB(实际) |
| G6 ObjectSetDef | 2 ✓ merged | 新 §3.9;§4.2 SlotTarget 获得 `'objectSet'` kind;§9.6 distribution serializer 扩展 | ~3 KB(实际) |
| G7 Validation rules | 3 ✓ merged | 新 §3.10 ValidationRuleMeta sidecar 基于 Zod refines | ~2 KB(实际) |
| G8 Object state machines | 3 ✓ merged | §3.4 ObjectTypeDef 扩展;新 §3.11 StateMachineDef + Transition | ~2 KB(实际) |
| G9+G12 Classification + redaction | 3 ✓ merged | §3.1 PropertyMeta 扩展;§5.4 redaction pipeline 备注 | ~2 KB(实际) |
| G10 Notifications | 3 ✓ merged | §4.6 ManifestDef 扩展;新 §4.8 NotificationRule + NotificationChannel | ~2 KB(实际) |
| G11 Action result schema | 3 ✓ merged | §3.3 ActionDef 扩展;§5.3 ActionResult 获得 `returnValue` | ~1 KB(实际) |

**所有 Tier 1+2 落地的总和**:~13–14 KB 加到 design spec。可接受;即使 Tier 2 全展开 spec 也在 150 KB 之下。

---

## 5. 留给维护者的开放问题

Gap analysis 浮现的没有单一正确答案的项目。每项值得在相关 tier ship 前做设计讨论。

1. **Function vs Action 边界 policing。** 如果 `FunctionDef` handler 不小心改了 state,我们检测它(沙盒 handler? 运行时 contract check?)还是信任开发者?建议:像 TypeScript 其余一样,信任 + 文档化;只在它成为反复 bug 源时重新评估。
2. **Interface Type 方法 dispatch 时机。** 当 `Mentionable` 声明了 required `displayLine() → string` 而 `Student` 实现它:我们在注册时解析实现(compile-down)还是在 action 调用时(registry lookup)?后者更灵活;前者更快。建议:注册时,带 registry 级别 override hook 若 Solution 需要运行时 polymorphism。
3. **Predicate sub-language 范围。** G5 + G6 + G7 都需要小表达式语言。多丰富?比较 + 布尔 + 属性访问是最低;我们需要决定是否允许函数调用(滑坡)或保持 first-order(更安全)。建议:只 first-order;如果规则需要更丰富逻辑,逃生到 registry 注册的命名 `Predicate`。
4. **ObjectSet 身份。** 两个 filter 相同的 ObjectSets — 同一 set 还是不同?影响缓存、审计、引用相等。Palantir 把它们当相等;我们可能不想承诺那。建议:带显式 `apiName` 的结构相等 — 同 `apiName` → 同 set,无论 filter 等价性。
5. **State-machine 和生命周期交互。** G8(object state machine)与 §4.5(manifest 生命周期 hooks)在对象 transition 在 manifest hook 内触发时重叠。求值顺序、事务语义。建议:object-transition 先触发,manifest hook 拿到 post-transition state;任一失败,两个都回滚。
6. **Classification 分类法可扩展性。** G9 说 `Classification` 是开放 enum 所以 Solutions 可扩展。我们策划一个核心列表(`'pii' | 'sensitive' | 'regulated'`)吗?建议:策划三个核心值,文档化可扩展性,拒绝就层级取立场(无"pii 蕴含 sensitive"式推导)。
7. **Zod 到 PropertyMeta codegen。** 一些 Solutions 已经在别处维护丰富 Zod schemas(live-lesson `manifest.schema.ts` 是 15+ 内 schemas)。它们会从一个 `zod-to-property-meta()` helper 获益吗,该 helper 推断合理的 picker 默认(如第一个 `z.string()` 的 `displayRole: 'title'`、带某些 markers 的 `.describe()` 的任何字段的 `searchable: true`)?建议:推迟。Picker hints 是 intent,不是推导;auto-inferring 它们有静默搞错的风险。如果一个 Solution 有许多 ObjectTypes,写个 Solution-local helper;包不取立场。

---

## 6. 参考

通知本比较 Palantir 侧的材料。全部概念级 — 无 API-spec 引用。

- **Palantir Foundry / Ontology** 公开 marketing 和文档(Object Types、Link Types、Action Types、Interface Types、Object Sets、Functions on Objects、Branching、Workshop)。在 `palantir.com` 和 `palantir.com/docs/foundry/` 可获取 — 精确 URL 故意不锚定,因为那些文档的结构会变。
- **Palantir AIP** 公告和 demos(2023–2024)涉及 agents 绑 Ontology 为 tools、AIP Logic、AIP Agent Studio。
- 本 session 内部设计讨论(transcripts 未留;决定在本文档和 [design spec](./kedge-ontology-design.md) 中捕获)。
- [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) — 排除 G16、G17、G19 的架构约束。
- [Design spec §1.4](./kedge-ontology-design.md#14-why-ontology--the-palantir-inspiration) — 本 gap analysis 紧固的原"借思想,不借平台"框架。

---

> **维护者备注**:本文档是"我们选择不(暂)建什么"的真源。重开 Tier 4 项目只能用 ADR;通过编辑本文档、开整合它的 design-spec PR、在 §0 划掉它的行带 merging-PR 链接,来 promote Tier 2/3 项。
