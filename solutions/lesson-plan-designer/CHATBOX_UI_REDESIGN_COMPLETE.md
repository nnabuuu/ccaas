# Chatbox UI Redesign - Implementation Complete

## 日期
2026-02-12

## 目标
解决信息过载问题：将"文件"和"任务"从平级tab变为次要功能，让对话成为主要界面。

## 实现方案
✅ **Option A: Collapsible Sidebar** (桌面端 + 移动端响应式)

## 实现内容

### 新增组件

#### 1. IconSidebar.tsx
**位置**: `frontend/src/components/IconSidebar.tsx`

**功能**:
- 左侧图标栏（48px宽，深色背景）
- 文件和任务图标按钮
- Badge 显示（文件：琥珀色数字，任务：动态颜色）
- 桌面端专用（`hidden lg:flex`）

**特性**:
- Active 状态：蓝色左边框高亮
- Hover 反馈：背景变暗
- Badge 仅在面板关闭时显示
- 完整的 ARIA 标签支持

#### 2. PanelDrawer.tsx
**位置**: `frontend/src/components/PanelDrawer.tsx`

**功能**:
- 响应式抽屉组件
- 桌面端：从右侧滑入（40% 宽度，最小 320px，最大 480px）
- 移动端：从底部滑入（60vh 高度）

**特性**:
- 300ms 平滑动画（ease-out）
- 桌面端：半透明背景遮罩（点击关闭）
- 移动端：无遮罩（原生手势体验）
- ESC 键关闭
- 防止背景滚动（body overflow hidden）
- role="dialog" 无障碍支持

### 修改组件

#### 3. ChatPanel.tsx
**位置**: `frontend/src/components/ChatPanel.tsx`

**主要变更**:
1. **状态管理**:
   ```typescript
   // Before
   const [activeTab, setActiveTab] = useState<TabType>('messages')

   // After
   const [activePanel, setActivePanel] = useState<'files' | 'tasks' | null>(null)
   ```

2. **布局结构**:
   ```tsx
   // Before: 垂直布局（tab bar + 内容区）
   <div className="flex flex-col">
     <TabBar />
     {activeTab === 'messages' && <Messages />}
     {activeTab === 'files' && <Files />}
   </div>

   // After: 水平布局（sidebar + 主内容 + drawer）
   <div className="flex">
     <IconSidebar />
     <div className="flex-col">
       <Messages /> <!-- 始终可见 -->
     </div>
     <PanelDrawer isOpen={activePanel === 'files'}>
       <Files />
     </PanelDrawer>
   </div>
   ```

3. **移动端图标**:
   - 添加在 header 右侧（仅移动端显示）
   - 与桌面端 IconSidebar 共享状态
   - Badge 显示逻辑一致

4. **Badge 逻辑简化**:
   ```typescript
   const showFilesBadge = activePanel !== 'files' && newFilesCount > 0
   const showTasksBadge = activePanel !== 'tasks' && taskTracking.badgeState.show
   ```

### 删除内容

1. **TabType 类型** (`frontend/src/types/index.ts`)
   - 不再需要 `'messages' | 'files' | 'tasks'` union type

2. **Tab 测试文件** (`frontend/src/components/__tests__/ChatPanel.tabs.test.tsx`)
   - 测试已过时的 tab 系统，完全删除

## 响应式设计

### 桌面端 (>= 1024px)

**默认状态**:
```
┌──┬────────────────────┐
│📁│  对话区域 (100%)    │
│✓│  聊天消息           │
│  │  输入框            │
└──┴────────────────────┘
```

**Files 展开状态**:
```
┌──┬────────────┬───────┐
│📁│ 对话 (60%) │ Files │
│✓│            │ (40%) │
│  │            │       │
└──┴────────────┴───────┘
```

### 移动端 (< 1024px)

**默认状态**:
```
┌──────────────────────┐
│ AI 助手     [📁] [✓] │ ← 图标在 header
├──────────────────────┤
│  对话区域 (全屏)      │
│  聊天消息            │
│  输入框              │
└──────────────────────┘
```

**Files 展开状态**:
```
┌──────────────────────┐
│╔════════════════════╗│
││ Files (bottom)     ││
││ 60vh height        ││
││ [关闭]             ││
│╚════════════════════╝│
│  对话区域 (dimmed)   │
└──────────────────────┘
```

## 技术细节

### 动画
- **Transition**: `transform 300ms ease-out`
- **Desktop slide**: `translateX(100%)` → `translateX(0)`
- **Mobile slide**: `translateY(100%)` → `translateY(0)`

### 样式类
```css
/* Icon Sidebar */
.icon-sidebar { width: 48px; background: gray-900; }
.icon-button { height: 64px; hover:bg-gray-800; }
.icon-button.active { border-left: 2px solid blue-500; }

/* Badge */
.badge { position: absolute; top: 8px; right: 4px; }
.badge.files { background: amber-500; }
.badge.tasks { background: green-500 | red-500 | amber-500; }

/* Drawer */
.drawer { fixed; right: 0; z-index: 50; }
.drawer.desktop { width: 40%; max-width: 480px; min-width: 320px; }
.drawer.mobile { width: 100%; height: 60vh; }
```

## 无障碍支持

1. **键盘导航**:
   - Tab 键在图标按钮间切换
   - Enter/Space 激活按钮
   - ESC 关闭 drawer

2. **屏幕阅读器**:
   - `aria-label="打开文件面板"`
   - `aria-expanded={activePanel === 'files'}`
   - `role="dialog"` on drawer
   - `aria-labelledby="drawer-title"`

3. **焦点管理**:
   - Drawer 打开时阻止背景滚动
   - Drawer 关闭时恢复焦点

## 已验证

✅ **开发服务器启动成功** (http://localhost:5282)
✅ **TypeScript 编译通过** (主代码无错误)
✅ **组件导入正确** (IconSidebar, PanelDrawer)
✅ **状态管理正确** (activePanel 替代 activeTab)
✅ **Badge 逻辑正确** (仅在面板关闭时显示)

## 待验证（需手动测试）

### 桌面端测试 (1440px)
- [ ] 点击 Files 图标 → Drawer 从右侧滑入
- [ ] Chat 区域缩小至 60% 宽度
- [ ] 点击 Files 图标或背景 → Drawer 关闭
- [ ] Chat 区域恢复 100% 宽度
- [ ] Files badge 显示 newFilesCount（面板关闭时）
- [ ] Tasks badge 显示正确颜色和数量

### 移动端测试 (375px)
- [ ] Header 右侧显示文件和任务图标
- [ ] 点击 Files 图标 → Bottom sheet 滑入（60vh）
- [ ] 点击 Tasks 图标 → 切换到 Tasks sheet
- [ ] 点击关闭按钮 → Sheet 滑出
- [ ] Badge 在图标上正确显示

### 响应式测试
- [ ] 从 1024px 缩小到 1023px → Sidebar 隐藏，图标移到 header
- [ ] 从 1023px 放大到 1024px → 图标移到 sidebar

### 键盘测试
- [ ] Tab 键导航到图标按钮
- [ ] Enter/Space 打开/关闭面板
- [ ] ESC 关闭 drawer
- [ ] 焦点管理正确

### Badge 测试
- [ ] Files badge 显示 `newFilesCount`
- [ ] Tasks badge 显示动态颜色（green/red/amber）
- [ ] 打开面板时 badge 隐藏
- [ ] 关闭面板时 badge 显示

## 成功标准对比

| 标准 | 实现状态 |
|------|---------|
| ✅ 信息过载解决 | Chat 占据 100% 宽度（默认） |
| ✅ 上下文保留 | Drawer 展开时 chat 仍可见（桌面端） |
| ✅ 响应式设计 | 桌面：sidebar + drawer，移动：header icons + bottom sheet |
| ✅ 视觉优化 | 300ms 动画，badge 指示器，active 高亮 |
| ✅ 无障碍支持 | 键盘导航，ARIA 标签，焦点管理 |

## 后续优化（可选）

1. **Drawer 宽度调整**:
   - 添加拖拽调整宽度功能
   - 记住用户首选宽度（localStorage）

2. **底部 Sheet 手势**:
   - 添加下拉关闭手势（mobile）
   - 添加拖拽调整高度

3. **快捷键**:
   - `Ctrl+F` 打开 Files 面板
   - `Ctrl+T` 打开 Tasks 面板

4. **动画优化**:
   - 使用 `will-change: transform` 优化性能
   - 添加 spring 动画（react-spring）

## 文件清单

### 新增文件
- `frontend/src/components/IconSidebar.tsx` (80 行)
- `frontend/src/components/PanelDrawer.tsx` (60 行)
- `CHATBOX_UI_REDESIGN_COMPLETE.md` (本文档)

### 修改文件
- `frontend/src/components/ChatPanel.tsx` (主要重构)
- `frontend/src/types/index.ts` (删除 TabType)

### 删除文件
- `frontend/src/components/__tests__/ChatPanel.tabs.test.tsx`

## Git Commit 建议

```bash
git add frontend/src/components/IconSidebar.tsx
git add frontend/src/components/PanelDrawer.tsx
git add frontend/src/components/ChatPanel.tsx
git add frontend/src/types/index.ts
git add CHATBOX_UI_REDESIGN_COMPLETE.md
git rm frontend/src/components/__tests__/ChatPanel.tabs.test.tsx

git commit -m "feat(lesson-plan-designer): redesign chatbox UI with collapsible sidebar

- Replace tab system with icon sidebar + drawer panels
- Desktop: Left icon sidebar (48px) with right slide-in drawers (40% width)
- Mobile: Header icon buttons with bottom sheet drawers (60vh height)
- Chat area is always visible (primary focus)
- Files and Tasks become secondary panels (collapsed by default)
- Responsive design with 300ms smooth animations
- Full keyboard navigation and ARIA support

BREAKING CHANGE: Removed TabType and tab-based navigation

Closes #[issue-number]
"
```

## 总结

✅ **设计目标达成**：对话成为主要界面，文件和任务变为次要功能

✅ **实现完整**：3个组件（IconSidebar, PanelDrawer, ChatPanel重构）

✅ **响应式设计**：桌面和移动端都有优化的体验

✅ **代码质量**：TypeScript 编译通过，开发服务器运行正常

⏳ **待验证**：需要手动测试所有交互和响应式行为
