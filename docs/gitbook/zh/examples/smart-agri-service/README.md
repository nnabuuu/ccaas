# 智慧农服 Smart Agri Service

智慧农服是一个生产级 AI 农业咨询平台，展示了 **MCP + 双模板** 架构模式。同一套数据通过不同的 Skill 和会话模板，驱动两种完全不同的用户体验。

## 架构图

```
┌───────────────────────────────────────────────────────┐
│  前端 (React 18)                                      │
│  ┌─────────────────┐  ┌───────────────────────────┐   │
│  │  ChatPanel       │  │  FarmerProfilePanel (7)   │   │
│  │  (SSE 流式)      │  │  CreditReportPanel  (8)   │   │
│  └────────┬─────────┘  └───────────────────────────┘   │
├───────────┼────────────────────────────────────────────┤
│  CCAAS 核心后端 (:3001)                               │
│  会话管理、Skill 路由、MCP 编排                        │
├───────────┼────────────────────────────────────────────┤
│  MCP Server (11 个工具)        stdio 传输              │
│  数据查询 + 汇总计算 + 参考数据 + write_output          │
├───────────┼────────────────────────────────────────────┤
│  Solution 后端 (:3003)         NestJS + SQLite         │
│  农户、土地、作物、农机、贷款、政策                      │
└───────────────────────────────────────────────────────┘
```

## 双模式设计

同一套数据通过不同的 Skill 支持两种截然不同的人设：

| 维度 | 农户顾问 | 信贷评估 |
|------|---------|---------|
| **人设** | 温暖的乡镇农技员 | 专业的信贷风控分析师 |
| **语气** | 亲切、实用 | 正式、数据驱动 |
| **输出字段** | 7 个字段 | 8 个字段 |
| **核心输出** | 机会推荐、政策匹配 | 贷款建议、风险评估 |
| **会话模板** | `farmer-advisor` | `bank-assessor` |

每种模式使用相同的 MCP 工具，但通过 Skill 指令产生完全不同的分析结果。

## 11 个 MCP 工具

MCP Server 提供三类工具：

### 数据查询（5 个）

| 工具 | 输入 | 输出 |
|------|-----|------|
| `get_farmer_by_phone` | 11 位手机号 | 完整农户档案 |
| `get_farmer_land` | farmer\_id | 土地地块（面积、类型、灌溉） |
| `get_farmer_crops` | farmer\_id, year? | 种植记录（产量、收入、成本） |
| `get_farmer_equipment` | farmer\_id | 农机设备（购置价、补贴） |
| `get_farmer_loans` | farmer\_id | 贷款记录（还款状态） |

### 汇总与参考（5 个）

| 工具 | 用途 |
|------|-----|
| `get_farmer_summary` | 计算汇总指标（总面积、利润、信用风险因子） |
| `search_gov_policies` | 按类别、地区、作物类型筛选政策 |
| `get_policy_document` | 获取政策全文（含条款编号，用于引用） |
| `search_loan_products` | 按金额、利率、期限筛选贷款产品 |
| `get_market_prices` | 当前市场数据（粮价、农资价格、走势） |

### 输出同步（1 个）

| 工具 | 用途 |
|------|-----|
| `write_output` | 通过 SSE 将结构化字段同步到前端 |

## 输出同步机制

`write_output` 工具在分析过程中按字段逐个调用。前端通过 SSE 接收每个更新并渐进式渲染：

**农户模式（7 个字段）：**
`narrative_profile` > `farming_analysis` > `opportunity_list` > `policy_matches` > `action_plan` > `risk_factors` > `market_outlook`

**信贷模式（8 个字段）：**
`credit_narrative` > `farmer_background` > `asset_summary` > `income_analysis` > `repayment_history` > `risk_assessment` > `loan_recommendation` > `collateral_evaluation`

## 政策引用

农户顾问可以引用具体政策条款，并生成可验证的链接：

```markdown
根据[《耕地地力保护补贴》第二条](/policy/abc123#section=二&text=补贴标准为每亩125元)，
您可获得每亩 125 元的补贴。
```

前端将这些渲染为可点击的链接，跳转到政策详情页并高亮对应条款。

## 这个架构有什么值得关注的

1. **一份数据，两种人设** —— 同样的 MCP 工具通过 Skill 指令驱动完全不同的用户体验
2. **渐进式字段渲染** —— `write_output` + SSE 实现实时结构化更新，无需等待完整分析
3. **可验证的 AI 结论** —— 政策引用链接到原始文档的具体条款
4. **会话持久化** —— 用户可从持久化的 `output_update` 事件即时恢复历史分析

## 深度阅读

- [MCP 工具设计：多数据源整合](mcp-design.md) —— 11 个工具如何组织来自农户、政策和金融产品的数据
