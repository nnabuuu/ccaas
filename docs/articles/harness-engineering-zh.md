# AI Coding 项目的 Harness Engineering：让 Agent 不再犯同样的错

> 当你的 AI Coding Agent 第三次把 `serverUrl` 写成空字符串时，你会意识到：这不是 Agent 的能力问题，而是项目环境的记忆问题。

## 一个反复出现的 Bug

在我们的 KedgeAgentic 项目中，有一个 Bug 出现了三次。

前端 SDK 需要一个 `serverUrl` 参数来连接后端。正确的写法是 `http://localhost:3001`——一个绝对 URL。但 AI Agent 总是把它写成空字符串 `''`，看起来无害，却会导致所有请求发到前端端口而不是后端，API 全部 500。

第一次，我们修复了 Bug，在 PR review 里记了一笔。第二次，我们在 CLAUDE.md 里加了一行提醒。第三次，它又犯了——因为 CLAUDE.md 已经膨胀到 264 行，那条提醒淹没在大量信息中，Agent 根本没"看到"。

这个经历让我们意识到一件事：**Agent 反复犯错，不是因为它笨，而是因为项目环境没有建立有效的记忆和约束机制。**

这就像一个公司反复出现同样的运营事故——问题不在于员工不够聪明，而在于公司没有把教训变成制度。

## 核心洞见：Agent 犯错是环境问题，不是能力问题

让我们用一个类比来理解这件事。

想象两家公司同时招了一个新员工。A 公司的 onboarding 是一个老员工口头叮嘱了 30 分钟；B 公司有完善的入职文档、自动化的权限配置、CI 流水线上的规范检查。三个月后，A 公司的新人仍在犯"老员工都知道"的错误，B 公司的新人已经独立交付项目。

在 AI Coding 的语境中：

- **Prompt 就是"口头叮嘱"**——你可以在对话里反复提醒 Agent"不要用空字符串"，但每次新会话它都会忘。
- **Harness 就是"公司制度"**——它是持久化的、可执行的、不依赖记忆的约束系统。

我把围绕这个理念构建的工程实践称为 **Harness Engineering**——为 AI Coding Agent 设计和维护运行环境的工程学科。

## Harness Engineering 框架：5 个维度

### 维度一：Progressive Disclosure（渐进式信息披露）

**核心原则：CLAUDE.md 不是说明书，是目录。**

Agent 的 context window 是有限的预算。把所有规则、约定、架构决策都塞进一个文件，就像给新员工第一天扔一本 500 页的手册——他什么都记不住。

正确的做法是分层组织：

- **第一层（CLAUDE.md）**：项目结构、构建命令、快速规则速查——控制在 100 行以内
- **第二层（链接文档）**：约定细节、工作流程、开发原则——按需加载
- **第三层（包级文档）**：每个包自己的 CLAUDE.md 或 ARCHITECTURE.md——只在修改该包时加载

在 KedgeAgentic 项目中，我们把 CLAUDE.md 从 264 行精简到 76 行。关键手法是把内联的详细说明替换成指向独立文档的链接。Agent 在大多数任务中只需要 76 行的速查信息；当它需要修改特定包时，才会跟随链接读取详细文档。

### 维度二：Memory Architecture（记忆架构）

**核心原则：教训要可检索，不是堆砌。**

大多数项目的 auto-memory（MEMORY.md）是一个不断追加的流水账。随着时间推移，它会膨胀到几百行，超出加载限制被截断——最早的、往往也是最重要的教训反而丢失了。

有效的记忆架构需要两个机制：

1. **索引 + 主题文件**：MEMORY.md 只保留索引和速查规则（控制在 100 行以内），详细的技术教训拆分到独立的主题文件（如 `serverurl-pattern.md`、`architecture-boundaries.md`）
2. **语义组织**：按技术主题而非时间线组织。Agent 遇到 serverUrl 相关问题时，能直接定位到对应的主题文件，而不是在 500 行的流水账里大海捞针

我们的 MEMORY.md 从 665 行精简到 37 行。那些被截断的教训并没有丢失——它们被重新组织到 5 个主题文件中，变得更容易检索和维护。

### 维度三：Lessons → Constraints（教训变约束）

**核心原则：如果一个人会忘记它，就自动化它。**

这是整个框架中 ROI 最高的维度。原理很简单：把反复出现的错误从"文档里写了"变成"CI 里检查了"。

以 serverUrl 为例。在文档里写"不要用空字符串"，Agent 可能会忽略。但如果 CI 流水线里有一个 grep 检查：

```bash
# 检测生产代码中的空 serverUrl
grep -rn "serverUrl:\s*['\"]['\"]" --include="*.ts" --include="*.tsx" solutions/ packages/ \
  | grep -v "\.test\." | grep -v "\.spec\."
```

那么即使 Agent 犯了这个错误，CI 也会立即失败并给出明确的错误信息。Agent 看到失败原因后就知道如何修复——不需要任何人的"口头提醒"。

我们在 KedgeAgentic 中创建了 `scripts/harness-checks.sh`，目前包含两个检查：

1. 空 serverUrl 检测
2. 后端 Controller 的 @ApiTags 覆盖率

这个脚本在 CI 中作为独立的 job 运行，与 lint、typecheck、test 并行。每当我们发现一个反复出现的错误模式，就把它变成一个新的 grep 检查——成本极低（一行 grep），收益极高（永远不再犯）。

### 维度四：Quality Visibility（质量可见性）

**核心原则：Agent 需要风险信号，不仅仅是指令。**

当 Agent 要修改一个模块时，它需要知道这个模块的"健康状况"。一个测试覆盖完善、文档齐全的模块（Grade A），和一个没有测试、缺少文档的模块（Grade D），需要完全不同的谨慎程度。

我们创建了 `docs/QUALITY_SCORE.md`，为每个模块在四个维度（测试、文档、Swagger、类型）上打分：

| 模块 | 测试 | 文档 | Swagger | 类型 | 等级 |
|------|------|------|---------|------|------|
| backend/auth | ✅ | ✅ | ✅ | ✅ | A |
| backend/scheduler | ❌ | ⚠️ | ✅ | ⚠️ | D |
| admin-next | ❌ | ❌ | N/A | ⚠️ | D |

当 Agent 看到 `backend/scheduler` 是 D 级时，它会自动提高警惕——在修改前先读现有代码，考虑补充测试，而不是大刀阔斧地改动。

这个评分表的维护成本很低（每次改善测试或文档时更新一行），但给 Agent 提供的决策信号非常有价值。

### 维度五：Continuous Gardening（持续维护）

**核心原则：文档会腐烂，需要免疫系统。**

所有文档都有保质期。链接会失效，规则会过时，评分会不准确。如果没有维护机制，harness 本身也会腐烂——比没有 harness 更危险，因为 Agent 会基于过时的信息做决策。

我们建立了一个 doc-gardening skill，定期检查：

- CLAUDE.md 和 docs/ 中的文件链接是否有效
- MEMORY.md 是否超出大小限制
- 质量评分是否仍然反映现实
- 是否有过期的架构决策记录

这不是一次性的清理，而是一个可重复执行的审计流程。就像代码有 linter，文档也需要自己的"健康检查"。

## 实战案例：KedgeAgentic 项目改造

### Before：诊断

改造前，项目在 8 个维度上存在问题：

| 维度 | 问题 |
|------|------|
| CLAUDE.md | 264 行，信息过载，关键规则被淹没 |
| MEMORY.md | 665 行，超出 200 行加载限制，70% 教训被截断 |
| 教训转化 | 教训只存在于文档中，没有自动化检查 |
| 质量信号 | 无模块评分，Agent 不知道哪些模块需要额外小心 |
| CI 覆盖 | 有基础 lint/test/build，缺少领域特定的约束检查 |
| 文档维护 | 无定期审计机制，链接腐烂无人知 |
| 信息组织 | 所有信息堆砌在少数文件中，无分层 |
| 约定文档 | 约定散落在各处，无集中管理 |

### 6 项改进

1. **CLAUDE.md 瘦身**：264 行 → 76 行。内联内容提取为独立文档，CLAUDE.md 变成 TOC + Quick Reference
2. **MEMORY.md 重构**：665 行 → 37 行。教训拆分到 5 个主题文件，MEMORY.md 只保留索引和速查规则
3. **Harness Checks 脚本**：新建 `scripts/harness-checks.sh`，把 serverUrl 和 @ApiTags 两个反复出现的错误变成 CI 自动检查
4. **CI 集成**：在 GitHub Actions 中添加 `harness-checks` job，与 lint/test/build 并行运行
5. **Quality Score**：新建 `docs/QUALITY_SCORE.md`，为每个模块在测试、文档、Swagger、类型四个维度打分
6. **Doc Gardening Skill**：新建 `.claude/skills/doc-gardening/`，提供可重复的文档健康检查流程

### After：验证

| 指标 | Before | After |
|------|--------|-------|
| CLAUDE.md 行数 | 264 | 76 |
| MEMORY.md 行数 | 665 | 37 |
| 教训被截断比例 | ~70% | 0% |
| 自动化约束检查 | 0 | 2（可扩展） |
| 模块质量评分 | 无 | 11 个模块全覆盖 |
| 文档审计机制 | 无 | doc-gardening skill |
| CI harness job | 无 | 1 个独立 job |

## 可复制的改造清单

### 10 分钟快速诊断

回答以下 5 个问题，每个 0-5 分，总分 25 分：

1. **你的 CLAUDE.md（或等效的 AI 指令文件）有多少行？** 0 分 = 没有或超过 300 行，5 分 = 50-100 行且结构清晰
2. **你的 auto-memory 是否有主题拆分？** 0 分 = 所有教训在一个文件里或没有记忆，5 分 = 索引 + 主题文件，定期维护
3. **过去一个月反复出现的 Bug，有多少已经变成了自动化检查？** 0 分 = 一个都没有，5 分 = 所有已知的反复 Bug 都有 CI 检查
4. **Agent 能否一眼看出哪些模块风险高？** 0 分 = 完全不能，5 分 = 有模块级质量评分且定期更新
5. **你的文档有维护机制吗？** 0 分 = 写了就不管了，5 分 = 有自动化的链接检查和定期审计流程

### 改造优先级

**P0——先止血（1-2 小时见效）**

- 如果 CLAUDE.md 超过 150 行：拆分为 TOC + 独立文档
- 如果 MEMORY.md 超过 100 行：按主题拆分，只保留索引
- 如果有反复出现的 Bug：立即写一个 grep 检查加入 CI

**P1——建机制（半天工作量）**

- 创建 Quality Score 表，为每个模块打分
- 创建 harness-checks 脚本，集成到 CI
- 建立约定文档（CONVENTIONS.md）

**P2——长期维护（持续投入）**

- 创建 doc-gardening 流程，定期执行
- 每次修复反复 Bug 时，追加 harness check
- 每次改善模块质量时，更新 Quality Score

## 结语：飞轮效应

Harness Engineering 的真正价值不在于单次改造，而在于它建立了一个正向飞轮：

**Agent 犯错 → 写教训 → 变成约束 → 不再犯 → 更信任 Agent → 给更多自主权 → Agent 更高效 → ...**

每一次循环都让下一次循环的成本更低。第一个 harness check 需要你创建脚本、配置 CI；第二个只需要加一行 grep。教训的"库存"越来越丰富，Agent 的运行环境越来越健壮。

这不是一个一次性的项目改造——它是一种新的工程习惯。就像我们已经习惯了写测试、做 code review、跑 CI，在 AI Coding 的时代，我们还需要学会维护 Agent 的运行环境。

环境对了，Agent 自然就对了。
