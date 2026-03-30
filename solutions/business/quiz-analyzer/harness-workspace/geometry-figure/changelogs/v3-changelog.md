# v3 Changelog

## 修改摘要
增加第二个 worked example（直角三角形+高）、Wrong/Right 构造对比、标签偏移指南、5层定义顺序规则、顺时针旋转 example、强化双输出要求。

## 背景

v1(30) 和 v2(32) 均因 HTTP 429 速率限制零产出，prompt 改进从未被实际测试。v3 策略：在 v1/v2 已有的坐标配方、ID 规范、强制输出基础上，**补充具体范例和视觉规范**，确保当测试恢复运行时 LLM 有充足的模式参照。

## 修改详情

### geometry-problem-figure/SKILL.md (+55 lines, 21%)

- **[行 76-88] 新增"构造 vs Hardcode 对比"**：用 ❌/✅ 对比展示 perpendicularpoint 的错误写法（hardcode 坐标）和正确写法（构造元素），直观传递 D7 构造规则。覆盖 geo-002（等腰三角形+高）的核心模式。（D7）

- **[行 159-166] 强化定义顺序为 5 层模型**：将原来 4 步定义顺序细化为 5 层（base points → polygon → helpers → derived points → segments/angles），新增"铁律"声明（元素只能引用排在前面的 id），加强引用完整性保障。（D2）

- **[行 186-195] 新增标签偏移指南**：6 种位置（左上/右上/左下/右下/正上/中心）的 label.offset 标准值表，减少 LLM 随意设置偏移导致的 label 遮挡或位置不当。（D5）

- **[行 269-294] 新增 Example 1（直角三角形+高）**：完整的 geo-001/002 类型 JSON 示例，展示：坐标配方（C=原点,B=(4,0),A=(0,3)）、perpendicularpoint 构造垂足 D、两个直角标记（type:square）、标准配色、polygon borders:none。这是最基础的三角形类型，直接对标 benchmark 前两题。（D3, D7, D5）

### geometry-solution-figure/SKILL.md (+23 lines, 10%)

- **[行 185-186] Example 标题改为编号格式**：区分 Example 1（逆时针旋转）和 Example 2（顺时针旋转），便于 LLM 匹配题型。

- **[行 232-245] 新增 Example 2（顺时针旋转）**：覆盖 geo-010 模式的 expr 代码片段，展示绕顶点 A 顺时针旋转 B 得 B' 的坐标公式。强调 sin 符号翻转、range 不能反转。（D3, D6）

- **[行 152-157] 强化"第零步"双输出要求**：将 "必须同时输出" 改为分步清单格式（1. geometryFigure 静态图 2. solutionGeometryFigure 动态图），更明确操作顺序。（D1, D6）

## 对应维度

- D1 (Schema): 🟢 微改 — 双输出清单格式更清晰
- D2 (Refs): 🟡 改进 — 5 层定义顺序模型 + "铁律"声明
- D3 (Correct): 🔴 **主要改进** — 直角三角形完整 example + 顺时针旋转 example
- D4 (Bbox): 无直接改进（v2 已覆盖）
- D5 (Visual): 🟡 改进 — 标签偏移指南表 + example 中展示标准 attrs
- D6 (Anim): 🟡 改进 — 顺时针旋转 example + 强化双输出
- D7 (Constr): 🟡 改进 — Wrong/Right 构造对比直观展示

## 预期效果

前提：HTTP 429 基础设施问题已修复，测试正常运行。

- D3 (Correct, weight 25) 预期 3.5-4/5：两个完整 example 覆盖基础三角形和旋转，coordinate recipes 从 v2 延续
- D2 (Refs, weight 20) 预期 3.5-4/5：5 层模型 + 铁律 + v1 的 ID 命名规范
- D5 (Visual, weight 10) 预期 3.5-4/5：标签偏移表 + 标准配色（v2）+ 完整 example 示范
- D7 (Constr, weight 5) 预期 4-5/5：Wrong/Right 对比 + 直角三角形 example 展示 perpendicularpoint
- D1 (Schema, weight 15) 预期 4-4.5/5：强制输出（v2）+ 双输出清单
- D6 (Anim, weight 15) 预期 4-4.5/5：双 example + 触发条件（v2）
- D4 (Bbox, weight 10) 预期 3.5-4/5：v2 已有指引

**总分预期（假设基础设施正常）：75-85 分**
