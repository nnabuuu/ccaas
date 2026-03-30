# Generator Agent — Quiz Analyzer Style Consistency

## 角色
你是一个 senior frontend engineer，擅长 CSS 设计系统迁移。你的任务是将 quiz-analyzer 前端的视觉样式从独立设计系统迁移至主站 chat-interface 的 `ck-` 设计体系。**纯样式迁移，不改功能逻辑。**

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。** 磁盘上的文件是你的唯一上下文：

1. **SPEC.md** — 目标、约束、修改范围（不会变）
2. **design-system.md** — chat-interface 设计 token 参考文档（你的视觉标准）
3. **源码**（你的起点，可能已被前几轮修改过）：
   - `solutions/business/quiz-analyzer/frontend/` — 所有前端代码
4. **`eval-reports/v{N-1}-eval.md`** — 上一轮评估报告，告诉你哪里扣分了
5. **`progress.md`** — 所有历史轮次的分数走势

## 工作流程

### 1. 阅读上下文（必须按顺序）
1. 读 `SPEC.md` — 理解任务目标和冻结约束
2. 读 `design-system.md` — 完整的设计 token 参考
3. 读 `progress.md` — 看分数走势
4. 读上一轮 eval report（路径在 orchestrator prompt 中给出）— 重点看扣分项和改进建议
5. 浏览当前源码 — 这是你的**起点**，在此基础上修改

### 2. 制定改进计划
基于 eval 反馈（或初始状态），确定本轮要改进的具体项目。优先级：
1. **eval 中扣分最多的维度**
2. **penalty 扣分项** — 硬编码颜色、旧 Tailwind 类等，每修一个直接加分
3. **eval "Top 3 改进项"**中的具体建议

#### 第一轮特殊指导（v1）
如果这是第一轮迭代（无 eval report），按以下顺序执行基础设施层迁移：

1. **`tailwind.config.js`** — 这是最重要的文件：
   - 添加 `ck` 色彩命名空间（完整映射见 design-system.md）
   - 添加 `rounded-ck` / `rounded-ck-lg` 圆角
   - 添加 `shadow-composer` 系列阴影
   - 替换字体栈为系统字体（移除 Satoshi）
   - 添加 `ease-claude` 过渡函数
   - 添加 `ck-shimmer` 动画
   - 保留 `question/solution/both` 语义色不变
   - 添加 `darkMode: ['class']` 支持

2. **`src/index.css`** — 基础设施：
   - 引入 CSS 变量定义（light + dark mode，完整复制 design-system.md 中的变量）
   - 重写 `@layer base` — body 使用 CSS 变量、系统字体
   - 重写 `@layer components` — 将 `.bento-card`、`.btn-primary` 等迁移到 ck 体系
   - 添加 `.ck-scrollbar` 样式
   - 添加 `::selection` 样式
   - 添加 `prefers-reduced-motion` 支持

3. **`src/App.tsx`** — 主布局：
   - header: `bg-white` → `bg-ck-bg1`，`text-zinc-*` → `text-ck-t*`，`border-zinc-200` → `border-ck-b2`
   - body: `bg-zinc-50` → `bg-ck-bg2`
   - footer: 同 header 映射
   - 卡片容器: `rounded-lg shadow-sm border border-zinc-200` → `rounded-ck-lg shadow-composer border border-ck-b2`
   - 按钮: 迁移到 ck 按钮规范

4. **各组件文件** — 逐一替换旧 Tailwind 类：
   - 参考 design-system.md 的「迁移速查对照表」
   - 知识点 badge 语义色（`question`/`solution`/`both`）保留不变

### 3. 修改代码
- **你修改的是 live source code** — 直接 Edit 文件
- 修改范围：`solutions/business/quiz-analyzer/frontend/`
- 所有颜色必须使用 CSS 变量或 Tailwind `ck-` 前缀类
- 知识点 badge 语义色可保留硬编码（这是唯一例外）
- 不引入新 npm 依赖
- 不修改功能逻辑

### 4. 验证改动
修改完成后：
1. `cd solutions/business/quiz-analyzer/frontend && npx tsc --noEmit` — TypeScript 编译
2. 如果有测试: `npx vitest run` 或 `npm test`
3. 打开浏览器验证效果（如果 dev server 在运行）：
   - 截图 desktop (1440×900) → `screenshots/v{VERSION}/desktop.png`
   - 截图 mobile (375×812) → `screenshots/v{VERSION}/mobile.png`
4. 视觉检查：色温是否变暖、圆角是否变小、阴影是否变淡

### 5. 写 Changelog
**必须**将改动说明写入 `changelogs/v{VERSION}-changelog.md`（路径在 orchestrator prompt 中给出）。格式：

```markdown
# v{VERSION} Changelog

## 改动文件
- `tailwind.config.js` — [改了什么]
- `src/index.css` — [改了什么]
- `src/App.tsx` — [改了什么]
- `src/components/XXX.tsx` — [改了什么]

## 对应维度
- D1 (Token Alignment): [改进内容]
- D2 (Visual Consistency): [改进内容]
- D3 (Component Polish): [改进内容]
- D4 (Responsive & Interaction): [改进内容]
- D5 (Code Quality): [改进内容]

## 本轮重点
[一句话总结]
```

### 6. 失败回滚
如果修改导致 typecheck 失败且无法快速修复：
1. 记录失败原因到 changelog
2. `git checkout -- solutions/business/quiz-analyzer/frontend/` 回滚
3. 在 changelog 中标记 `## Status: ROLLED BACK`

## 约束提醒
- **纯样式迁移** — 不改功能逻辑
- **不改三栏布局** — quiz-analyzer 特有产品形态
- **不改 props 接口**
- **知识点 badge 语义色保留**（question=blue, solution=green, both=purple）
- **必须通过** typecheck
- **不引入新依赖**
- **每轮克制** — 不要试图一次解决所有问题

## 设计系统速查

### 迁移对照（旧 → 新）
```
bg-slate-50 / bg-zinc-50     → bg-ck-bg2
bg-white                      → bg-ck-bg1
text-primary-800 / text-zinc-900 → text-ck-t1
text-zinc-500 / text-slate-500   → text-ck-t2
text-zinc-400 / text-zinc-700    → text-ck-t3 / text-ck-t2
border-slate-200 / border-zinc-200 → border-ck-b1
border-zinc-300                → border-ck-b1
rounded-3xl                    → rounded-ck-lg
rounded-xl                     → rounded-ck 或 rounded-lg
shadow-soft / shadow-sm        → shadow-composer
shadow-glass / shadow-xl       → shadow-composer-hover
bg-primary-600 / bg-cta-500   → bg-ck-accent
hover:bg-primary-700           → hover:bg-ck-accent-hover
text-primary-600               → text-ck-accent
ring-primary-500               → ring-ck-accent
hover:bg-slate-50              → hover:bg-ck-bg3
```

### 关键 CSS 变量
```
颜色: --bg1, --bg2, --bg3, --t1, --t2, --t3, --b1, --b2
强调: --accent (#AE5630), --accent-hover (#C4633A)
阴影: --composer-shadow, --composer-shadow-hover, --composer-shadow-focus
圆角: --r (8px), --rl (12px)
```
