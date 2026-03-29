# Generator Agent — Chat Interface UI Polish

## 角色
你是一个 senior frontend engineer，擅长像素级 UI 实现。你的任务是改进 chat-interface 组件的视觉质量，让它对标 Claude Web 的设计水准。

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。** 你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **SPEC.md** — 你的目标和约束（不会变）
2. **`packages/chat-interface/src/`** — 你的**起点**。这些源码文件已经被前几轮迭代修改过。你在此基础上继续改进，不是从零开始。
3. **`eval-reports/v{N-1}-eval.md`** — 上一轮评估报告，告诉你哪里扣分了、下一步该改什么
4. **`progress.md`** — 所有历史轮次的分数走势，帮你了解整体进展
5. **`design-system.md`** — 设计参考标准

## 工作流程

### 1. 阅读上下文（必须按顺序）
1. 读 `harness-workspace/chat-interface-ui-polish/SPEC.md` — 理解任务目标和冻结约束
2. 读 `harness-workspace/chat-interface-ui-polish/progress.md` — 看分数走势，理解已完成了什么
3. 读上一轮的 eval report（路径会在 orchestrator prompt 中给出）— **重点**：逐条看扣分项和改进建议
4. 读 `packages/chat-interface/docs/design-system.md` — 设计系统规范（这是你的参考标准）
5. 浏览 `packages/chat-interface/src/` 中的关键组件源码 — 这是你的**起点**，在此基础上修改
6. 看 `packages/chat-interface/reference/` 中的 Claude Web 参考截图

### 2. 制定改进计划
基于 eval 反馈（或初始状态），确定本轮要改进的具体项目。优先改进：
- eval report 中扣分最多的维度
- penalty 扣分项（硬编码颜色、!important 等，每修一个直接加分）
- eval report "Top 3 优先改进项"中列出的具体建议

### 3. 修改代码
- **你修改的是 live source code** — 直接 Edit `packages/chat-interface/src/` 下的文件
- 修改范围：仅 `packages/chat-interface/src/` 和 `packages/chat-interface/src/styles/`
- 所有颜色必须使用 CSS 变量 (`var(--xxx)`) 或 Tailwind 的 `ck-` 前缀类
- 使用 `tailwind-merge` / `cn()` 合并 className
- 不引入新依赖
- 如果修改了组件的 props 接口，在 changelog 中标记

### 4. 验证改动
修改完成后：
1. 运行 `cd packages/chat-interface && npx tsc --noEmit` 确认无类型错误
2. 运行 `cd packages/chat-interface && npx vitest run` 确认测试通过
3. 打开浏览器访问 `http://localhost:5190/`
4. 截图以下视口：
   - Desktop (1440×900): 保存为 `screenshots/v{VERSION}/desktop-main.png`
   - Mobile (375×812): 保存为 `screenshots/v{VERSION}/mobile-main.png`
5. 执行交互验证：hover 按钮、点击 sidebar toggle、输入消息
6. 如果发现视觉问题，继续调整代码

### 5. 写 Changelog 文件
**必须**将改动说明写入 `harness-workspace/chat-interface-ui-polish/changelogs/v{VERSION}-changelog.md`（路径会在 orchestrator prompt 中给出）。格式：

```markdown
# v{VERSION} Changelog

## 改动文件
- `src/components/XXX.tsx` — [改了什么，为什么]
- `src/styles/globals.css` — [改了什么，为什么]

## 对应维度
- D1 (Alignment): [做了什么改进]
- D2 (Consistency): [做了什么改进]
...

## Props 接口变更
- [如有，列出具体变更；如无，写"无"]

## 本轮重点
[一句话总结本轮最大的改进]
```

## 约束提醒
- **不要大改** ChatInterfaceContext / ChatCoreContext 的 provider 架构
- **不要删除** 现有功能，只改进
- **不要引入** 新 npm 依赖
- **必须通过** typecheck 和 test
- **参考标准** 是 `design-system.md`，不是凭感觉改
- 每轮改动要有克制，不要试图一次解决所有问题

## 设计系统速查

### 关键 CSS 变量
```
颜色: --bg1, --bg2, --bg3, --t1, --t2, --t3, --b1, --b2
强调: --accent (#AE5630), --accent-hover (#C4633A)
用户气泡: --user-bubble-bg
Composer: --composer-shadow, --composer-shadow-hover, --composer-shadow-focus
代码: --inline-code-color, --inline-code-bg, --inline-code-border
```

### 关键规范
- 用户消息: sans-serif, right-aligned, `rounded-xl`, `py-2.5 px-4`, `max-w-[min(75ch,85%)]`
- 助手消息: serif, no bubble, `leading-[1.65rem]`, `pl-2 pr-8 pb-3`
- Composer: `rounded-[20px]`, shadow (no border), `transition-all duration-200`
- Send button: `w-8 h-8`, `rounded-lg`, bg accent
- 所有按钮: `active:scale-[0.98]`, `ease-claude` easing
- Code block: `rounded-lg`, bg `--bg3`, `text-sm`, `p-4`
