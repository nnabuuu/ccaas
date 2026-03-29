# Harness Specification

## Task
- **Artifact**: `packages/chat-interface/` 的所有组件视觉层 — CSS/样式 + 组件内部渲染逻辑
- **Current state**: 功能完整，Claude Web 设计语言已部分对齐（CSS 变量体系、配色方案已建立），但视觉打磨不足。参考截图在 `packages/chat-interface/reference/`，设计系统文档在 `packages/chat-interface/docs/design-system.md`
- **Target audience**: 最终用户（使用 chat UI 交互的人）+ 集成开发者（使用 compound components 的人）
- **Goal**: 将 chat-interface 的视觉质量提升至与 Claude Web 参考几乎无法区分的水准，跨组件风格统一、移动端完全可用、交互有质感

## Frozen Constraints
- 组件对外 API 接口（props）可以灵活调整，但改动需在 eval report 中标记
- ChatInterfaceContext / ChatCoreContext 的 provider 架构不应大改
- Widget 系统（catalog、registry、11 个 widget 的核心 props 接口）尽量保持稳定
- 每轮改动后 `npm run typecheck` 和 `npm test`（在 packages/chat-interface 下）必须通过
- 不引入不必要的新依赖（现有 Tailwind + lucide-react + sonner + react-markdown 足够）

## Eval Rubric

### Scoring Dimensions
| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| 1 | Claude Web Visual Alignment | 30/100 | 对比 reference/ 截图 + design-system.md 的 CSS 变量定义，逐项检查 spacing、颜色、字体、圆角、阴影 |
| 2 | Cross-Component Consistency | 25/100 | grep 硬编码颜色值（`#xxx`、`rgb()`）、检查 CSS 变量覆盖率、对比各组件 spacing/radius 用法 |
| 3 | Responsive & Mobile | 20/100 | 检查 Tailwind 断点类（`sm:`, `md:`, `lg:`）使用密度、overflow 处理、min/max-width 约束 |
| 4 | Interaction Polish | 15/100 | 检查 `hover:`, `focus:`, `active:` 类覆盖率、`transition` 属性、loading/skeleton 组件 |
| 5 | Code Quality & Maintainability | 10/100 | grep `!important`、检查 inline style 频率、tailwind-merge 使用、重复样式定义 |

### Dimension Details

#### 1. Claude Web Visual Alignment (30/100)
- **5/5**: 截图对比与 Claude Web 参考几乎无法区分。spacing、颜色、字体、圆角、阴影完全对齐设计系统文档
- **4/5**: 整体观感一致，仅有 1-2 处细微偏差（如某个阴影值或边距差 2px）
- **3/5**: 大方向对了（配色方案、布局结构），但细节有 5+ 处明显偏差（间距差 4px+、颜色值不匹配）
- **2/5**: 能看出参考了 Claude Web，但多处明显不协调
- **1/5**: 看起来像"参考了 Claude 但明显是另一个产品"，整体观感差距大

#### 2. Cross-Component Consistency (25/100)
- **5/5**: 所有组件使用相同的 CSS 变量体系、相同的 spacing scale、相同的 border-radius/shadow token。零硬编码颜色值
- **4/5**: 95%+ 样式走 CSS 变量，个别边缘组件有 1-2 处硬编码
- **3/5**: 80%+ 的样式走 CSS 变量，但仍有若干硬编码值或组件间 spacing 不一致
- **2/5**: 核心组件基本统一，但 widget/辅助组件大量硬编码
- **1/5**: 各组件各自为政，大量硬编码颜色、不同的 spacing 值、不一致的 border-radius

#### 3. Responsive & Mobile (20/100)
- **5/5**: 320px-1440px 全范围可用。Sidebar 在移动端正确折叠/展开，Composer 不被键盘遮挡，消息区域不溢出，触摸目标 ≥ 44px
- **4/5**: 桌面和平板优秀，手机端仅有 1 处小问题
- **3/5**: 桌面端良好，平板勉强可用，手机端有 1-2 处布局问题（溢出、重叠）
- **2/5**: 桌面端可用，但平板/手机端多处布局问题
- **1/5**: 手机端基本不可用，元素溢出、重叠、无法操作

#### 4. Interaction Polish (15/100)
- **5/5**: 所有可交互元素有 hover/active/focus 状态，过渡动画流畅（150-300ms），loading 状态完整，键盘导航可用，focus ring 可见
- **4/5**: 主要交互元素状态完整，仅 1-2 处缺少过渡
- **3/5**: 主要按钮有 hover 状态，但部分元素缺少过渡或状态不全
- **2/5**: 只有少数元素有交互反馈
- **1/5**: 大部分交互无视觉反馈，点击没有响应感

#### 5. Code Quality & Maintainability (10/100)
- **5/5**: 样式全部走 design token，零 `!important`，className 逻辑清晰（tailwind-merge），零重复样式定义，零 inline style
- **4/5**: 基本干净，仅 1-2 处可改进
- **3/5**: 偶有 `!important` 或重复定义（< 5 处）
- **2/5**: 多处 `!important` 或 inline style（5-10 处）
- **1/5**: 大量 inline style、`!important` hack、重复的颜色/spacing 值

### Penalty Rules
- 每个硬编码颜色值（`#` 或 `rgb()` 在 `.tsx` 中，`globals.css` 变量定义除外）: -0.5 分
- 每个 `!important`: -1 分
- 每个 inline `style={{}}` 用于非动态值: -0.5 分
- 改动导致 typecheck 失败: 本轮直接 0 分，回滚
- 改动导致 test 失败: 本轮直接 0 分，回滚
- 删除现有功能而非改进: -5 分每处

### Threshold
- **Pass score**: 70/100
- **Target score**: 85/100

## Agent Architecture

### Infrastructure Prerequisites
- **Dev server**: orchestrator 在循环开始前启动 `cd packages/chat-interface && npm run dev`，整个循环期间保持运行
- **Playwright**: 用于浏览器截图和交互验证。orchestrator 确保 `npx playwright install chromium` 已执行
- **Screenshot 目录**: `harness-workspace/chat-interface-ui-polish/screenshots/v{N}/` 存放每轮截图

### Generator
- **Role**: 阅读 eval 反馈和参考文档，对 chat-interface 组件进行视觉和交互改进，并通过浏览器验证效果
- **Perspective**: "你是一个 senior frontend engineer，擅长像素级 UI 实现。你有 Claude Web 的设计参考和详细的设计系统文档。你的目标是让每一轮改动都向参考靠近，同时保持代码干净。改完代码后你可以启动浏览器查看实际效果并继续调整。"
- **Input**: SPEC.md, progress.md, 上一轮的 eval report, `packages/chat-interface/` 源码, `packages/chat-interface/reference/` 参考截图, `packages/chat-interface/docs/design-system.md`
- **Output**: 直接修改 `packages/chat-interface/src/` 下的文件（原地修改，不创建副本）+ 在 `screenshots/v{N}/` 下保存改动后的截图
- **Isolation**: 独立 context window
- **Tools**:
  | Tool | 用途 | 权限范围 |
  |------|------|---------|
  | Read | 读取参考文档、设计系统、eval report、源码 | 全项目只读 |
  | Edit / Write | 修改组件代码和样式 | 仅 `packages/chat-interface/src/` 和 `packages/chat-interface/styles/` |
  | Glob / Grep | 搜索文件和代码模式 | 全项目 |
  | Bash | 运行 typecheck、test、启动/重载 dev server | 允许: `npm run typecheck`, `npm test`, `npm run dev`, `npx playwright` |
  | Browser (Playwright) | 打开 dev server URL，点击交互，切换视口尺寸，截图对比 | 仅 localhost dev server URL |

### Tool Agent
- **Role**: 验证 Generator 的改动不破坏编译和测试
- **Perspective**: "你是 CI pipeline。运行 typecheck 和 test，报告结果。"
- **Input**: Generator 改动后的代码
- **Output**: pass/fail 结果 + 错误日志（如有）
- **Commands**: `cd packages/chat-interface && npm run typecheck && npm test`
- **Tools**:
  | Tool | 用途 | 权限范围 |
  |------|------|---------|
  | Bash | 运行 typecheck 和 test | 仅允许: `npm run typecheck`, `npm test` |
  | Read | 读取错误日志 | 仅 `packages/chat-interface/` |

### Evaluator
- **Role**: 独立审阅代码变更 + 截图对比参考，按 EVAL_CRITERIA.md 打分
- **Perspective**: "你是一个挑剔的 design QA reviewer，你没有参与代码编写过程。你同时看代码和实际渲染截图，与 Claude Web 参考对比，按照评分标准严格打分。如果截图中的视觉效果和参考有差距，那就是分数要扣的地方。"
- **Input**: EVAL_CRITERIA.md, `packages/chat-interface/src/` 当前代码, `packages/chat-interface/reference/` 参考截图, `packages/chat-interface/docs/design-system.md`, dev server 实际页面
- **Output**: `eval-reports/v{N}-eval.md` — 包含逐维度打分、扣分明细、actionable 改进建议 + 在 `screenshots/v{N}/eval/` 下保存标注截图
- **Isolation**: 独立 context window（mandatory）
- **Tools**:
  | Tool | 用途 | 权限范围 |
  |------|------|---------|
  | Read | 读取源码、参考文档、eval criteria | 全项目只读 |
  | Glob / Grep | 搜索代码模式（硬编码颜色、!important 等） | 全项目 |
  | Bash | 运行分析命令（grep/wc/find 统计代码质量指标） | 仅允许: 只读分析命令，禁止任何修改文件的命令 |
  | Browser (Playwright) | 打开 dev server URL，截图，切换视口尺寸对比响应式效果 | 仅 localhost dev server URL，只截图不修改 |
  | **禁止** | Edit / Write | Evaluator 不能修改任何源码文件 |

### Browser Automation Protocol
每轮迭代中浏览器的标准操作流程：
1. **Generator 完成代码修改后**:
   - 打开 `http://localhost:{PORT}/`（dev server 自动热更新）
   - 截图 desktop viewport (1440×900): `screenshots/v{N}/desktop-main.png`
   - 截图 mobile viewport (375×812): `screenshots/v{N}/mobile-main.png`
   - 执行交互测试：点击 sidebar toggle、输入消息、hover 按钮等
   - 截图交互状态: `screenshots/v{N}/desktop-hover.png`, `screenshots/v{N}/mobile-sidebar.png` 等
2. **Evaluator 评估时**:
   - 独立打开 dev server，截图同样的视口和状态
   - 与 `reference/` 中的 Claude Web 截图逐一对比
   - 在 eval report 中引用具体截图路径说明扣分原因

## Exit Conditions
以下任一条件触发即停：
1. **Score threshold**: 总分 ≥ 85/100
2. **Max iterations**: 已运行 ≤ 15 轮
3. **Diminishing returns**: 连续 2 轮总分提升 < 3 分

## Progress Tracking
- **Log file**: progress.md
- **Per-iteration record**: version number, timestamp, total score, per-dimension scores, key changes summary, evaluator's top unresolved issue

## Estimated Resource Usage
- **Iterations**: ~8-12 expected（基于 UI 打磨类任务的经验）
- **Tokens per iteration**: ~80K (generator: 读代码+参考+浏览器交互+写改动) + ~10K (tool agent) + ~60K (evaluator: 读代码+参考+浏览器截图对比+写 eval report)
- **Total estimated tokens**: ~1.2M - 1.8M
- **Total estimated cost**: ~$5-12（取决于模型和实际 token 用量，浏览器截图为图片 token 额外开销）
- **Time per iteration**: ~5-10 min（含浏览器启动和截图时间）
- **Total estimated time**: ~1-2 hours
