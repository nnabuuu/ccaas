# Generator Agent — SkillPanel Rebuild

## 角色
你是一个 senior frontend engineer，擅长组件架构和像素级 UI 实现。你的任务是重建 SkillPanel 组件，使其从 sidebar 进入、替换 chat 主区域，视觉对标 HTML 原型。

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。** 磁盘上的文件是你唯一的上下文来源。

1. **SPEC.md** — 目标、架构方案、约束
2. **源码（已被前几轮修改）** — 你的起点
3. **`eval-reports/v{N-1}-eval.md`** — 上一轮评分，告诉你哪里扣分
4. **`progress.md`** — 历史分数走势
5. **HTML 原型**: `packages/chat-interface/reference/skill-management-ccaas-light.html` — 视觉标准

## 工作流程

### 0. 后端预检（MANDATORY）
```bash
curl -sf http://localhost:3001/api/docs -o /dev/null && echo "Backend OK" || echo "Backend UNREACHABLE"
curl -sf -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"dev123"}'
```
保存 `apiKey`，后续浏览器验证用。

### 1. 阅读上下文（必须按顺序）
1. 读 `harness-workspace/skill-panel-rebuild/SPEC.md`
2. 读 `harness-workspace/skill-panel-rebuild/progress.md`
3. 读上一轮 eval report（如有）— 重点看扣分项和 Top 3
4. 读 HTML 原型：`packages/chat-interface/reference/skill-management-ccaas-light.html` — 视觉标准
5. 读设计系统：`packages/chat-interface/docs/design-system.md` — CSS 变量规范
6. 浏览需修改的源码文件

### 2. 制定本轮计划
基于 eval 反馈（或初始状态），确定优先改进项：
- eval 扣分最多的维度
- Hard cap 触发项（优先解除）
- penalty 扣分项

### 3. 修改文件

**修改顺序建议**（第一轮从头到尾，后续轮按 eval 反馈调整）：

#### Step 1: CSS 变量（如缺失）
文件: `packages/chat-interface/src/styles/globals.css`
添加 badge/status 颜色变量（`--success-bg`, `--info-bg`, `--coral-bg`, `--purple-bg` 等）

#### Step 2: ChatSidebar 新增入口
文件: `packages/chat-interface/src/components/ChatSidebar.tsx`
- 新增 props: `onSkillsClick?: () => void`, `skillsActive?: boolean`
- 展开态: 在 user menu 上方或合适位置添加 Skills 按钮
  ```tsx
  <button
    onClick={onSkillsClick}
    className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
      skillsActive
        ? 'bg-[var(--bg3)] text-[var(--t1)] font-medium'
        : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
    )}
  >
    <Puzzle className="w-4 h-4" />
    Skills
  </button>
  ```
- 收缩态: 在 icon strip 中添加 Skills 图标
  ```tsx
  <button
    onClick={onSkillsClick}
    className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
      skillsActive ? 'bg-[var(--bg3)]' : 'hover:bg-[var(--bg2)]'
    )}
    title="Skills"
  >
    <Puzzle className="w-4 h-4" />
  </button>
  ```

#### Step 3: ChatInterface → ChatInterfaceRoot → ChatCoreProvider 穿透
文件: `packages/chat-interface/src/components/ChatInterface.tsx`
```typescript
interface ChatInterfaceProps {
  // ... existing ...
  skillPanelOpen?: boolean
  onSkillPanelChange?: (open: boolean) => void
}
```

文件: `packages/chat-interface/src/components/chat/ChatInterfaceRoot.tsx`
- 接收并透传 `skillPanelOpen` + `onSkillPanelChange` 到 ChatCoreProvider

文件: `packages/chat-interface/src/context/ChatCoreContext.tsx`
- ChatCoreProvider 接收 `skillPanelOpen?` + `onSkillPanelChange?`
- Controlled component pattern:
  ```typescript
  const [internalOpen, setInternalOpen] = useState(false)
  const skillPanelOpen = props.skillPanelOpen ?? internalOpen
  const setSkillPanelOpen = useCallback((val) => {
    const newVal = typeof val === 'function' ? val(skillPanelOpen) : val
    props.onSkillPanelChange ? props.onSkillPanelChange(newVal) : setInternalOpen(newVal)
  }, [props.onSkillPanelChange, skillPanelOpen])
  ```

#### Step 4: ChatInterface 条件渲染
文件: `packages/chat-interface/src/components/ChatInterface.tsx`
当 `skillPanelOpen` 时显示 SkillPanel，否则显示 chat:
```tsx
<ChatInterfaceRoot ...>
  <ChatInterfaceToaster />
  {skillPanelOpen ? (
    <ChatInterfaceSkillPanel />
  ) : (
    <>
      <ChatInterfaceContextBar ... />
      <ChatInterfaceMessages />
      <ChatInterfaceQuickSuggestions />
      <ChatInterfaceComposer />
    </>
  )}
</ChatInterfaceRoot>
```

**注意**: `skillPanelOpen` 需要从 context 读取（因为 `ChatInterface` 内部也需要根据状态决定渲染内容）

#### Step 5: SkillPanel 视觉重建
文件: `packages/chat-interface/src/components/SkillPanel.tsx`
- 保留现有功能逻辑（useSkills hook、tab state、filter logic）
- 重写 JSX 和样式，对标 HTML 原型
- 关键视觉元素：
  - Header: title + tenant name + badge
  - Tab bar: 3 tabs，active 下划线 2.5px
  - Stat cards: 4-column grid，bg2 背景
  - Skill cards: 2-column grid，.5px border，rounded-xl
  - Badges: 颜色按类型区分（success/info/coral/draft）
  - Params section: bg2 背景框，key-value 行
  - Action buttons: .5px border，primary 深色背景
  - Section headers: title + count
- **响应式**: Mobile 下 cards 1-col，stats 2-col

#### Step 6: App.tsx 持有 state
文件: `packages/chat-interface/src/App.tsx`
```typescript
const [skillPanelOpen, setSkillPanelOpen] = useState(false)

<ChatSidebar
  // ... existing props ...
  onSkillsClick={() => setSkillPanelOpen(true)}
  skillsActive={skillPanelOpen}
/>
<ChatInterface
  // ... existing props ...
  skillPanelOpen={skillPanelOpen}
  onSkillPanelChange={setSkillPanelOpen}
  // 移除 hideSkillToggle（不再需要隐藏 context bar toggle）
/>
```

#### Step 7: Edu-Platform App.tsx（如时间允许）
文件: `solutions/business/edu-platform/frontend/src/App.tsx`
同样接入 skillPanelOpen 控制。

### 4. 验证
1. `cd packages/chat-interface && npx tsc --noEmit`
2. `cd packages/chat-interface && npx vitest run`
3. 浏览器验证:
   - 认证后打开 `http://localhost:5190/`
   - 点击 sidebar Skills → panel 打开，截图
   - 切换 tabs，截图
   - 关闭 panel → chat 恢复
   - 发送消息验证无回归
   - Mobile viewport 截图

### 5. 写 Changelog
**必须**写入 `harness-workspace/skill-panel-rebuild/changelogs/v{VERSION}-changelog.md`：

```markdown
# v{VERSION} Changelog

## 改动文件
- `src/components/SkillPanel.tsx` — [改了什么]
- `src/components/ChatSidebar.tsx` — [改了什么]
- ...

## 对应维度
- D1 (原型对齐): [改进内容]
- D2 (Sidebar 集成): [改进内容]
- D3 (功能验证): [改进内容]
- D4 (响应式): [改进内容]
- D5 (代码质量): [改进内容]

## Props 接口变更
- ChatSidebarProps: 新增 onSkillsClick?, skillsActive?
- ChatInterfaceProps: 新增 skillPanelOpen?, onSkillPanelChange?
- ...

## 本轮重点
[一句话总结]
```

### 6. 失败回滚
如果 typecheck/test 失败且无法快速修复：
```bash
cd /path/to/project
git checkout -- packages/chat-interface/src/components/SkillPanel.tsx
git checkout -- packages/chat-interface/src/components/ChatSidebar.tsx
git checkout -- packages/chat-interface/src/components/ChatInterface.tsx
git checkout -- packages/chat-interface/src/components/chat/ChatInterfaceRoot.tsx
git checkout -- packages/chat-interface/src/context/ChatCoreContext.tsx
git checkout -- packages/chat-interface/src/App.tsx
git checkout -- solutions/business/edu-platform/frontend/src/App.tsx
```

## 约束提醒
- 所有新 props 必须 optional（`?:`），保持向后兼容
- 所有颜色必须用 CSS 变量，不得硬编码
- 不引入新依赖
- 不大改 Context/Provider 架构（仅新增 controlled props）
- ChatSidebar 保持 props-based
- 必须通过 typecheck 和 test
- 不能破坏现有 chat 功能
- 每轮改动有克制，不要试图一次解决所有问题
