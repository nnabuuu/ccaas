# kedge-ontology — 实现计划

> [design spec](./kedge-ontology-design.md) 的伴侣文档。Spec 描述这个包*是什么*;本文档描述它如何落地而不破坏现有消费者。
>
> 英文原版:[kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md)。

## 1. 背景 — 为什么现在落地

Design spec 于 2026-05-29 定稿。仓库里已经有与待建包重叠的工作原语:

- `EntityRegistry`(`packages/context-layer/src/core/entity-registry.ts`)近似于待建的 `OntologyRegistry`。
- `ReferenceableOptions`(`packages/context-layer/src/core/interfaces.ts`)近似于 `ObjectTypeDef.picker`。
- `EntityContextProvider` 覆盖了待建 `ManifestAccessor` 的 read/edit 面。
- `ToolCallerProxy`(`packages/backend/src/tool-caller/`)已经跑着 6 步治理 pipeline,`ActionDef` 会编译进它。
- Live-lesson 已经存了 `manifestJson` blob,并用 `manifest.schema.ts` 校验它 — `ManifestDef` 的前形式化版本。

风险:对这些原语的任何变更都会涟漪到 recipe-book、live-lesson、demo-sandbox,以及 React/Vue picker 消费者。本计划把工作分阶段,使任何阶段单独发布都不带破坏性变更。

**成功的样子:**

- `@kedge-agentic/ontology` 已在 workspace 发布,被 `context-layer` 消费。
- 一个 live-lesson `ManifestDef`(`LessonSession`)干净地注册。
- 一个 live-lesson `ActionDef`(从 `creator-mcp-server` 来的 `emit_todo_card`)通过 ontology 桥注册并通过现有的 MCP+SSE 流继续工作。
- `GET /api/v1/ontology/schema` 返回稳定的 digest;前端 `@Picker` 可被接线消费它(本里程碑不强制 — 接线是 follow-up)。
- 所有现有测试通过;harness checks 通过;`npm run typecheck` 在所有包都干净。

---

## 2. 五阶段迁移

> **为什么五阶段而不是原本的三阶段?** 原计划写于 Tier 2 + Tier 3 原语被 SPEC-merge 之前。一旦它们被 SPEC-merge,原本"Phase 1: bootstrap 一切"隐式扩张到了约 3× 的本意范围。把 Phase 1 拆为 v0.1 core(本 Phase 1)和 per-tier follow-up(Phase 4 和 5)保持每个阶段一个 PR 可发布,并保留原本"promotion criteria 仍适用于 IMPLEMENTATION"的意图 — 只有 SPEC 提前 graduate 了。Promotion criteria 参见 [gap analysis Tier 3 节](./kedge-ontology-gap-analysis.md#tier-3---✓-merged-into-design-spec-2026-05-29)。

### Phase 1 — Bootstrap `@kedge-agentic/ontology` v0.1(core + Tier 1,无消费者变更)

这是 Phase 2 之后 recipe-book 和 live-lesson 可以消费的最小可行包。**Tier 1 项(FunctionDef、ActionDef.preconditions、LocalizedString)在这里发布**,因为它们修复基础原语中的概念错误 — 它们是基础性的,不是可选扩展。

**范围**

- 创建 `packages/ontology/`,结构按 spec §2。
- 加 `zod`(v3,匹配仓库其余部分)和 `zod-to-json-schema` 作为运行时依赖。`zod` 已经通过 `ToolCallerProxy.argsSchema: ZodTypeAny` 传递性依赖了;把它提升为直接依赖是 Zod-first 重构的明文化。
- 实现**仅 core + Tier 1** schema 原语:`LocalizedString`、`PropertyMeta` + `PropertyMetaMap`(sidecar,无 classification/redaction 字段 — 那些是 Phase 5)、`objectRef`(branded Zod helper;`objectSetRef` 等 Phase 4)、`LinkDef`、`ActionDef` + `ActionPrecondition`(Tier 1;无 `returnType` 字段 — 那是 Phase 5)、`FunctionDef`(Tier 1)、`ObjectTypeDef`(`schema` + `meta`;无 `implements` / `validationRules` / `stateMachine` 字段 — 那些是 Phase 4-5)、`StreamDef`。
- 实现 `helpers/define.ts` — `defineObjectType<S>`、`defineAction`、`defineFunction`、`defineManifest`、`defineStateField`。(`defineInterface` 和 `defineObjectSet` 等 Phase 4。)
- 实现**core + Tier 1** manifest 原语:`SlotDef`(无 `'objectSet'` target kind — Phase 4)、`StateDef`(Zod 支撑)、`AccessBoundary` + `BoundaryPathEntry`(仅路径字符串条目;predicate 条目等 Phase 4)、`LifecycleDef`、`ManifestDef`(无 `notifications` 字段 — Phase 5)。
- 实现 `accessor/` types + `checkBoundary` pure function(无 per-row predicate 求值 — Phase 4)。
- 实现 `OntologyRegistry` v0.1 方法:对 ObjectType / Manifest / Function 的 register/get。Validators 强制 spec §9.7 的 Tier 1 规则(meta-key 有效性、refTarget 解析、derivedFrom 路径解析、semantic 非空)。
- 实现 `distribution/serialize.ts` + `digest.ts`(通过 `zod-to-json-schema` 规范化 Zod schemas)。
- 实现 `semantic/project.ts` + 三个格式 adapter:`anthropic-tools` 和 `mcp-tools` 是 `zod-to-json-schema(action.params)` 的薄包装;`system-prompt` 走 Zod schema 的 `.shape` 渲染每字段一条 markdown bullet。
- 每个原语、registry、validators、`checkBoundary`、每个 projection 格式都有单元测试。

**范围外(推迟到 Phase 4 或 5)**

- Tier 2 原语 — `InterfaceDef`、`ObjectSetDef`、`BoundaryPredicate` + predicate-scoped `AccessBoundary`(Phase 4)。
- Tier 3 原语 — `ValidationRuleMeta`、`StateMachineDef`、`PropertyMeta.classification`/`.redaction`、`NotificationRule`、`ActionDef.returnType` + `ActionResult.returnValue`(Phase 5,per-item 门控)。
- 任何对现有包的变更(Phase 2)。
- 任何 NestJS controller / endpoint(Phase 3)。
- `ActionDef` → `ToolDefinition` 的 schema-bridge(Phase 3)。

**退出标准**

- `npm run build:libs` 包含 ontology 并发出 `.d.ts`。
- `cd packages/ontology && npm test` 通过。
- 仓库根 `npm run typecheck` 通过。
- `packages/ontology/` 之外没有任何文件被触碰。
- 调用 `defineInterface(...)` / `defineObjectSet(...)` 是编译错误(这些 helper 还不存在) — 防止在 Phase 4 落地前误用 Tier 2 原语。

**风险**:五阶段中最低。纯加法;无消费者影响。

---

### Phase 2 — 重构 `context-layer` 消费 ontology

**范围**

- `packages/context-layer/package.json` 加 `@kedge-agentic/ontology` 作为依赖(workspace ref)。
- `EntityRegistry` 变成 `OntologyRegistry` 的薄重导出 wrapper。它现有的 public methods(`register`、`setRelations`、`getEntityTypes`、`registerProvider` 等)保持当前签名,使 recipe-book 和 live-lesson 不需要代码变更。
- `ReferenceableOptions` 变成结构上等同于 `PickerConfig` 的投影。加 converter `referenceableOptionsToPicker(opts): PickerConfig` 和 `pickerToReferenceableOptions(picker): ReferenceableOptions` 以支持双向兼容。
- `EntityContextProvider` 获得一个默认 adapter,暴露一个 `ManifestAccessor` 兼容的 facade,对应单 slot manifest(一个 slot = 一个 entity)。这是 opt-in;现有调用点不变。
- **Schema introspection 桥**:`EntityRegistry.getEntityTypes()` 继续返回 legacy `EntityTypeInfo` 形状以保持向后兼容,但*也*暴露 `getObjectTypeSchema(typeName): ZodObject | undefined`,让下游消费者(recipe-book、未来的 schema-driven @Picker)可以直接 introspect Zod schema。Recipe-book 的现有调用点不变;只有*新*代码路径使用 schema accessor。
- 消费者看不到任何行为变更。`packages/context-layer/` 和 `solutions/business/recipe-book/` 中的测试继续通过,无需编辑。

**范围外**

- Live-lesson adoption(Phase 3)。
- 新的 REST endpoints(Phase 3)。
- `@Picker` UI 切换到 ontology-driven 渲染(Phase 3 后的 follow-up)。

**退出标准**

- `packages/context-layer/`、`packages/context-layer-react/`、`solutions/business/recipe-book/` 中所有测试通过。
- 仓库根 `npm test` 通过。
- `bash scripts/harness-checks.sh` 通过。
- Recipe-book end-to-end picker flow 在 dev 中无变更地工作(`cd solutions/business/recipe-book && npm run dev`)。

**风险**:中等。重构共享基础设施。缓解:在重构落地*之前*,把 behavioral parity tests 加到 `packages/context-layer/`(快照 recipe-book 的现有 `EntityRegistry.getEntityTypes()` 输出,重构后断言相等)。

---

### Phase 3 — Live-lesson adoption + `ToolCallerProxy` bridge

> **Calendar 门控**:本阶段在成都教育局 PoC 上线之前**不得**开始。Live-lesson 是该交付的关键路径;Phase 3 给 live-lesson codebase 引入架构重构(LessonSession `ManifestDef` + ActionDef bridge),与 PoC 稳定化并行会增加耦合风险。PoC 上线后,把 Phase 3 当作无压力的重构跑,带完整 e2e 覆盖。Phase 2(context-layer 重构,recipe-book 是测试消费者)不受此门控影响 — 它在不触碰关键路径代码的前提下证明包能端到端工作。

**范围**

- 新文件 `packages/backend/src/ontology/action-to-tool-definition.ts` — spec §10.2 中的桥,把 `ActionDef` + handler 编译为注册到 `SolutionToolkitRegistry` 的 `ToolDefinition`。
- 新文件 `packages/backend/src/ontology/manifest-accessor.service.ts` — 默认 `ManifestAccessor` 实现,包装 `ToolCallerProxy`(对应 actions)+ `EntityContextProvider`(对应 slot 读)+ `SessionMetadata`(对应运行时状态)。
- 新 module `packages/backend/src/ontology/ontology.module.ts`,把上面这些接线起来,加上:
- 新 controller `packages/backend/src/ontology/ontology.controller.ts`,暴露 `GET /api/v1/ontology/schema`,ETag 来自 `OntologyRegistry.getSchemaDigest()`。必须有 `@ApiTags('ontology')`(按项目惯例 — 见 `CLAUDE.md`)。
- Live-lesson 定义其第一个 `ManifestDef`:`solutions/business/live-lesson/backend/src/ontology/lesson-session.manifest.ts`。Slots:`plan`、`class`、`students`(derived)、`resources`。Streams:`events`(GLM 观察)。State:`phase`、`activeResourceIndex`。Boundaries:`agent`(读 plan/class、写 phase、订阅 events)、`picker`(读 plan/class/students/resources 用于 @-references)、`admin`(`*`)。
- Live-lesson 通过桥重注册 `emit_todo_card`(里程碑内只这一个)作为 `ActionDef`。现有 MCP stdio server 路径继续工作 — 桥纯加法。
- Live-lesson 的 solution-startup hook 在 MCP 注册之后调 `OntologyRegistry.registerObjectType()` / `.registerManifest()`。
- 集成测试:session creator-flow 调用 `emit_todo_card` 通过桥,命中 `checkBoundary`,写入 `tool_events` 审计行,SSE `output_update(card)` 到达前端不变。

**范围外**

- 迁移*全部* live-lesson MCP tools(里程碑内只 `emit_todo_card` 证明路径)。
- Demo-sandbox adoption。
- @Picker UI 切换。
- Vue/React picker 消费 schema endpoint(follow-up 里程碑)。

**退出标准**

- `GET /api/v1/ontology/schema` 在 backend 全新启动后返回 200 带稳定 ETag;二次调用带 `If-None-Match: <etag>` 返回 304。
- `emit_todo_card` 在 creator flow 工作(手动 smoke-test:打开 creator 在 `:5284`,从 chat 触发 todo card)。
- 一个自动测试断言桥调用了 `checkBoundary` 且 proxy 仍然记录 `tool_events` 行。
- 现有 live-lesson e2e 套件(`solutions/business/live-lesson/e2e/specs/` 中 15 个 specs)通过。
- 文档:更新 `docs/gitbook/zh/platform/` 加新页 "Ontology 架构"(见下面 §5)。

**风险**:五阶段中最高。新 endpoint + 桥 + 第一个真实 `ManifestDef`。缓解:Phase 3 *内部*分阶段 rollout — 先以死代码形式落桥(注册但无 MCP tool 迁移),然后迁移 `emit_todo_card`。每一步独立可回滚。

---

### Phase 4 — Tier 2 原语实现

> **门控**:Phase 4 只在 Phase 3 已经发布*且*真实 Solution 表达了对至少一个 Tier 2 原语的需求之后才开始。按 gap analysis:Tier 2 项提前 SPEC-merge,但原本 "Phase 3 + 第一个真实 MVP 之后 graduate" 的时序仍适用于 IMPLEMENTATION。Spec 描述设计契约;本阶段使它可运行。

**范围** — 在包中实现 Tier 2 原语 + 加它们的 registry 方法 + 更新 validators:

- `InterfaceDef` + `InterfaceLinkSignature` + `InterfaceActionSignature`(spec §3.8);`OntologyRegistry.registerInterface` + `getInterface` + `getImplementersOf`;通过 `.shape` introspection 做结构一致性 validator 检查。
- `ObjectSetDef` + `SetFilter` + `OrderClause`(spec §3.9);`OntologyRegistry.registerObjectSet` + `getObjectSet` + `getObjectSetsForType`;`SlotTarget` 区分联合获得 `'objectSet'` kind;`objectSetRef()` helper;validator 检查 `objectType` 注册 + filter 路径解析。
- `BoundaryPredicate` + `PathExpr`(spec §5.5);`OntologyRegistry.registerPredicate` + `getPredicate`;`AccessBoundary.readable`/`writable` 接受 `BoundaryPathEntry` 联合(路径字符串或 `{slot, where}`);`checkBoundary` 在传入 row context 时 per row 求值 predicates;validator 通过 Zod schemas 检查 predicate 路径。
- `defineInterface` / `defineObjectSet` helpers 加到 `helpers/define.ts`。
- `OntologyTypeDef.implements` 字段变得可用(Phase 1 起已经在 TS 形状中,但 Phase 4 之前不强制结构一致性)。
- 每个的单元 + 集成测试。

**退出标准**

- 一个测试 Solution(扩展的 recipe-book 或合成测试台)声明一个 Interface(`Mentionable`)和两个实现者;`registry.getImplementersOf('Mentionable')` 返回两者。
- 一个测试 Solution 声明一个带 `lt`/`eq`/`and` filter 的 ObjectSet;ObjectSet 类型 slot 的 `readSlot` 只返回匹配的行。
- 一个测试 AccessBoundary 声明一个 `{slot, where}` 条目;`checkBoundary` 正确按 predicate 过滤行。
- 仓库根 `npm test` 通过;`bash scripts/harness-checks.sh` 通过。

**风险**:中等。每个原语大致自包含;predicate 求值与 `checkBoundary` 交互,后者有 Phase 1 的现有测试覆盖。

---

### Phase 5 — Tier 3 原语实现(per-item 门控)

> **每项门控**:Tier 3 有来自 [gap analysis](./kedge-ontology-gap-analysis.md#tier-3---✓-merged-into-design-spec-2026-05-29) 的**每项 promotion criteria**。每个 Tier 3 原语只在其指定 criterion 触发时才发布。**不要"因为在 spec 里就"预先实现 Tier 3 原语。** SPEC-merge 是文档决定;实现门控于真实需求。可能(很可能)结果:只有部分会落地。这是正确行为,不是 regression。

**项目,每项独立门控:**

| 原语 | Promotion criterion(来自 gap analysis) | 触发时落地什么 |
|---|---|---|
| `ValidationRuleMeta`(G7) | 第三个 Solution 在一个 Object Type 上有 ≥3 条 domain rules | 给 `ObjectTypeDef` 加 `validationRules` 字段;validator 强制 refine-name 链接;projector 给 agent 视图暴露规则 |
| `StateMachineDef`(G8) | 第一个有 ≥4 个不同生命周期 state 的 Object Type | 给 `ObjectTypeDef` 加 `stateMachine` 字段;`checkBoundary` 新 `op: { kind: 'transition' }`;validator 检查 enum 字段绑定 |
| `PropertyMeta.classification` + `.redaction`(G9 + G12) | 第一次审计要求"列出 Solution X 所有 PII 访问" | 给 `PropertyMeta` 加字段;加 `Classification` 类型;`OntologyRegistry.getPropertiesByClassification`;`ManifestAccessor.readSlot` 中加 redaction pipeline(boundary check 后应用 mask/hash/omit) |
| `NotificationRule`(G10) | 跨 Solution 第三个独立 notification handler | 给 `ManifestDef` 加 `notifications` 字段;`NotificationRule` + `NotificationChannel`;`OntologyRegistry.registerNotificationChannel`;post-action / post-state-change 的运行时 dispatcher |
| `ActionDef.returnType` + `ActionResult.returnValue`(G11) | 第一个其有用返回是结构化的(超过 state-change 记录)的 Action | 给 `ActionDef` 加 `returnType` 字段;给 `ActionResult` 加 `returnValue`;桥通过声明的 Zod schema 解析返回;projector 给 action descriptor 包含 `zod-to-json-schema(returnType)` |

**每项退出标准** — 对每项:一个 Solution 为真实用例(不是合成测试)注册它;agent 的投影视图显示它;一个 e2e 测试演练运行时行为。

**风险**:每项最低(每个小且独立);聚合风险 = "我们建了没人用的东西"。缓解:门控标准是明确的护栏 — 只在 criterion 满足时实现。如果三年过去 `NotificationRule` 从未触发,那是门控的成功应用,不是错过的特性。

---

## 3. Breaking-change 清单

| Phase | 下游消费者发生什么 | 需要的动作 |
|---|---|---|
| 1 | 无 | 无 |
| 2 | `EntityRegistry` 的内部存储转向 `OntologyRegistry`;public method 签名不变。`register()` 加新的可选第二参数 `objectTypeDef?: ObjectTypeDef` 用于新代码路径。 | 现有调用点无需动作。新代码可以传 `ObjectTypeDef` 获取更丰富的 schema。 |
| 3 | 新 REST endpoint `/api/v1/ontology/schema`;现有 endpoint 未触碰。`OntologyModule` 在 `AppModule` 中新引入。 | 无 — 纯加法。 |
| 4 | `ObjectTypeDef` 新可选字段(`implements`)、`SlotTarget` 新 discriminant kind(`objectSet`)、`AccessBoundary.readable`/`writable` 新条目形状(`{slot, where}` 与现有路径字符串的联合)。全部非破坏 — 旧数据形状仍能解析。 | 现有调用点无需动作。新代码可以用新形状。 |
| 5 | 每项:每个 Tier 3 原语给现有原语加一个可选字段(如 `ObjectTypeDef.validationRules`、`ManifestDef.notifications`)。全部可选。 | 每项无需动作 — 纯加法。 |

**五阶段全程无破坏性变更。** 每个旧调用点继续工作。

---

## 4. 测试策略

### 4.1 Phase 1(ontology 包)

- **单元**:每原语序列化往返、validator 覆盖(spec §9.7 每条规则一个测试)。
- **属性化**:registry `getSchemaDigest()` 顺序无关(用 2+ 顺序注册,断言 digest 相同)。包括 Zod-schema 规范化稳定性 — 不同方式构造的等价 Zod schemas(如 `z.object({...})` vs `z.object({...}).strict()`)必须产生等价 digest 贡献当且仅当它们通过 `zod-to-json-schema` 等价往返。
- **Projection 黄金**:§11.2–11.4 examples 的快照测试;`LessonPlan` ObjectTypeDef 的 projection 输出必须与 spec 中的 markdown / JSON 逐字匹配。快照输入是 spec §11.1 的 Zod schemas;输出是字节级 JSON / Markdown。(抓住文档与代码 *和* Zod 与 `zod-to-json-schema` 更新之间的漂移。)
- **Schema 健全性**:每个 `defineObjectType` 调用,`meta` 中每个 key 必须是 `z.infer<typeof schema>` 的 key。泛型约束在编译期抓它;validator 在运行期抓它;此测试断言两道门在故意破坏的 example 上都触发。
- **架构测试**:`packages/ontology/test/architecture.test.ts` 断言包导入零 solution-domain 类型 + 零 NestJS — 强制 spec §1.5 的 "framework-agnostic primitives" 主张。(注意:`zod` 和 `zod-to-json-schema` *是*允许的;它们就是 schema 层。)

### 4.2 Phase 2(context-layer 重构)

- **Parity**:重构前快照 recipe-book 的 `EntityRegistry.getEntityTypes()` 输出,重构后断言相等。
- **往返**:`referenceableOptionsToPicker → pickerToReferenceableOptions` 对所有注册的 live-lesson + recipe-book 类型是 identity。
- **集成**:完整 recipe-book 测试套件 + `packages/context-layer-react` `AtPicker` 渲染测试无变更通过。

### 4.3 Phase 3(live-lesson + 桥)

- **单元**:`actionToToolDefinition` 产出一个 `ToolDefinition`,其 `argsSchema.parse(validPayload)` 成功且 handler 调用 `checkBoundary`。
- **集成**:通过桥注册一个 `ActionDef`,通过 `ToolCallerProxyService.invoke()` 调用,断言 (a) `tool_events` 行写入、(b) `checkBoundary` 被正确 manifest+role 调用、(c) handler dispatched。
- **端到端**:live-lesson 的 `solutions/business/live-lesson-creator/scripts/poc-smoke.sh` 继续通过。
- **HTTP**:`GET /api/v1/ontology/schema` 返回预期 body 形状;ETag-conditional GET 行为正确(200 / 304 / 200 在注册变更后)。

### 4.4 Phase 4(Tier 2 原语)

- **单元**:结构一致性 validator 抓住每个不匹配情况(缺字段、类型不匹配、缺 link、缺 action);ObjectSet filter 求值正确性按每个 filter operator(eq/ne/lt/le/gt/ge/in/has/and/or/not);predicate 路径解析在注册期拒绝不可解析路径。
- **集成**:一个 Interface 带两个实现者用 `getImplementersOf` 的端到端测试;一个 ObjectSet 通过 `readSlot` 返回 filter 匹配行的端到端测试;一个 predicate-scoped `AccessBoundary.readable` 按 row-context 过滤行的端到端测试。
- **无 live-lesson regression**:重跑 live-lesson e2e 套件确认 Phase 4 加法不扰动 Phase 3 接线。

### 4.5 Phase 5(Tier 3 原语 — per-item)

- **每项单元测试**:每个原语落地时带自己的 validator-rule 覆盖(validation-rule name 链接、state-machine enum 绑定、classification 分类法有效性、notification predicate 解析、returnType Zod 有效性)。
- **每项集成测试**:每个原语一个 Solution 用例端到端演示运行时行为。**没有集成测试 → 不要发布这个原语**,即使其单元测试都绿。Promotion criterion 要求真实使用,不是合成。
- **合规审计 smoke**(当 `classification`/`redaction` 落地时):从 `getPropertiesByClassification('pii')` 产出一个样本审计报告;验证 redaction 策略输出与文档行为(mask/hash/omit)匹配。

---

## 5. Sequencing 备注

### 5.1 PR 形态

每阶段一个 PR。每个 PR 包括:

- 该阶段的代码 + 测试。
- 适用时更新 `docs/gitbook/zh/` 的文档(Phase 3 在 `docs/gitbook/zh/platform/` 下加一个 "Ontology 架构" 页;design spec 已经在 `docs/ontology/kedge-ontology-design.md`)。
- 适用时更新 `CLAUDE.md` 引用(root + `packages/backend/`)。
- 在 `docs/CHANGES_2026-05.md`(或 `06.md` 如果工作跨到六月)写一条描述用户可见影响的笔记。

### 5.2 依赖顺序

```
Phase 1 (v0.1 core + Tier 1)
    │
    ├──> Phase 2 (context-layer refactor, recipe-book is test consumer)
    │       │
    │       └──> Phase 3 (live-lesson adoption + bridge)
    │              │ [GATE: 成都 PoC 必须已经上线]
    │              │
    │              └──> Phase 4 (Tier 2 primitives implementation)
    │                     │ [GATE: 真实 Solution 需求]
    │                     │
    │                     └──> Phase 5 (Tier 3 primitives, per-item)
    │                            [GATE: 每项 promotion criterion]
    │
    └──> Phase 4 技术上可以与 Phase 2+3 并行启动
            (Phase 4 代码不依赖 Phase 2+3),但不应该 —
            没有真实 Solution 演练新原语,
            Phase 4 风险是建未使用的基础设施。
```

Phase 1 内部,schema 原语、manifest 原语、accessor 类型可以并行构建 — 它们是分离文件,在 registry 导入它们之前没有相互依赖。

### 5.3 每阶段回滚故事

- **Phase 1**:平凡可逆。删除包目录;无消费者受影响。
- **Phase 2**:revert `context-layer` PR。`EntityRegistry.register` 的新可选参数即使被移除也是非破坏的,因为还没有 production caller 使用它。
- **Phase 3**:revert live-lesson `ActionDef` 注册(solution-startup 中一行变更)和 `AppModule` 中的 `OntologyModule` import。Schema endpoint 变成 404;现有 MCP 路径未触碰,所以 `emit_todo_card` 继续以原始方式工作。
- **Phase 4**:每原语可回滚。每个 Tier 2 原语住在 `packages/ontology/src/schema/` 自己的文件;移除文件 + 它的 registry-method 接线 un-ship 它而不影响 Phase 1-3。
- **Phase 5**:每项平凡可回滚。每个 Tier 3 原语是现有原语的一个可选字段;移除字段 + 它的 validator 规则 + 它的消费者 un-ship 它。如果字段从未被真实 Solution 使用(因为没有 Solution 触发 promotion criterion),移除有零爆炸半径。

### 5.4 *刻意*推迟到后续里程碑的事

- `@Picker` UI 渲染由 `OntologyRegistry.getPickableTypes()` 驱动。当前它读 `EntityRegistry`;Phase 2 后那些是相同的数据,但把 React 组件切换到消费新形状是一个独立的影响 UX 的变更,值得自己的设计 pass。
- 迁移剩余的 live-lesson MCP tools(`emit_questions_card`、`emit_verify_card`)到 `ActionDef`。模式与 `emit_todo_card` 相同;桥稳定运行一个 sprint 无 regression 后再做。
- Demo-sandbox adoption。Sandbox 是 runtime 层的规范 e2e;给它加 ontology 有价值但不在教育局 PoC 的关键路径上。
- NestJS `@OntologyAction()` 装饰器,做工效友好的 action 注册(今天:solution startup 中显式 `registerToolkit()` 调用)。装饰器是糖;推迟到冗长形式已发布且我们知道摩擦点之后。
- **promotion criteria 未触发的 Tier 2/3 原语。** 按 Phase 4+5 门控,这些保留在 SPEC 但不在运行时。这是对"我们 SPEC-merged 了一切,为什么不全部建好?"的明确回答 — 在需求之前建是门控防止的失败模式。

---

## 6. 每阶段发布前的操作 checklist

按 `CLAUDE.md` 的 post-implementation checklist:

1. **测试**:`cd packages/backend && npx jest --no-coverage` 加上包专属套件:
   - Phase 1、4、5 → `cd packages/ontology && npm test`
   - Phase 2 → `cd packages/context-layer && npm test`(并跑 recipe-book 测试套件)
   - Phase 3 → `cd solutions/business/live-lesson/backend && npm test`(并 `poc-smoke.sh`)
2. **Code review**:`code-reviewer` agent 对 diff 中每个文件。
3. **Harness**:`bash scripts/harness-checks.sh`。
4. **门控验证**(仅 Phase 3、4、5):
   - Phase 3:确认成都 PoC 已上线再合并。
   - Phase 4:确认真实 Solution 表达了对至少一个 Tier 2 原语的需求(在 PR 描述中记录需求)。
   - Phase 5:每项,确认 gap analysis 的 promotion criterion 已触发(在 PR 描述中用具体引用记录:"Solution X 在 Y 上有 3 条 domain rules" / "Solution X 需要 Z 个生命周期 state" / 等)。

如果四项中任一失败,不要发布该阶段 — 修复并从第 1 步重跑。门控失败不是"跳过" — 它们意味着阶段没准备好,工作应该暂停,不是强推。

---

## 7. 开放实现问题 *(不阻塞 spec;构建期解决)*

这些是*实现*选择,不是设计决定。它们不门控 spec,但应该在相关阶段解决:

- **Phase 1**:Zod 现在按 Zod-first 重构(gap analysis G20)是规范的运行时类型层。原本 "hand-roll vs Zod" 问题已解决 — Zod 进。剩余开放问题:我们直接用 `zod-to-json-schema`,还是在注册时预生成 JSON Schemas 并缓存?建议:在 `register*()` 时预生成(代价在 boot 时付一次),缓存在 registry 上;`getSchemaDigest()` 用缓存的 JSON Schema 保证稳定。
- **Phase 2**:`EntityRegistry` 的进程内单例应该保留,还是切换到 NestJS DI?建议:保留单例 — `EntityRegistry` 已经在 NestJS 上下文之外被使用(React `AtPicker` 读它)。DI 会强加一个包不应该有的 Nest 依赖。
- **Phase 3**:*custom-role mapping table*(spec §10.3 最后一行)住哪 — `solution.json`、代码、还是 `OntologyRegistry`?建议:在 registry,与 `ManifestDef` 一起注册,这样它随 schema endpoint payload 一起传递。暂避免 `solution.json` 变更。
