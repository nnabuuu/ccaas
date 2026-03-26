# Widget 渲染架构

## 技术选型: json-render

选用 Vercel Labs 的 json-render 作为 Chat 客户端的 widget 渲染引擎。

**核心原因:**
- LLM 输出 JSON (非 HTML), token 消耗降低 90%+
- defineCatalog + Zod schema 约束 LLM 输出, 质量稳定
- $state / $cond 表达式系统支持步骤间变量引用
- catalog.prompt() 自动生成 system prompt, 无需手写组件描述
- 支持 React / Vue / Svelte / React Native, 跨端复用

**依赖:**
```
@json-render/core
@json-render/react (或 /vue)
zod
```

## 三层渲染管线

```
LLM 输出 JSON spec
      ↓
Jijian Harness 层 (MCP 数据注入 + 权限过滤)
      ↓
json-render Renderer (组件匹配 + 渲染)
```

**Harness 层职责:**
1. 拦截 JSON spec 中的 `mcp_source` 字段
2. 调用 callMcp 获取数据, 注入组件 props
3. 解析 `$mcp` 变量引用 (如 `$mcp.learning_analytics.gaps`)
4. 将 `submit` action 对接 submitToEngine (非 sendPrompt)

## 教育领域 Widget Catalog

在 json-render 的 36 个内置组件基础上, 注册 6 个教育专用组件:

| 组件 | 用途 | 核心 props |
|------|------|-----------|
| StepWizard | 多步参数收集 (备课/出题) | steps[], submit_action |
| TreeSelector | 课标/教材章节勾选 | mcp_source, multi_select |
| BarList | 学情数据展示+标记 | items[], toggleable, value_key |
| ReviewPanel | 逐项审核 (试卷/教案) | items[], actions[] |
| MetricDashboard | 使用分析仪表盘 | metrics[], chart_data |
| FormCollect | 动态表单 | fields[], defaults |

## Fallback 机制

当 LLM 输出的 JSON 包含 catalog 中不存在的 widget type 时:
1. Harness 层检测到未注册类型
2. 向 LLM 发一次追加请求: "请用 HTML 实现以下界面: {spec}"
3. HTML 在沙箱 iframe 中渲染
4. 记录 miss 日志, 作为新组件开发的需求信号
