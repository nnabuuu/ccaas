# MCP 工具设计：多数据源整合

本页分析智慧农服如何用 11 个 MCP 工具整合来自多个数据源（农户记录、政府政策、金融产品）的数据，构建连贯的分析流水线。

## 工具编排模式

Skill 的 system prompt 指定了严格的工具调用顺序，防止 AI 乱序调用或跳过依赖：

```
get_farmer_by_phone          ← 入口（验证农户存在）
    ↓
get_farmer_land              ← 土地资产
get_farmer_crops             ← 收入数据（依赖土地上下文）
get_farmer_equipment         ← 设备资产
get_farmer_loans             ← 信用记录
    ↓
get_farmer_summary           ← 计算汇总（依赖以上所有数据）
    ↓
search_gov_policies          ← 匹配适用政策
get_policy_document          ← 高相关度政策的全文
search_loan_products         ← （仅信贷模式）匹配贷款产品
get_market_prices            ← 当前市场数据
    ↓
write_output × 7 或 8        ← 渐进式输出到前端
```

### 为什么要强制顺序？

如果不强制顺序，AI 可能会：
- 在查询各项数据前就调用 `get_farmer_summary`（缺少汇总所需数据）
- 跳过 `get_policy_document`（缺少引用来源）
- 在收集完所有数据前就调用 `write_output`（分析不完整）

`solution.json` 中的 `appendSystemPrompt` 使该顺序成为强制要求。

## 三类数据源

### 第一类：农户记录（关系型）

五个工具查询按 `farmer_id` 关联的 SQLite 表：

```
farmers ──1:N──→ land_parcels
        ──1:N──→ crop_records
        ──1:N──→ equipment
        ──1:N──→ loan_history
```

**设计选择：按表拆分工具 vs. 单个"获取全部"工具**

选择按表拆分是因为：
- AI 可以在每一步描述学到了什么（更好的进度展示体验）
- 每次工具调用的响应体更小
- 前端工具活动时间线更清晰

### 第二类：参考数据（搜索型）

两个带筛选参数的搜索工具：

| 工具 | 筛选条件 | 设计要点 |
|------|---------|---------|
| `search_gov_policies` | category, region, crop\_type, keyword | 仅返回元数据（不含 `full_text`，节省带宽） |
| `search_loan_products` | bank\_name, min/max amount, keyword | 按资质条件筛选 |

**带宽优化**：`search_gov_policies` 返回 `has_full_text` 标记。AI 仅对高相关度匹配调用 `get_policy_document`，避免不必要地传输政策全文。

### 第三类：计算汇总

`get_farmer_summary` 实时计算指标，而非使用物化视图：

- `total_land_mu`、`total_owned_land_mu`、`total_rented_land_mu`
- `latest_year_revenue`、`latest_year_cost`、`latest_year_profit`
- `avg_yield_per_mu`
- `total_equipment_value`、`total_subsidy_received`
- `active_loans_count`、`active_loans_total`、`has_overdue`
- `credit_score_factors`（计算的风险信号）

**为什么实时计算而非物化？** 数据集较小（50 个演示农户），查询不频繁。实时计算避免数据过期，简化数据模型。

## write\_output 协议

`write_output` 工具连接 AI 分析和前端渲染：

```typescript
write_output(field: SyncField, value: unknown, preview: string)
```

- `field` 必须是预定义的同步字段之一（农户模式 7 个，信贷模式 8 个）
- `value` 可以是字符串（markdown）、JSON 数组（机会列表）或 JSON 对象（贷款建议）
- `preview` 显示在 UI 的同步按钮上

工具返回结构化结果，CCAAS 拦截并通过 SSE 广播：

```json
{
  "data": { "field": "narrative_profile", "value": "...", "preview": "..." },
  "status": "success"
}
```

### 混合值类型

不同字段使用不同的值类型，展示了 `write_output` 的灵活性：

| 字段 | 值类型 | 示例 |
|------|-------|------|
| `narrative_profile` | 字符串（markdown） | 农户画像叙述 |
| `opportunity_list` | JSON 数组 | `[{ title, category, urgency, potential_benefit }]` |
| `policy_matches` | 带 ID 的 JSON 数组 | `[{ policy_id, policy_name, relevance, action }]` |
| `loan_recommendation` | JSON 对象 | `{ product_name, recommended_amount, rationale }` |

前端的 `NarrativeCard` 组件检测值类型并自动选择渲染方式。

## 可迁移模式

### 模式 1：有序工具流水线

当分析存在明确的数据依赖时，在会话模板的 `appendSystemPrompt` 中强制工具调用顺序。这能产生可预测的工具活动时间线和更好的进度指示器。

### 模式 2：搜索 + 详情拆分

对于大文档（政策、手册、规格说明），拆分为：
- **搜索工具**：返回元数据 + 相关性标记（轻量级）
- **详情工具**：返回完整内容（按需调用）

这能防止不必要的文档传输导致上下文膨胀。

### 模式 3：计算汇总工具

当需要多数据源的聚合指标时，创建专用汇总工具，而不是让 AI 自行计算。这确保计算一致性，让 AI 专注于分析而非算术。

### 模式 4：单数据双人设

同样的 11 个工具驱动两种完全不同的用户体验。差异化完全发生在 Skill 层（人设、语气、输出字段选择），而非数据层。这个模式适用于同一数据服务不同受众的任何领域。
