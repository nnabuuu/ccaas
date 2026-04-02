# Edu Platform — Solution 设计手册

## 1. 问题定义

中小学教师在备课、出题、学情分析三个高频场景中面临以下痛点：

- **备课耗时**：手动查进度、翻教材、写教案，一节课备课 2-3 小时
- **出题低效**：难以精准匹配知识点和难度，缺乏学情数据支撑
- **学情分散**：数据散落在多个系统中，缺乏整合分析和可视化
- **工具割裂**：备课、出题、学情分析使用不同工具，无法联动

Edu Platform 的目标是将这三个场景整合到一个对话界面中，通过 AI Agent 自动获取上下文、呈现结构化数据、驱动跨 Skill 协同工作流。

## 2. 设计决策

### 2.1 为什么用 show_info_card 而不是自定义 widget？

**决策**：所有结构化数据展示统一使用 CCAAS 平台的 `show_info_card` MCP 工具。

**原因**：
- CCAAS 平台统一渲染 show_info_card，前端只需实现一套 InfoCard 组件
- 避免每个 Solution 造轮子（FormCollect、TreeSelector、MetricDashboard 都不是平台工具）
- 5 种 section type（outline/bar_list/metrics/actions/text）覆盖教育场景 90% 的展示需求
- 新增 section type 只需扩展 enum + 前端组件，不影响 Skill prompt

**反模式**（已修复）：
- ~~`FormCollect`~~ → 用 `show_info_card` 的 `actions` section 替代表单收集
- ~~`TreeSelector`~~ → 用 `curriculum_tree` + `show_info_card` 的 `outline` section 替代
- ~~`MetricDashboard`~~ → 用 `show_info_card` 的 `metrics` section 替代
- ~~`BarList`~~ → 用 `show_info_card` 的 `bar_list` section 替代

### 2.2 为什么 context-aware 而不是表单驱动？

**决策**：Skill 从 sessionContext 自动获取班级、年级、学科信息，不要求教师填表。

**原因**：
- 教师进入会话时已选择班级（sessionContext 包含 classId、grade、subject）
- 减少交互步骤：教师说"备课"就能直接看到备课向导，无需先填 3 个表单字段
- 数据驱动：自动调用 MCP 工具获取教学进度和学情，比教师手动填写更准确

### 2.3 多 Skill 协同设计

**决策**：3 个 Skill 通过 `suggest_actions` 的 `skill_hint` 字段实现跨 Skill 引导。

**协同关系**：
```
lesson-plan-generator ←→ quiz-generator
         ↑                      ↑
         └──── student-analysis ─┘
```

- **学情分析 → 备课助手**：发现薄弱知识点后，推荐生成补救教案
- **学情分析 → 出题专家**：发现薄弱知识点后，推荐出针对性练习题
- **备课助手 → 出题专家**：教案生成后，推荐生成配套练习题
- **出题专家 → 备课助手**：出题后，推荐为相同知识点生成教案

**实现方式**：`suggest_actions` 的 action 中包含 `skill_hint` 字段：
```json
{ "label": "出针对性练习", "prompt": "为薄弱知识点出练习题", "skill_hint": "quiz-generator" }
```

### 2.4 show_info_card section 组合模式

不同场景使用不同的 section 组合：

| 场景 | sections 组合 | 示例 |
|------|--------------|------|
| 备课向导 | outline + bar_list + actions | 章节大纲 + 学情提示 + 生成按钮 |
| 出题向导 | outline + bar_list + actions | 知识点树 + 掌握率 + 题型选项 |
| 学情概览 | metrics + bar_list + actions | 指标面板 + 掌握率图 + 分析按钮 |
| 参数选择 | text + actions | 说明文字 + 选项按钮 |
| 补救方案 | text + actions | 建议文字 + 操作按钮 |

## 3. 交互模式

### Pattern 1: 结构化数据展示
```
调用 MCP 工具获取数据 → show_info_card(sections: [outline/metrics, bar_list, actions]) → suggest_actions
```

### Pattern 2: 参数收集（替代 FormCollect）
```
show_info_card(sections: [text(说明), actions(选项按钮)]) → 用户点击 → 继续流程
```

### Pattern 3: 数据可视化（替代 MetricDashboard/BarList）
```
show_info_card(sections: [metrics(指标), bar_list(掌握率)]) → suggest_actions(后续操作)
```

### Pattern 4: 跨 Skill 协同
```
当前 Skill 分析完毕 → suggest_actions(skill_hint: "other-skill") → 用户点击 → 切换到目标 Skill
```

### Pattern 5: Wizard 多步向导（AskUserQuestion + control_request）
```
LLM 调用 AskUserQuestion → CLI 暂停 → 前端渲染 WizardRenderer（多步向导）
  → 用户完成向导 → POST /control-response → CLI 恢复 → LLM 收到结构化 JSON
```

备课向导使用此模式：4 步流程（选范围 → 选章节 → 学情分析 → 确认生成），配置注册在 `frontend/src/wizards/lesson-plan.wizard.ts`。

## 4. 关键文件索引

### 定义层
| 文件 | 用途 |
|------|------|
| `solution.json` | Solution 配置（skills、mcpServers、sessionTemplates） |
| `CLAUDE.md` | 开发者指南 |

### Skill 层
| 文件 | 用途 |
|------|------|
| `skills/lesson-plan-generator/SKILL.md` | 备课助手 prompt |
| `skills/quiz-generator/SKILL.md` | 出题专家 prompt |
| `skills/student-analysis/SKILL.md` | 学情分析 prompt |

### 工具层
| 文件 | 用途 |
|------|------|
| `mcp-server/src/index.ts` | MCP Server 入口（7 个工具定义 + handler） |
| `mcp-server/src/db.ts` | SQLite 数据库连接 |
| `mcp-server/src/types.ts` | 共享类型定义 |

### 前端层
| 文件 | 用途 |
|------|------|
| `frontend/` | React 前端（教师对话界面） |
| `reference/chat-interface.html` | UI 原型参考 |

## 5. 构建类似 Solution 的 Checklist

1. **定义 Skill**：在 `skills/<slug>/SKILL.md` 中编写 prompt，使用 show_info_card + suggest_actions 交互
2. **实现 MCP 工具**：在 `mcp-server/src/index.ts` 中添加 Tool 定义和 handler
3. **配置 solution.json**：注册 skills、mcpServers、sessionTemplates
4. **验证交互**：确保 SKILL.md 中引用的工具名和参数与 index.ts 定义一致
5. **测试编译**：`cd mcp-server && npx tsc --noEmit` 确保零错误

### 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 使用虚构 widget（FormCollect 等） | 使用 show_info_card 的 section types |
| 要求教师填表收集参数 | 从 sessionContext 自动获取 |
| 工具名拼写与 index.ts 不一致 | 严格使用 index.ts 中定义的 tool name |
| show_info_card section type 拼写错误 | 只使用 enum 中的 5 种类型 |
