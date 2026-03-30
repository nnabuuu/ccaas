# v1 Changelog

## 修改摘要

首轮优化：加强 ID 引用完整性验证算法、添加 circle/ellipse 常用模式（含 fillColor:none）、在 Step 4 开头添加"三条铁律"强制规则。

## 修改详情

### geometry-problem-figure/SKILL.md

- **[Step 4 开头, 新增 4 行]** 添加"三条铁律"警告框：(1) 每个元素必须 highlight:false；(2) circle/ellipse/circumcircle/incircle 必须 fillColor:none；(3) polygon borders 必须 strokeColor:none。将分散在 checklist 中的规则提升为最显眼的位置，降低 LLM 遗漏概率。

- **[Common patterns, 新增 8 行]** 在 dashed segment 和 3D 模式之间插入 Circle 和 Ellipse 的标准模式代码块，明确展示 `"fillColor":"none"` 的写法。之前这两种元素没有 common pattern 示例，LLM 可能随意填充。

- **[自检清单 第一步, 改写 4→7 行]** 将 ID 引用验证从简单三步描述改为逐元素算法：维护"已定义 ID 集合"→遍历检查→特别标注 intersection 需要第 3 个 parent 和 polygon parents 必须是 point id。增加了"最常遗漏"提示。

- **[常见错误, 新增 3 行]** 添加三个新错误项：circle 没有 fillColor:none、元素缺少 highlight:false、定义元素引用了后面才定义的 id。

### geometry-solution-figure/SKILL.md

- **[自检清单 第一步, 改写 3→6 行]** 同步 Problem SKILL.md 的 ID 引用验证算法改进。

- **[自检清单 第二步, 改写 7→10 行]** 重组为"三条铁律 + 通用规则"结构，将 highlight:false、fillColor:none、borders:strokeColor:none 提升为最显眼的铁律。

- **[常见错误, 新增 3 行]** 添加 circle fillColor:none、highlight:false、snapValues note 字段的错误提示。

## 对应维度

- D1 (Schema): 强化 attrs 铁律（highlight:false 等），减少 schema 违规
- D2 (Refs): 🔴 **核心改进** — ID 引用验证算法从描述性变为算法性，新增 polygon parent 类型检查
- D3 (Correct): 间接改进——circle/ellipse pattern 示例避免了填充遮挡问题
- D4 (Bbox): 无改动（当前已有足够指导）
- D5 (Visual): 🟡 铁律强调 highlight:false 和 fillColor:none，预期提升 visual polish
- D6 (Anim): 🟢 Solution SKILL.md 新增 snapValues note 字段缺失的错误提示
- D7 (Constr): 无改动（当前已有足够指导）

## 预期效果

- D2 (Refs) 预期 +3~5 分：更强的 ID 验证算法让 LLM 减少断引用
- D5 (Visual) 预期 +2~3 分：三条铁律降低 highlight/fillColor 遗漏率
- D1 (Schema) 预期 +1~2 分：更完整的 attrs 模板
- 总分预期首轮基线：65~75 分（无历史参照，首次运行）
