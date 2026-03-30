# v1 Changelog

## 修改摘要
核心改进：添加"静默高效模式"规则 + 强化 HTTP 429 容错策略 + 跳过非必需工具调用，解决历史上因 token 消耗过大导致 rate limiting 的根本问题。

## 修改详情
- [行 22-33] **新增"静默高效模式"section**：作为最重要的规则置于关键执行规则最顶部。强制禁止聊天输出分析文字，每步只输出 `✅ N` 确认，禁止调用非必需工具（如 `generate_thinking_process_template`）。目标：将 agent 的 token 消耗减少 50%+，避免触发 HTTP 429。
- [行 65-68] **重写容错与恢复策略**：将原来泛化的"工具调用失败"拆分为 HTTP 429 专项处理和其他错误处理。新增"极端情况"策略：当 >3 个核心字段失败时，停止非核心步骤（步骤10、11），集中补输出核心字段。
- [行 151] **新增"执行前提醒"**：在标准工作流入口处再次强调静默模式和 token 预算限制。
- [行 202-211] **强化答案验证**：明确"内心默算，不要输出验证过程到聊天"节省 token，强调 correctAnswer 与 solutionSteps 最后一步结论必须一致（-10 罚分警告）。
- [行 325-353] **步骤5 跳过模板工具调用**：不再调用 `generate_thinking_process_template`，直接提供 Markdown 模板结构让 agent 填充。每题节省一次工具调用。
- [行 135-147] **精简勾股定理实例**：将 Mode B 兜底的详细步骤缩减为一行引用，减少 prompt 长度约 10 行。
- [行 566-568] **精简持久化 section**：从 10 行缩减为 1 行，节省 prompt token。

## 对应维度
- **D1 (Field Completion)**: 核心改进。新增静默模式（减少 token 消耗）+ HTTP 429 专项容错 + 极端情况策略 + 跳过非必需工具调用。预期确保 token 预算足够完成全部 10 个 write_output。
- **D2 (Answer Correctness)**: 强化"内心默算"验证指令，添加 correctAnswer↔solutionSteps 一致性交叉检查警告。
- **D3 (Quiz Type)**: 无变更（现有题型判断规则已足够清晰）。
- **D4 (Solution Steps)**: 通过节省 token 确保 agent 有足够预算生成高质量步骤。
- **D5 (KP Tags)**: Mode C 搜索简化指令（第一轮结果足够即停止搜索）。
- **D6 (Geometry)**: 无变更（几何题在历史评估中得分 5/5）。

## 预期效果
- **D1 Field Completion**: 从 1-3/5 → 4-5/5（通过减少 token 消耗避免 429 限流）
- **D2 Answer Correctness**: 维持或提升（验证过程更严格但不输出到聊天）
- **整体分数**: 从 27-31 → 60-75（主要增益来自避免 rate limiting）
- **关键风险**: 如果 429 是基础设施层面的 rate limit（而非 per-request token 问题），prompt 优化效果有限，需要 test-runner 层面增加请求间延迟
