# Chat 界面产品规格与实现 Checklist

> 基于即见 Jijian CCaaS 平台的教育精准教学 Solution。
> 所有视觉细节（间距、字号、圆角）请参考 `prototypes/components/` 下的 HTML 原型文件，以原型为准。
> 本文档只描述功能行为和设计意图，不指定具体像素值。

---

## 功能模块

### 1. 整体布局

左右分栏，满屏高度。左侧固定宽度侧边栏，右侧主内容区自适应。

主内容区有两个视图：Landing Page（新会话）和 Chat（对话中）。两者切换，不共存。

参考原型：`chat-full-layout.html`（浅色）、`chat-full-layout-dark.html`（暗色）

---

### 2. 浮动输入框

对标 Claude web。输入框不贴死在窗口底部，而是一个独立的浮动卡片——有圆角、边框、轻阴影，距离窗口底部有间距。

使用 textarea（非 input），支持多行输入，打字时自动增高（有最大高度限制）。Enter 发送，Shift+Enter 换行。

发送按钮在 textarea 右侧底部对齐，圆角方形。

textarea 下方有一行工具栏，左侧放功能按钮（附件等），作为扩展口。

对话内容区底部需要留足够 padding，避免被浮动输入框遮挡。

参考原型中 `.input-wrap` / `.input-box-float` 的样式。

---

### 3. 侧边栏

从上到下四个区域：

**Header：** 产品名 + 新建会话"+"按钮。

**搜索栏：** 过滤会话历史。

**可滚动区域：**
- 会话历史按时间分组（今天/昨天/本周）。每条会话：状态圆点 + 标题（单行截断）+ 时间。蓝点 = 进行中，灰点 = 已完成。当前会话高亮。
- 已启用 Skills 列表。每个 Skill：图标 + 名称。图标颜色区分来源：绿色 = Solution 内置，橙色 = Tenant 自建。末尾"+ 管理 Skills"入口。

**底部用户信息：** 固定不滚动。头像 + 姓名 + 角色。整行可点击，弹出用户菜单。

---

### 4. 用户菜单

对标 Claude web 左下角菜单。

从用户信息行向上弹出，有圆角边框和阴影。点击外部关闭。

内容：邮箱（只读）→ 分隔线 → 设置 / 导出记录 / 帮助 → 分隔线 → 退出登录。

每项有图标 + 文字，hover 时浅色背景。

参考原型中 `.user-menu` 的结构和样式。

---

### 5. Landing Page

点击"+"或首次打开时显示。不预设任何上下文（不 hardcode 班级/学科）。

垂直居中布局，从上到下：

**问候区：** 根据时间动态变化的问候语（早上好/下午好/晚上好 + 教师姓名），副标题"我是你的教学助手"，时间上下文（"第14周 · 还有2周期末考试"，由规则引擎生成）。

**Skill 快捷卡片：** 2x2 网格，对应已启用的 Skills。每张卡片：图标 + 名称 + 一句话描述。点击发送预设 prompt，Landing 消失进入对话。

**Prompt 示例：** "试试这样说"，2-3 条不含班级信息的具体 prompt。点击直接发送。

---

### 6. 消息气泡

参考原型：`message-bubbles.html`

**用户消息：** 靠右，深色背景白色文字，右下角小圆角。

**AI 回复：** 靠左，无背景，允许 Widget 撑满宽度。上方可选显示 Skill 激活标签（绿色 = Solution 内置，橙色 = 自建）。

**思考中：** 三点闪烁动画 + 文字提示。

**错误：** 红色浅背景文字块，嵌入 AI 回复中。

---

### 7. 工具调用展示

对标 Claude web 的工具调用折叠。

参考原型：`tool-usage-group.html`

**三层折叠：**

第一层 — 自然语言摘要，默认折叠。一句人话概括工具链（如"查询课标进度和班级学情"）。整行可点击展开。不暴露技术细节。

第二层 — 步骤列表。每步：状态图标（紫色=MCP调用，蓝色=AI推理，绿色=完成）+ 自然语言描述 + 工具名（灰色等宽小字）+ 耗时。

第三层 — Table / JSON 详情。点击步骤文字行直接 toggle（没有额外的"查看详情"链接）。Tab 切换：Table 视图（Postman 风格 Key-Value 表格，分 Request/Response 两个 section）和 JSON 视图（原始代码块）。

---

### 8. StepWizard（备课向导）

参考原型：`step-wizard.html`

嵌入在 AI 回复中的多步参数收集向导。

Step 1 选择范围（学科/年级/班级/课型/课时）→ Step 2 选择章节（可展开的章节树，MCP 数据）→ Step 3 学情分析（BarList + 标记重点，MCP 数据）→ Step 4 确认汇总。

Step 1 完成后确立会话上下文。点"生成教案"后下方追加新 AI 回复（文件卡片 + next_actions）。

---

### 9. ReviewPanel（试题审核）

参考原型：`review-panel.html`

逐题审核，每题独立卡片。题目 + 元数据标签（知识点/难度/来源）+ 操作按钮（保留/替换/微调/删除）。

按钮 toggle 行为，选中后卡片视觉反馈。底部进度计数 + 批量操作按钮。

来源标签颜色：蓝色 = 题库，橙色 = AI 原创。

---

### 10. MetricDashboard + BarList（学情仪表盘）

参考原型：`metric-dashboard.html`

指标卡网格（数值 + delta 趋势）+ 条形数据列表（知识点错误率）。进度条颜色按阈值变化。

---

### 11. 文件卡片 + Next Actions

参考原型：`file-card-actions.html`

文件卡片：图标颜色按类型区分（.docx 蓝 / .pdf 珊瑚 / .pptx 青 / .xlsx 紫）。hover 有视觉反馈。

Next Actions：Skill 动态声明的后续操作按钮行，点击发送 prompt。

---

### 12. Skill 管理面板

参考原型：`skill-management-ccaas-light.html`

ccaas-core Tenant 视角。两个 Tab：

**Solution Skills：** 内置 Skills，Tenant 只能启用/停用和调参数。卡片内直接展示可配参数。

**自建 Skills：** Tenant 完全自治，支持 CRUD。

顶部统计栏，第三个 Tab"使用统计"预留。

---

### 13. Skill 标签颜色规范

全产品统一：绿色 = Solution 内置，橙色 = Tenant 自建。

出现位置：侧边栏 Skill 列表图标、AI 回复 Skill 标签、管理面板卡片 badge。

---

### 14. 上下文生命周期

- 新会话无上下文
- 上下文由 Skill 的 StepWizard 第一步收集（选班级/学科）
- 绑定在会话上，不跨会话
- 不支持中途切换（换班级 = 新建会话）
- 侧边栏和顶栏都不显示上下文

---

## 实现 Checklist

按顺序完成，每完成一项打勾。

### Phase 1: 骨架布局
- [ ] 1.1 实现左右分栏布局（侧边栏 + 主内容区），参考 `chat-full-layout.html`
- [ ] 1.2 实现侧边栏 Header（logo + 新建按钮）
- [ ] 1.3 实现侧边栏搜索栏
- [ ] 1.4 实现侧边栏会话历史列表（分组、状态圆点、高亮、点击切换）
- [ ] 1.5 实现侧边栏已启用 Skills 列表（图标颜色区分来源）
- [ ] 1.6 实现侧边栏底部用户信息行
- [ ] 1.7 实现用户菜单弹出（设置/导出/帮助/退出登录，点击外部关闭）
- [ ] 1.8 实现主内容区顶栏（会话标题，随切换更新）

### Phase 2: Landing Page
- [ ] 2.1 实现 Landing 视图（居中布局）
- [ ] 2.2 实现动态问候语（根据时间变化）
- [ ] 2.3 实现 Skill 快捷卡片（2x2 网格，点击发送 prompt）
- [ ] 2.4 实现 Prompt 示例（点击发送）
- [ ] 2.5 实现 Landing ↔ Chat 视图切换

### Phase 3: 浮动输入框
- [ ] 3.1 实现浮动卡片样式（圆角、阴影、底部间距）
- [ ] 3.2 实现 textarea 自动增高（Enter 发送，Shift+Enter 换行）
- [ ] 3.3 实现底部工具栏（附件按钮扩展口）
- [ ] 3.4 Landing 和 Chat 共享同一个输入框样式

### Phase 4: 消息气泡
- [ ] 4.1 实现用户消息气泡（靠右，深色背景）
- [ ] 4.2 实现 AI 回复气泡（靠左，无背景）
- [ ] 4.3 实现 Skill 激活标签（绿色/橙色，按来源）
- [ ] 4.4 实现思考中状态（三点动画）
- [ ] 4.5 实现错误状态（红色背景文字块）
- [ ] 参考原型：`message-bubbles.html`

### Phase 5: 工具调用展示
- [ ] 5.1 实现第一层：自然语言摘要折叠卡片
- [ ] 5.2 实现第二层：步骤列表（状态图标 + 描述 + 工具名 + 耗时）
- [ ] 5.3 实现第三层：Table / JSON 切换详情
- [ ] 5.4 实现交互：点摘要展开步骤，点步骤文字展开详情
- [ ] 5.5 确保三层折叠的事件冒泡正确（内层点击不触发外层）
- [ ] 参考原型：`tool-usage-group.html`

### Phase 6: Widget 组件
- [ ] 6.1 实现 Widget 统一外框（边框 + 标题栏 + 类型 badge）
- [ ] 6.2 实现 StepWizard（四步向导，步骤条 + 表单 + 章节树 + 学情条形图 + 确认汇总）
- [ ] 6.3 实现 ReviewPanel（逐题审核，toggle 操作，进度计数）
- [ ] 6.4 实现 MetricDashboard（指标卡 + delta 趋势）
- [ ] 6.5 实现 BarList（条形数据 + 可选标记按钮）
- [ ] 6.6 实现文件卡片（按类型着色图标）
- [ ] 6.7 实现 Next Actions 按钮行
- [ ] 参考原型：`step-wizard.html`、`review-panel.html`、`metric-dashboard.html`、`file-card-actions.html`

### Phase 7: Skill 管理面板
- [ ] 7.1 实现 Solution Skills Tab（启用/停用 + 参数配置）
- [ ] 7.2 实现自建 Skills Tab（CRUD）
- [ ] 7.3 实现统计栏
- [ ] 7.4 预留使用统计 Tab
- [ ] 参考原型：`skill-management-ccaas-light.html`

### Phase 8: 暗色模式
- [ ] 8.1 实现完整的暗色模式色板切换
- [ ] 8.2 确保所有组件在暗色模式下可读
- [ ] 8.3 浮动输入框阴影在暗色模式下加深
- [ ] 参考原型：`chat-full-layout-dark.html`

### Phase 9: 集成与联调
- [ ] 9.1 对接 Jijian 的 solution.json 配置（读 GitBook 文档）
- [ ] 9.2 对接 Jijian 的 write_output 协议
- [ ] 9.3 对接 Jijian 的 Skill 编写规范
- [ ] 9.4 对接 MCP Server（课标树 / 题库 / 学情）
- [ ] 9.5 Jijian 文档地址：https://kedgetech.gitbook.io/ji-jian-agentic
