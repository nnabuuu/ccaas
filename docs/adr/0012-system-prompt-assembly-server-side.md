# ADR-0012: System Prompt 组装职责下沉到服务端

**状态**: Accepted
**日期**: 2026-03-25
**决策者**: @niex

---

## 背景 (Context)

chat-interface Phase 2 实现了 `assembleSystemPrompt()` 函数（在 `preprocessor.ts`），设计初衷是前端负责组装 system prompt（base + skill + widgetCatalog + sessionContext）然后传给后端。

经过分析，后端已有完整的 system prompt 组装链：

1. **Skill prompt** — `SkillManagementService.generateSystemPromptForSession()` 自动匹配并注入
2. **Template appendSystemPrompt** — 租户 session template 配置
3. **MCP tool registry** — 自动从 MCP server 生成 tool 描述
4. **Bundle system prompts** — 附加提示
5. **前端 appendSystemPrompt** — 通过 API DTO 传入，append 到最后

前端 preprocessor 的 4 个职责中，3 个已由后端覆盖：

| 部分 | 后端已有？ | 结论 |
|------|-----------|------|
| base prompt | Yes — template `appendSystemPrompt` | 不需要前端 |
| skill prompt | Yes — `generateSystemPromptForSession()` | 不需要前端 |
| widget catalog | 部分 — 后端不知前端 widgets | 保留，简化 |
| session context | 部分 — static 少量注入可以，dynamic 走 MCP | 保留 helper |

架构方向已确认：domain-specific context 应由 Solution Chat Service（独立后端）通过 MCP 提供，让模型按需 pull，而非前端硬编码注入 system prompt。

---

## 决策 (Decision)

**我们决定**: System prompt 组装主要在服务端完成，前端只通过 `appendSystemPrompt` 字段传递 widget catalog 和少量 static context。

**详细说明**:

1. **服务端负责 system prompt 主体组装**：skill prompt、template prompt、MCP tool descriptions 均由后端处理
2. **前端通过 `appendSystemPrompt` 字段**只传递：
   - Widget catalog description（服务端不知道前端注册了哪些 widget）
   - 少量 static context（角色、学校等不变的会话上下文）
3. **Domain-specific dynamic data 通过 MCP server 提供**，不注入 system prompt
4. **`preprocessor.ts` 中的 `assembleSystemPrompt()` 废弃删除**，替换为职责更窄的 `buildAppendPrompt()`

---

## 考虑的方案 (Alternatives Considered)

### 方案 A: 维持前端全量组装

**描述**: 前端继续用 `assembleSystemPrompt()` 拼接完整 system prompt

**优点**:
- 无需改动现有代码

**缺点**:
- 与后端已有的 system prompt 链重复
- 前端需要知道 skill prompt 内容（应由后端管理）
- 职责边界不清晰

**为什么不选择**: 重复工作，且违反 skill prompt 由后端管理的架构原则

---

### 方案 B: 前端只负责 append 部分 **选择的方案**

**描述**: 前端通过 `appendSystemPrompt` DTO 字段只传递后端无法得知的信息（widget catalog + static context）

**优点**:
- 职责清晰：后端组装主体，前端补充前端特有信息
- 消除重复：skill/base prompt 不再两处维护
- 简化前端代码：preprocessor 从复杂组装变为简单拼接
- 与 MCP-first 架构方向一致

**缺点**:
- 需要迁移调用方

**为什么选择**: 职责分离清晰，符合已有架构，减少维护负担

---

## 结果 (Consequences)

### 正面影响
- 消除了前后端 system prompt 组装的重复逻辑
- 前端 preprocessor 代码大幅简化
- 强化了 MCP-first 的架构方向

### 负面影响
- `assembleSystemPrompt` 的调用方需要迁移到 `buildAppendPrompt`

### 需要注意的事项
- Widget catalog prompt 仍由前端提供（后端不知道前端注册了哪些自定义 widget）
- Dynamic domain data（如学情数据）不应注入 system prompt，应通过 MCP tool 让模型按需获取

---

## 实施指南

1. 删除 `assembleSystemPrompt()` 和 `SystemPromptParts` 类型
2. 新增 `buildAppendPrompt()` 函数，只拼接 widget catalog + static context
3. 更新 `index.ts` 导出
4. 调用方将 `buildAppendPrompt()` 返回值传入 API 的 `appendSystemPrompt` 字段
5. 修复后端 `ensureCLIProcess()` 中 `appendSystemPrompt` 未持久化到 session 的 bug

---

## 参考资料

- [chat-interface ARCHITECTURE.md](../../packages/chat-interface/ARCHITECTURE.md)
- [ADR-0004: Single Entry Point for Messages](./0004-single-entry-point-for-messages.md)

---

## 更新记录

- **2026-03-25**: 初始版本
