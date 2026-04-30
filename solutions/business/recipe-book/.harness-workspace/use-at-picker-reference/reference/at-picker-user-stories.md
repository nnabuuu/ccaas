# @ Picker Reference — User Stories

共 13 个 User Story，覆盖 @ 引用和 / 命令双触发模型的全部交互场景。

## 总览

| # | 标题 | 角色 | 核心场景 | Scenario 数 |
|---|---|---|---|---|
| US-1 | 单选引用 | 开发者 | @ → 浏览 → Enter 选择 → Token 插入 | 2 |
| US-2 | 多选引用（Add & Stay） | 工程师 | Space 逐个添加 → Enter 确认提交 | 4 |
| US-3 | 层级导航与实体上下文 | 教师 | → Drill In → Entity Banner → 面包屑 | 2 |
| US-4 | 跨实体引用导航 | 教师 | Ref 跳转 → 懒加载 → 完整路径 Token | 5 |
| US-5 | 搜索结果路径显示 | 用户 | 搜索 → 同名子项不同父级路径标签 | 1 |
| US-6 | Token 管理 | 用户 | Backspace 删除 → ✕ 点击 → hover 完整路径 | 3 |
| US-7 | 双焦点模型 | 用户 | 搜索框 ↔ 列表焦点切换 → 按键语义分离 | 11 |
| US-8 | 鼠标辅助 | 鼠标用户 | + 按钮 → n › 按钮 → 行点击 | 3 |
| US-9 | Smart Landing | 教师 | 上下文 → 最近访问 → 频率排序分类 | 4 |
| US-10 | Loop 检测 | 用户 | ⟲ 标记 → shake 反馈 → 仍可选 | 3 |
| US-11 | / Command Palette | 开发者 | / 搜索技能 → Enter 插入（不执行）→ 参数续写 | 5 |
| US-12 | 多路径导航 | 教师 | 班级→学生 vs 学生直接 → 不同 Token 路径 | 3 |
| US-13 | Entity Icon | 用户 | L3 头像 > L2 类型 > L1 分类 → Token icon | 3 |

---

## US-1: 单选引用——选择一个资源并退出

**Use Case:**
- As a 在 Chat 中构建 prompt 的开发者
- I want to 键入 @，浏览到目标资源，按 Enter 选择并回到输入
- so that 我可以快速引用一个资源而不打断输入流

**Acceptance Criteria:**

Scenario 1: 完整流程，Token 携带完整路径
- Given: 输入框有文字 "请用"，用户键入 `@`，Picker 打开，搜索框聚焦
- When: 用户按 ↓ 进入列表，导航到 Skills → smart-questions → 按 Enter
- Then: Picker 关闭，输入框插入 Token `[⚡ smart-questions]`，Token 的 `data-ref` 包含完整 EntityRef

Scenario 2: 选择子项，Token 显示父级上下文
- Given: 用户导航到 Recipes → 鱼香肉丝 → 食材准备
- When: 按 Enter
- Then: Token 显示为 `[🍳 鱼香肉丝 › 食材准备]`，EntityRef path 包含 3 段

---

## US-2: 多选引用——Add & Stay

**Use Case:**
- As a 需要引用多个工具的解决方案工程师
- I want to 用 Space 或 + 按钮逐个添加，最后 Enter 确认提交
- so that 不必反复触发 @

**Acceptance Criteria:**

Scenario 1: 键盘多选
- Given: 焦点在列表，用户在 Tools 列表
- When: 在 playwright-mcp 上按 Space → 按 ↓ → 在 notion-mcp 上按 Space
- Then: 暂存区显示 "已选: [🔧 playwright-mcp] [🔧 notion-mcp]"，两项行闪绿，列表中两项显示 ✓

Scenario 2: 取消已添加的项
- Given: 暂存区有 playwright-mcp（列表中显示 ✓）
- When: 将高亮移回 playwright-mcp → 按 Space
- Then: playwright-mcp 从暂存区移除，列表中 ✓ 变回 +

Scenario 3: Enter 确认全部
- Given: 暂存区有 2 个 token，高亮在第 3 个未添加的项上
- When: 按 Enter
- Then: 第 3 项加入 + 暂存区共 3 个 token 插入输入框，Picker 关闭

Scenario 4: 跨分类多选
- Given: 用户在 Skills 中 Space 添加了 1 个 skill
- When: 用户按 ← 回到分类 → 进入 Files → Space 添加 1 个 file
- Then: 暂存区显示 2 个来自不同分类的 token

---

## US-3: 层级导航与实体上下文

**Use Case:**
- As a 需要引用菜谱特定章节的用户
- I want to Drill In 后清楚看到"我现在在哪"
- so that 不会把鱼香肉丝的食材准备和红烧牛腩的搞混

**Acceptance Criteria:**

Scenario 1: Entity Banner 显示上下文
- Given: 用户导航到 Recipes → 鱼香肉丝
- When: 按 → 进入子项列表
- Then: 列表顶部显示 Entity Banner（图标 + "鱼香肉丝" + 描述），面包屑显示 `@ › 🍳 Recipes 菜谱 › 鱼香肉丝`

Scenario 2: 面包屑可点击回跳
- Given: 用户在鱼香肉丝的子项列表
- When: 点击面包屑中的 `🍳 Recipes 菜谱`
- Then: 视图跳回 Recipes 分类的实体列表

---

## US-4: 跨实体引用导航

**Use Case:**
- As a 教师浏览教案时发现关联的课堂记录
- I want to 从教案直接 Drill In 到课堂记录的子项
- so that 我可以精确引用某段课堂视频而不必手动切换分类

**Acceptance Criteria:**

Scenario 1: ref 项在列表中显示
- Given: 用户进入 "第三课教案" 的子项列表
- When: 子项列表渲染完成
- Then: 列表分为两组——"◆ 自身内容"（教学目标、步骤...）和"◇ 关联引用"（↗ 课堂记录...），ref 项用 ↗ 箭头和紫色调区分

Scenario 2: Drill Into ref
- Given: "↗ 课堂记录-03-15" 被高亮，右侧显示 `3 ›`
- When: 按 →
- Then: 懒加载课堂记录的子项（课前点名、视频片段...），Entity Banner 显示课堂记录的信息，面包屑追加 `↗ 课堂记录-03-15`

Scenario 3: 从 ref 的子项选择，Token 携带完整跨实体路径
- Given: 用户在课堂记录-03-15 的子项列表中
- When: 选择 "视频片段: 小组讨论" 并按 Enter
- Then: Token 显示 `[📋 …课堂记录 › 视频片段]`，EntityRef path 为 4 段：`[教案, 第三课教案, ref:课堂记录, 视频片段]`

Scenario 4: Loop 检测——ref 指向路径中已存在的实体
- Given: 用户从 教案 → 第三课教案 → ref:课堂记录 → ref:课堂视频，课堂视频有 ref 指回第三课教案
- When: 列表渲染时检测到 第三课教案 已在 navStack 中
- Then: 该 ref 显示 `⟲ 已在路径中`（灰色），不显示 `›`

Scenario 5: 在更深层级继续 drill ref（无深度限制）
- Given: 用户在 ref:课堂视频 的子项列表中，其中有 ref 指向 "标注文档"（路径中不存在）
- When: 按 → drill 进 "标注文档"
- Then: 正常进入标注文档的子项列表，面包屑追加 `↗ 标注文档`

---

## US-5: 搜索结果显示完整来源路径

**Use Case:**
- As a 搜索 "食材" 的用户
- I want to 搜索结果中看到每条结果来自哪个父实体
- so that 我可以区分鱼香肉丝的食材准备和红烧牛腩的选材要点

**Acceptance Criteria:**

Scenario 1: 搜索结果带路径标签
- Given: Picker 打开，焦点在搜索框
- When: 用户键入 "食材"
- Then: 结果列表中，"食材准备" 上方显示路径标签 `🍳 Recipes › 鱼香肉丝`，"选材要点" 上方显示 `🍳 Recipes › 红烧牛腩`，匹配文字加粗高亮

---

## US-6: Token 管理

**Use Case:**
- As a 需要修正引用的用户
- I want to 在 contenteditable 输入框中用 Backspace 删除 Token
- so that 修正错误引用

**Acceptance Criteria:**

Scenario 1: Backspace 删除 Token
- Given: 输入框 `请用 [⚡ smart-questions]| 分析`（| 为光标位置）
- When: 按 Backspace
- Then: Token 被整体移除，光标回到 "请用 " 后方

Scenario 2: 点击 Token 上的 ✕
- Given: Token 显示 `[🍳 鱼香肉丝 › 食材准备] ✕`
- When: 点击 ✕
- Then: Token 从 DOM 和数据模型中移除

Scenario 3: Token hover 显示完整路径
- Given: Token 显示为 `[📋 …课堂记录 › 视频片段]`（省略了中间层级）
- When: 鼠标 hover Token
- Then: Tooltip 显示完整路径 `教案 → 第三课教案 → ↗ 课堂记录-03-15 → 视频片段: 小组讨论`

---

## US-7: 双焦点模型——搜索框 vs 列表

**Use Case:**
- As a 在 Picker 中操作的用户
- I want to 按键行为完全由"我的焦点在搜索框还是列表"决定
- so that 我不需要记住隐藏的状态来预测按键结果

**Acceptance Criteria:**

Scenario 1: 打开 Picker → 搜索框自动聚焦
- Given: 用户键入 `@`
- When: Picker 打开
- Then: 搜索框聚焦（光标闪烁），下方显示 Smart Landing 内容，列表第一项带浅色高亮预览

Scenario 2: 搜索框中 Space = 空格
- Given: 焦点在搜索框，用户已输入 "红烧"
- When: 按 Space
- Then: 搜索框中输入空格字符，变为 "红烧 "，列表实时过滤

Scenario 3: ↓ 从搜索框跳入列表
- Given: 焦点在搜索框，列表显示 Smart Landing 内容
- When: 按 ↓
- Then: 焦点移到列表第一项，高亮加深，搜索框失去光标但保留文字

Scenario 4: 列表中 Space = toggle 添加（带动画反馈）
- Given: 焦点在列表，高亮在"鱼香肉丝"
- When: 按 Space
- Then: 鱼香肉丝添加到暂存区，该行闪绿色（flashGreen, 600ms），暂存区出现新 token pill（popIn 弹入, 250ms），列表中 + 变为绿色 ✓

Scenario 5: ↑ 过列表顶部 → 回到搜索框
- Given: 焦点在列表，高亮在第一项
- When: 按 ↑
- Then: 焦点回到搜索框，搜索词和列表高亮保留

Scenario 6: 搜索框中 Enter = 选中第一个结果
- Given: 焦点在搜索框，用户键入 "教案"，列表过滤显示"第三课教案"（第一项高亮预览）
- When: 按 Enter
- Then: "第三课教案" + 暂存区一起提交，Picker 关闭

Scenario 7: 列表中 Enter 在分类上 = 始终 Drill In
- Given: 焦点在列表，高亮在分类 "Recipes"，暂存区有 2 个 token
- When: 按 Enter
- Then: 进入 Recipes（Drill In），暂存区保留（**不提交**——Enter 在分类上始终是进入）

Scenario 8: 列表中 Enter 在实体上 = 加入 + 提交
- Given: 焦点在列表，高亮在"鱼香肉丝"，暂存区有 1 个 token
- When: 按 Enter
- Then: 鱼香肉丝加入 + 暂存区共 2 个 token 提交，Picker 关闭

Scenario 9: 列表中键入字符 → 焦点回搜索框
- Given: 焦点在列表
- When: 用户键入 "张"
- Then: 焦点回到搜索框，"张" 被输入，列表实时过滤

Scenario 10: Esc 从深层回 Landing（带淡入过渡）
- Given: 焦点在列表，用户在 教案 → 第三课教案 子项中，暂存区有 1 个 token
- When: 按 Esc
- Then: 视图切回 Smart Landing（列表内容 fadeIn 150ms，避免跳变），暂存区保留，焦点回到搜索框

Scenario 11: Esc 从 Landing 关闭（保留暂存）
- Given: 焦点在列表或搜索框，用户在 Landing，暂存区有 2 个 token
- When: 按 Esc
- Then: Picker 关闭，2 个 token 保留插入到输入框（永不丢弃）

---

## US-8: 鼠标辅助——行内 + 按钮与 n › 按钮

**Use Case:**
- As a 偏好鼠标操作的用户
- I want to 用 + 按钮添加、用 n › 按钮展开子级
- so that 每种操作都有明确的鼠标入口

**Acceptance Criteria:**

Scenario 1: + 按钮 = Add & Stay（带动画）
- Given: 实体列表中某项未被添加
- When: 点击行左侧的 + 按钮
- Then: 该项加入暂存区，行闪绿色（flashGreen），暂存区新 token 弹入（popIn），+ 变为绿色 ✓

Scenario 2: n › 按钮 = Drill In
- Given: 实体有 4 个子项，右侧显示 `4 ›`
- When: 点击 `4 ›`
- Then: 进入该实体的子项列表（等同于 →）

Scenario 3: 点击行本身 = Select & Close
- Given: 实体列表中某项被高亮
- When: 点击行主体区域（非 + 按钮、非 n › 按钮）
- Then: 等同于 Enter（选择并退出）

---

## US-9: Smart Landing——上下文感知的初始视图

**Use Case:**
- As a 键入 @ 的用户
- I want to 立刻看到与我当前工作最相关的引用候选
- so that 80% 的情况下我不需要浏览分类就能找到目标

**Acceptance Criteria:**

Scenario 1: 有页面上下文时显示当前实体
- Given: 用户在鱼香肉丝的编辑页面打开 chatbox
- When: 键入 @
- Then: Smart Landing 顶部显示 "★ 当前上下文" 区域，包含鱼香肉丝，可 ↓ 进入列表后 Enter 引用或 → drill 进子项

Scenario 2: 全局/首页打开时无上下文区域
- Given: 用户在平台首页打开 chatbox
- When: 键入 @
- Then: Smart Landing 无 "★ 当前上下文" 区域，直接显示最近访问和分类浏览

Scenario 3: 最近访问区域
- Given: 用户过去 7 天访问过 harness-design-v2.md、第三课教案、playwright-mcp
- When: 键入 @
- Then: "◷ 最近访问" 区域显示这 3 项

Scenario 4: 分类按频率排序
- Given: 用户过去 30 天引用 Recipes 20 次、教案 8 次、Tools 3 次、Skills 0 次
- When: Smart Landing 的 "📁 浏览全部" 区域渲染
- Then: 分类按 Recipes → 教案 → Tools → Skills 排序

---

## US-10: Loop 检测——循环引用不可 Drill

**Use Case:**
- As a 在 ref 链中导航的用户
- I want to 系统自动检测循环引用并阻止我进入死循环
- so that 我不会在 A → B → C → A 中无限打转

**Acceptance Criteria:**

Scenario 1: Loop ref 标记
- Given: 用户在 教案 → 第三课教案 → ref:课堂记录 → ref:课堂视频，视频有 ref 指回 "第三课教案"
- When: 子项列表渲染
- Then: "↗ 第三课教案" 右侧显示 `⟲ 已在路径中`（灰色），不显示 `›`

Scenario 2: Loop ref 按 → 触发 shake 反馈
- Given: "↗ 第三课教案" 被高亮，标记为 loop
- When: 按 →
- Then: 该行触发 shake 动画（左右抖动 400ms），⟲ 旁弹出红色 tooltip "已在路径中，无法展开"（自动消失），不执行 Drill In
- When: 按 Enter
- Then: 正常选择 "第三课教案" 并退出（shake 不影响 Enter/Space 操作）

Scenario 3: Loop ref 可添加到暂存区
- Given: "↗ 第三课教案" 被高亮，标记为 loop
- When: 按 Space 或点击 +
- Then: 正常添加到暂存区

---

## US-11: / Command Palette——插入技能命令

**Use Case:**
- As a 需要用 Skill 处理引用内容的用户
- I want to 键入 `/` 选择一个技能插入到消息中
- so that 我可以在同一条消息中组合引用 + 命令 + 自然语言参数

**Acceptance Criteria:**

Scenario 1: 键入 / 打开 Command Palette
- Given: 输入框焦点在内，用户已插入 `@鱼香肉丝` Token
- When: 用户键入 `/`
- Then: Command Palette 浮层出现，搜索框聚焦，显示最近使用的技能 + 按分组的技能列表

Scenario 2: 搜索过滤技能
- Given: Command Palette 打开，焦点在搜索框
- When: 用户继续键入 "round"
- Then: 列表过滤为匹配项 "roundtable-discussion"，匹配文字加粗

Scenario 3: Enter 插入命令（不执行）
- Given: "roundtable-discussion" 被高亮
- When: 按 Enter
- Then: Command Palette 关闭，输入框中插入 `/roundtable-discussion` pill（金色样式），光标移到 pill 后方，**用户可继续输入参数文字**

Scenario 4: 完整的协作消息
- Given: 输入框包含 `@鱼香肉丝 @红烧牛腩 /roundtable-discussion 请对比这两道菜的难度`
- When: 用户按发送按钮
- Then: 消息携带 2 个 EntityRef + 1 个 SkillCommand + 自然语言参数

Scenario 5: / pill 可删除
- Given: 输入框包含 `/roundtable-discussion` pill
- When: 光标在 pill 右侧按 Backspace
- Then: pill 被整体删除，与 `@` Token 删除行为一致

**Notes:**
- `/` 和 `@` 的核心统一原则：**都只是往输入框里插入内容，不触发执行。** 发送消息才触发执行。
- 单条消息中允许最多 1 个 `/` 命令。

---

## US-12: 多路径导航——同一实体不同入口

**Use Case:**
- As a 教师想引用特定学生
- I want to 既能从班级进入找到学生，也能直接从学生分类找到
- so that 我可以根据当前操作语境选择最合适的引用路径

**Acceptance Criteria:**

Scenario 1: 搜索结果展示多条路径
- Given: 学生 "张小明" 同时存在于 "学生" 和 "班级 › 三年一班" 两个路径
- When: 用户搜索 "张小明"
- Then: 搜索结果显示两条记录，分别带有 `👤 学生` 和 `🏫 班级 › 三年一班` 的路径标签

Scenario 2: 不同路径产生不同 Token
- Given: 用户从 "班级 › 三年一班" 路径选择张小明
- When: Token 插入
- Then: Token 显示 `[🏫 三年一班 › 张小明]`，EntityRef path 为 3 段

Scenario 3: 从学生分类直接选择
- Given: 用户从 "学生" 分类选择张小明
- When: Token 插入
- Then: Token 显示 `[👤 张小明]`，EntityRef path 为 2 段

---

## US-13: Entity Icon 层级——不同实体不同视觉标识

**Use Case:**
- As a 在列表中浏览多种类型实体的用户
- I want to 通过图标快速区分实体类型
- so that 我不需要阅读文字就能定位目标

**Acceptance Criteria:**

Scenario 1: 自定义头像优先显示（L3）
- Given: 学生 "张小明" 有头像照片
- When: 列表中显示该学生
- Then: 显示圆形头像，而不是通用的 👤 图标

Scenario 2: 无头像回退到类型图标（L2）
- Given: 学生 "李四" 没有头像
- When: 列表中显示该学生
- Then: 显示 👤 图标

Scenario 3: Token pill 中显示 icon
- Given: 张小明的 Token 被插入
- When: Token pill 渲染
- Then: pill 左侧显示 16x16 圆形头像，后跟名称
