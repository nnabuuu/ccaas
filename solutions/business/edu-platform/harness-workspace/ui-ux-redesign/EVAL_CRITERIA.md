# Evaluation Criteria — UI/UX Redesign

> 你是一位独立的前端质量审查员。你没有参与代码编写，只评估最终实现。
> 按照以下标准严格评分。所有视觉标准以 `prototypes/components/` 下的 HTML 原型为准。

## Pre-Scoring Gate

**两个 tsc --noEmit 必须通过。** 任一失败则直接 0 分，跳过所有维度评估。

```bash
cd solutions/business/edu-platform/frontend && npx tsc --noEmit
cd packages/chat-interface && npx tsc --noEmit
```

## Scoring Dimensions

### D1: 整体布局 + 侧边栏 (Weight: 20/100)

**What to evaluate**: 左右分栏、侧边栏内容区域、用户菜单是否匹配 `chat-full-layout.html`。

| Score | Description |
|-------|-------------|
| 5/5 | 满屏分栏布局正确；侧边栏四区域齐全（Header+搜索+可滚动+底部用户）；会话列表时间分组+状态圆点+高亮；Skills 列表有来源颜色区分（绿/橙）；用户菜单向上弹出+内容完整+点击外部关闭 |
| 4/5 | 布局正确，侧边栏区域基本齐全，缺少用户菜单或 Skills 来源颜色 |
| 3/5 | 分栏布局可用，侧边栏有会话列表但缺少分组或状态指示 |
| 2/5 | 布局渲染但侧边栏区域不完整或严重错位 |
| 1/5 | 布局崩坏或侧边栏不可见 |

**Detection method**:
1. 读 `ChatSidebar.tsx` 检查四个区域是否存在
2. Grep `time-group\|today\|yesterday\|今天\|昨天` 检查时间分组
3. Grep `user-menu\|userMenu\|popover` 检查用户菜单
4. Grep `solution.*green\|tenant.*orange\|ck-success\|ck-warn` 检查来源颜色
5. 浏览器截图对比 `chat-full-layout.html`

---

### D2: Landing Page + 浮动输入框 (Weight: 20/100)

**What to evaluate**: Landing 视图、动态问候、Skill 卡片、浮动 Composer 是否匹配原型。

| Score | Description |
|-------|-------------|
| 5/5 | Landing 居中布局完整：动态问候语+时间上下文+2x2 Skill 卡片（点击发送）+Prompt 示例（点击发送）；浮动输入框有圆角/边框/底部间距；textarea 自动增高+Enter 发送/Shift+Enter 换行；发送按钮右下对齐；底部工具栏 |
| 4/5 | Landing 和 Composer 主要元素完整，缺少动态问候或工具栏 |
| 3/5 | Landing 有基本内容但排版不居中，或 Composer 不浮动 |
| 2/5 | Landing 和 Composer 存在但样式严重偏离原型 |
| 1/5 | Landing 或 Composer 不渲染 |

**Hard cap**: textarea padding 覆盖导致按钮栏文字重叠 → max 2/5

**Detection method**:
1. 读 `ChatInterfaceEmptyState.tsx` 检查问候语逻辑
2. Grep `greeting\|问候\|早上好\|下午好\|晚上好` 检查时间动态
3. 读 `ChatInterfaceComposer.tsx` 检查浮动样式和 textarea 行为
4. 检查 `index.css` 中 Composer 相关 override
5. 浏览器截图验证 Landing 和 Composer
6. **Composer 内部布局验证**（Playwright JS）:
   - textarea padding-bottom ≥ 按钮栏 offsetHeight（否则文字被遮挡）
   - composer-card 没有多余 padding override（不应覆盖组件内置 padding）
   - shadow 变量三态（default/hover/focus）均不为 none
   - 输入文字后截图，文字不被按钮遮挡
7. 与 `reference/input-floating.png` 视觉对比（圆角、阴影、间距）

---

### D3: 消息渲染 + 工具活动 (Weight: 25/100)

**What to evaluate**: 消息气泡样式、Skill 标签、工具调用三层折叠是否匹配 `message-bubbles.html` + `tool-usage-group.html`。

| Score | Description |
|-------|-------------|
| 5/5 | 用户消息右对齐+深色背景；AI 回复左对齐+无背景+Skill 标签（绿/橙）；思考中三点动画；工具调用三层折叠完整（摘要→步骤列表→Table/JSON 切换）；步骤有状态图标（紫/蓝/绿）+工具名+耗时；内层点击不触发外层 |
| 4/5 | 气泡和工具活动主要正确，缺少 Table/JSON 切换或步骤状态图标颜色 |
| 3/5 | 气泡样式基本正确，工具活动只有一层（无折叠）或两层 |
| 2/5 | 消息能渲染但样式严重偏离（如用户消息不靠右，无背景区分） |
| 1/5 | 消息或工具活动组件报错或不渲染 |

**Hard cap**: 工具活动无三层折叠 → max 3/5

**Detection method**:
1. 读 `MessageRenderer.tsx` 检查 content block 分发逻辑
2. 读 `ToolGroup.tsx` + `ToolActivityBlock.tsx` 检查折叠层级
3. Grep `Table\|JSON\|tab.*切换\|detail.*view` 检查第三层
4. Grep `purple\|MCP\|推理\|reasoning` 检查步骤状态图标颜色
5. 检查 `message-bubbles.html` 中的用户气泡 CSS（深色背景+右对齐）
6. 浏览器截图对比

---

### D4: Widget 组件视觉精修 (Weight: 25/100)

**What to evaluate**: StepWizard、ReviewPanel、MetricDashboard、文件卡片是否像素级匹配原型。

| Score | Description |
|-------|-------------|
| 5/5 | 四个 Widget 全部匹配原型：StepWizard 步骤指示器+表单+章节树+条形图+摘要；ReviewPanel 全展示式+来源标签(bank=info/ai=warn)+四操作+状态反馈+进度计数+批量操作；MetricDashboard 指标卡+delta+bar 颜色阈值；文件卡片类型着色 |
| 4/5 | 3/4 Widget 匹配良好，1 个有明显差距 |
| 3/5 | 2/4 Widget 匹配良好，其余有明显问题 |
| 2/5 | Widget 能渲染但大部分样式严重偏离原型 |
| 1/5 | Widget 无法渲染或空白 |

**Detection method**:
1. 逐个读 Widget 组件文件，与对应 HTML 原型逐一对比
2. 检查 StepWizard 步骤指示器样式（2.5px border, active/done/pending 三态）
3. 检查 ReviewPanel `kept/replaced/removed` 状态样式
4. 检查 MetricDashboard `ck-danger-t/ck-warn-t/ck-success-t` 阈值使用
5. 检查文件卡片 `.docx/.pdf/.pptx/.xlsx` 颜色映射
6. 浏览器截图对比

---

### D5: 设计系统一致性 + 暗色模式 (Weight: 10/100)

**What to evaluate**: CSS 变量使用、暗色模式完整性、无 hardcoded 值。

| Score | Description |
|-------|-------------|
| 5/5 | 所有颜色通过 CSS 变量；暗色模式完整可用（所有组件可读）；边框统一 0.5px；圆角统一 ck/ck-lg；零 hardcoded hex 值 |
| 4/5 | CSS 变量为主，有 1-2 处 hardcoded 值；暗色模式基本可用但个别组件对比度不足 |
| 3/5 | CSS 变量体系存在但暗色模式未覆盖 Widget 组件 |
| 2/5 | 大量 hardcoded 颜色值，暗色模式严重缺失 |
| 1/5 | 无 CSS 变量体系，无暗色模式 |

**Detection method**:
1. `grep -rn '#[0-9a-fA-F]\{3,6\}' solutions/business/edu-platform/frontend/src/widgets/`
2. `grep -rn '#[0-9a-fA-F]\{3,6\}' packages/chat-interface/src/components/`（排除 tailwind.config）
3. 检查 `tailwind.config.js` CSS 变量定义
4. 检查 `index.css` dark mode media query 覆盖范围
5. 浏览器暗色模式截图

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 frozen 文件 (context providers 结构) | -5 per file | `git diff --name-only -- packages/chat-interface/src/context/` |
| 修改 frozen 文件 (widget 基础设施) | -5 per file | `git diff --name-only -- packages/chat-interface/src/widgets/registry.tsx packages/chat-interface/src/widgets/catalog.ts packages/chat-interface/src/widgets/mcp-bridge.ts` |
| 修改 frozen 包 (react-sdk/backend/vue-sdk) | -10 per file | `git diff --name-only -- packages/react-sdk/ packages/backend/ packages/vue-sdk/` |
| hardcoded 颜色值 (hex/rgb 在 widget/组件中) | -0.5 per instance | grep hex/rgb in widget + component files |
| console.log 残留 | -1 per instance | grep in modified files |
| 未使用 import | -0.5 per instance | tsc warnings |

## Score Calculation

1. 每个维度: `(score / 5) * weight`
2. 基础分: 五个维度加权分之和
3. **总分 = 基础分 - Penalty 扣分**（满分 100，最低 0）
4. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 65/100
- **Target**: 85/100
- **Estimated baseline**: ~35/100（现有实现已有基本功能，但视觉细节偏离原型）
