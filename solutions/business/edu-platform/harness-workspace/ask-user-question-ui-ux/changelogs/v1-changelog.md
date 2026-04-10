# v1 Changelog

## 修改摘要
从零实现完整的 AskUserQuestion Widget，包含 chips 导航、选项卡片（radio/checkbox）、Other 输入、Preview 分栏、Footer 进度 + 提交流程、已提交状态。

## 修改详情
- `AskUserQuestionRenderer.tsx` 完全重写（~430 行）：
  - 新增类型定义：`QuestionOption`（含 recommended, value, previewContent）、`Question`（含 header, hint, multiSelect, preview）、`SelectionState`
  - `SubmittedView` 组件：read-only 已提交状态渲染，选中项绿色，未选中淡化 opacity:0.3，footer 汇总文字
  - `InteractiveView` 组件：完整交互逻辑
  - `CheckmarkIcon` SVG 组件：checkbox 选中时的勾号
  - `S` 样式常量对象：所有样式通过 CSS 变量，零 hardcoded 颜色，零 box-shadow
- 移除未使用的 `useEffect` import

## 对应维度
- D1 (Chips): Pill 形状 chips，状态圆点（灰/绿），已选值文本（ellipsis 截断），点击切换面板，当前 chip 高亮背景+边框，chips 栏底部边框分隔
- D2 (选项交互): Radio 圆形/Checkbox 方形 indicator，选中 info 色边框+背景+实心，推荐 badge（绿色"推荐"）+ 默认预选，单选 200ms 自动跳下一未答 tab，Other 虚线边框+始终可见输入框+打字自动勾选+清空自动取消，chip 已选值实时更新
- D3 (Footer+提交): 进度 "X / N 已回答" 绿色高亮，确认按钮 disabled→enabled，提交后 Widget 锁定+选中项变 success 绿+未选中淡化+footer 汇总 "✓ 值1 · 值2 · 值3"，通过 handleAction 发送
- D4 (Preview): `preview: true` 时 grid 变 1fr 1fr 分栏，右侧等宽字体+浅灰背景+边框分隔，选项切换实时更新预览，Other 输入时显示自定义预览
- D5 (面板+状态): CSS Grid 叠放（grid-row:1, grid-column:1），opacity 切换，phase 过滤（`block.phase !== 'end'`），toolOutput.answers 非空渲染 SubmittedView，推荐项初始预选，零 console.log
- D6 (设计系统): 所有颜色通过 CSS 变量（--bg1, --bg2, --t1, --t2, --t3, --b1, --info-bg, --info-t, --success-bg, --success-t, --r, --rl），0.5px 边框，零 box-shadow，零 hardcoded hex/rgb

## 预期效果
从 ~15/100 基线提升到 ~70-80/100。主要差距可能在于：
1. 浏览器交互验证不完整（AskUserQuestion 工具未被现有 Skill 调用，需要后端集成才能在真实场景中触发）
2. 面板固定高度可能需要进一步调优
3. 暗色模式未验证

## 注意事项
- AskUserQuestion 已注册为 `customToolRenderers` 但当前无 Skill 调用此工具，需要后端将 AskUserQuestion 暴露为 LLM 可用工具
- prototype HTML 截图已保存供视觉比对
