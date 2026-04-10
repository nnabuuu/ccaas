# v5 Changelog

## 修改摘要
实现缺失的 FileCardActions widget，修复 composer 三态阴影，强制 user bubble 18px 圆角，启用移动端汉堡菜单。

## 修改详情

### 新增文件
- `widgets/EduFileCardActions.tsx` — 新增 FileCardActions widget，匹配 `file-card-actions.html` 原型。支持文件类型着色（.docx=蓝, .pdf=珊瑚, .pptx=青, .xlsx=紫）、hover 反馈、Next Actions 按钮行（含 primary 样式）。所有颜色通过 CSS 变量，零 hardcoded hex。

### 修改文件
- `widget-registry.ts` — 注册 `FileCardActions` widget 到 customWidgets 和 customCatalog，包含 files/actions/title 的 propsSchema。

- `index.css` — 4 项修改:
  1. **Composer 三态阴影**: 将 `--composer-shadow*` 从 `none` 改为三级递进阴影（default: 0.08 → hover: 0.12+ring → focus: 0.15+ring），让 Tailwind 的 `shadow-composer/hover/focus` 类正常工作。删除了 `--composer-float-shadow` 和 `box-shadow: var(--composer-float-shadow) !important` 的硬编码覆盖。
  2. **User bubble 18px**: 添加 `[data-ck="user-msg"] > div:first-child { border-radius: 18px 18px 4px 18px !important; }` CSS 覆盖，确保用户气泡圆角精确匹配 `message-bubbles.html` 原型（之前 Tailwind JIT 未生成对应的 arbitrary value class）。
  3. **移动端汉堡菜单**: 将 `[data-ck="context-bar"] { display: none !important; }` 改为仅在桌面端 (≥1024px) 隐藏，移动端保留 context bar 的 hamburger 按钮，让用户可以访问侧边栏。
  4. **暗色模式阴影**: 同步更新 `prefers-color-scheme: dark` 和 `.dark` 选择器的三态阴影变量。

## 对应维度
- D1 (布局+侧边栏): 无变化（已 5/5）
- D2 (Landing+Composer): 修复 composer 三态阴影递进（default→hover→focus），消除扣分项
- D3 (消息+工具活动): 强制 user bubble 18px 圆角匹配原型，消除 2px 偏差扣分
- D4 (Widget 精修): 新增 EduFileCardActions widget，补全缺失的 file-card-actions.html 对应实现
- D5 (设计系统+暗色): 暗色模式阴影变量同步更新；移动端增加汉堡菜单入口

## 预期效果
- D2: 4/5 → 5/5 (+4 分) — composer 阴影三态完整
- D3: 4/5 → 5/5 (+5 分) — user bubble 18px 精确匹配
- D4: 4/5 → 5/5 (+5 分) — 4/4 widget 全部实现
- D5: 5/5 维持
- 预期总分: 86 → 100/100

## 验证
- `edu-platform/frontend tsc --noEmit`: PASS
- `packages/chat-interface tsc --noEmit`: PASS
- Browser: Landing page, composer shadow, mobile hamburger 均已截图验证
