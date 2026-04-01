# Evaluation Criteria — SkillPanel Rebuild

> 你是一个独立的 design QA reviewer。你**没有参与代码编写过程**。
> 按照以下标准严格评分。如果某些东西对你作为新读者来说不清楚，那它就是个问题。

## Pre-Scoring Gate (MANDATORY)

在打分前，Evaluator **必须**完成以下认证步骤：

1. 确认后端 `localhost:3001` 可达
2. 执行登录：`POST http://localhost:3001/api/v1/auth/login` with `{ "username": "admin", "password": "dev123" }`
3. 获取 `apiKey` 并记录

**如果认证失败**：
- D1 (原型视觉对齐) 直接给 **0/5** — 无法验证实际渲染
- D3 (功能验证) 直接给 **0/5** — 无法验证交互
- 其他维度正常评分（基于代码分析）
- 在报告顶部注明 `⚠️ AUTHENTICATION FAILED — D1 and D3 scored 0 by gate rule`

---

## Scoring Dimensions

### D1: 原型视觉对齐 (Weight: 30/100)
**What to evaluate**: SkillPanel 的视觉效果与 `skill-management-ccaas-light.html` 原型的匹配程度。

**评估标准**：

| Score | Description |
|-------|-------------|
| 5 | header/tabs/stat cards/skill cards/badges/params section/buttons 完全匹配原型。间距、圆角、字号、颜色 token 全部对齐 |
| 4 | 整体结构和视觉一致，仅 1-2 处细微偏差（某个间距差 2px、badge 颜色略有不同） |
| 3 | 大方向对了（3 tabs、cards grid），但细节有 5+ 处偏差（stat cards 布局不同、params section 缺失） |
| 2 | 能看出参考了原型，但多处结构性差异（缺少 section headers、cards 不是 2-column） |
| 1 | 与原型差距大，基本是不同设计 |

**Hard caps**:
- 任何 tab 缺失或不工作 → D1 **最高 2/5**
- 缺少 stat cards → D1 **最高 3/5**
- 缺少 params section（Solution Skills tab 的参数配置区） → D1 **最高 3/5**

**Detection method**:
1. 打开浏览器，点击 sidebar Skills 入口，截图 SkillPanel
2. 与 `skill-management-ccaas-light.html` 在浏览器中并排对比
3. 逐项检查：
   - Header: "Skill 管理" 标题 + tenant name + badge
   - Tabs: 3 个 tab（Solution Skills / 自建 Skills / 使用统计），active tab 下划线
   - Stat cards: 4 列 grid，bg2 背景，label + value
   - Skill cards: 2-column grid，.5px border，12px 圆角
   - Badges: active(绿)/draft(灰)/solution(蓝)/custom(coral)/disabled(灰) 颜色
   - Params section: bg2 背景框，key-value 行，.5px 分割线
   - Action buttons: .5px border，primary button 深色背景
   - Section headers: "已启用 (N)" + count 标注
4. 检查 CSS 变量使用（应使用 `--success-bg`, `--info-bg` 等 token）

---

### D2: Sidebar 集成 (Weight: 25/100)
**What to evaluate**: Sidebar 中 Skills 入口的完整性、交互正确性。

| Score | Description |
|-------|-------------|
| 5 | 展开态和收缩态都有 Skills 入口，点击打开 panel，active 高亮，关闭 panel 回到 chat，sidebar 其他功能不受影响 |
| 4 | 展开态有入口且功能正常，收缩态入口或 active 高亮缺少一项 |
| 3 | 有入口且能打开 panel，但关闭/切换不顺畅，或 active 状态不正确 |
| 2 | 有入口但交互有明显问题（点击无反应、状态不同步等） |
| 1 | 入口存在但基本不可用 |

**Hard caps**:
- 无 sidebar Skills 入口（展开态和收缩态都没有） → D2 = **0/5**
- 关闭 panel 后 chat 不能恢复正常 → D2 **最高 2/5**
- Panel 开关状态与 sidebar active 高亮不同步 → D2 **最高 3/5**

**Detection method**:
1. 浏览器打开 `http://localhost:5190/`，认证后：
2. **展开态测试**:
   - 找到 sidebar 中的 Skills 入口
   - 点击 → panel 打开，sidebar 入口高亮
   - 截图 sidebar 展开态 + panel 打开
3. **收缩态测试**:
   - 点击 sidebar toggle 收缩
   - 找到收缩态的 Skills 图标
   - 点击 → panel 打开
   - 截图收缩态 + panel 打开
4. **关闭测试**:
   - 点击 panel 内的关闭按钮（或 sidebar Skills 再次点击）
   - 验证回到 chat 界面
   - chat 消息区域、composer 正常可用
5. **会话切换测试**:
   - panel 打开时，点击 sidebar 中的某个会话
   - 验证 panel 关闭、切换到该会话

---

### D3: 功能验证 (Weight: 20/100)
**What to evaluate**: SkillPanel 的核心功能是否工作。

| Score | Description |
|-------|-------------|
| 5 | API 正确加载 skills、3 个 tab 都有正确内容、toggle 启用/停用有视觉反馈、空状态处理正确 |
| 4 | 核心功能正常，仅 1 处小问题（如某个 tab 的数据展示不完整） |
| 3 | Skills 能加载显示，tab 切换正常，但 toggle 或 action buttons 不工作 |
| 2 | Skills 能加载但部分显示异常（布局错乱、数据缺失） |
| 1 | Skills 加载失败或完全无数据 |

**Detection method** (浏览器交互):
1. 打开 SkillPanel，等待数据加载
2. 检查 Solution Skills tab:
   - 是否显示 skill 列表
   - stat cards 数字是否正确
   - 已启用/未启用分组是否正确
3. 切换到"自建 Skills" tab:
   - 检查自建 skills 列表
   - "新建 Skill" 按钮是否存在
4. 切换到"使用统计" tab:
   - 检查统计内容（至少有 stat cards）
5. Toggle 测试:
   - 点击 enable/disable toggle 或按钮
   - 验证视觉状态变化（badge 颜色、按钮文案切换）
6. 空状态:
   - 如果某个分组无 skills，应显示 empty state

---

### D4: 响应式 (Weight: 10/100)
**What to evaluate**: SkillPanel 在不同视口的布局适应性。

| Score | Description |
|-------|-------------|
| 5 | Desktop 2-col cards、Tablet 2-col、Mobile 1-col cards + stat cards 2-col grid。sidebar drawer 在移动端正确触发 |
| 4 | Desktop 和 Mobile 良好，仅 1 处过渡断点的小问题 |
| 3 | Desktop 良好，Mobile 有 1-2 处布局问题（cards 溢出、stat grid 挤压） |
| 2 | Desktop 可用，Mobile 多处问题 |
| 1 | Mobile 基本不可用 |

**Detection method**:
1. Desktop 1440x900 截图
2. Tablet 768x1024 截图
3. Mobile 375x812 截图
4. 检查:
   - Skill cards: desktop 2-col → mobile 1-col
   - Stat cards: desktop 4-col → mobile 2-col
   - Sidebar: mobile 下通过 drawer 触发

---

### D5: 代码质量 (Weight: 10/100)
**What to evaluate**: 代码整洁度、CSS 变量使用、向后兼容。

| Score | Description |
|-------|-------------|
| 5 | 所有颜色走 CSS 变量、新 props 均 optional、无 `!important`、无硬编码色、controlled component pattern 正确实现 |
| 4 | 基本干净，仅 1-2 处可改进 |
| 3 | 有 3-5 处硬编码颜色或不必要的 inline style |
| 2 | 多处硬编码、controlled pattern 有 bug |
| 1 | 大量硬编码、架构实现有严重问题 |

**Detection method**:
1. `grep -rn '#[0-9a-fA-F]\{3,8\}' packages/chat-interface/src/components/SkillPanel.tsx` — 硬编码颜色
2. `grep -rn 'style={{' packages/chat-interface/src/components/SkillPanel.tsx` — inline style
3. `grep -rn '!important' packages/chat-interface/src/components/SkillPanel.tsx` — !important
4. 检查 `ChatInterface.tsx` 的 `skillPanelOpen` prop 是否 optional（`?:`）
5. 检查 `ChatCoreContext.tsx` 的 controlled pattern 实现:
   - 有外部 prop 时用外部的
   - 无外部 prop 时 fallback 到内部 state
6. 检查 `ChatSidebar.tsx` 的新 props 是否 optional
7. `cd packages/chat-interface && npx tsc --noEmit` — typecheck
8. `cd packages/chat-interface && npx vitest run` — tests

---

### D6: Edu-Platform + 无回归 (Bonus: +5)

| Score | Description |
|-------|-------------|
| +5 | edu-platform App.tsx 正确接入 skillPanelOpen，sidebar Skills 入口可用，chat 发消息无回归 |
| +3 | edu-platform 可访问但 skill panel 入口未接入 |
| +1 | edu-platform 可访问但有显示异常 |
| +0 | edu-platform 不可用或 chat 有回归 |

**Detection method**:
1. 打开 `http://localhost:5290/`
2. 登录后验证 chat 发消息正常
3. 检查 sidebar 是否有 Skills 入口
4. 如果有，验证 panel 打开/关闭正常
5. 回到 chat，发送一条消息，验证无回归

---

## Penalty Rules
- 每个硬编码颜色值（`#` 或 `rgb()` 在 `.tsx` 中）: **-0.5 分**
- 每个 `!important`: **-1 分**
- 每个 inline `style={{}}` 用于非动态值: **-0.5 分**
- 改动导致 `npm run typecheck` 失败: **本轮直接 0 分，回滚**
- 改动导致 `npm test` 失败: **本轮直接 0 分，回滚**
- 删除现有功能而非改进: **-5 分每处**

## Score Calculation
1. 每个维度: `(score / 5) × weight`
   - 例: D1 得 4/5 → (4/5) × 30 = 24 分
2. 基础分: 五维度加权分之和 - penalty 扣分（满分 95）
3. 加分: D6 bonus（最多 +5）
4. 总分: 基础分 + bonus（上限 100）
5. **报告格式**: 最后一行必须 `总分: XX/100`

## Pass/Target Thresholds
- **Minimum pass**: 60/100
- **Target**: 80/100
