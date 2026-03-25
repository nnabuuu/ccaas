// src/widget-catalog/catalog.ts
// Jijian 教育领域 Widget Catalog — 基于 json-render
//
// 这个文件定义了 LLM 能输出的所有组件类型及其 props schema。
// json-render 的 catalog.prompt() 会自动将这些定义转成 system prompt,
// LLM 只需要输出符合 schema 的 JSON, 客户端自动渲染。

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

// ===== MCP 数据源引用 (Jijian 扩展) =====

/**
 * 在 json-render 的 props 中嵌入 MCP 数据源声明。
 * Jijian 的 DataProvider 在渲染前拦截这些字段,
 * 调用 callMcp 获取数据后注入组件 props。
 */
const mcpSourceSchema = z.object({
  /** MCP 工具名 (如 "curriculum_tree", "learning_analytics") */
  mcp_source: z.string(),
  /** MCP 调用参数, 可包含 $state 引用 */
  mcp_params: z.record(z.unknown()).optional(),
});

// ===== Catalog 定义 =====

export const eduCatalog = defineCatalog(schema, {
  components: {

    // ----- 教育专用组件 -----

    StepWizard: {
      props: z.object({
        title: z.string().describe("向导标题"),
        submit_action: z.string().describe("提交时触发的 Skill action"),
        submit_label: z.string().default("确认生成").describe("提交按钮文案"),
      }),
      hasChildren: true,
      description:
        "多步参数收集向导。children 是按顺序排列的步骤组件 (FormCollect / TreeSelector / BarList / Summary)。" +
        "每步收集的数据存入 $state, 后续步骤可通过 $state 引用前面的值。" +
        "最后一步提交时, 所有步骤的数据合并为结构化参数, 通过 submitToEngine 发给目标 Skill。",
    },

    FormCollect: {
      props: z.object({
        label: z.string().describe("步骤标签"),
        fields: z.array(z.object({
          key: z.string().describe("字段名, 存入 $state"),
          label: z.string().describe("显示标签"),
          type: z.enum(["select", "text", "number", "toggle", "date"]),
          options: z.array(z.string()).optional().describe("select 类型的选项列表"),
          default: z.unknown().optional().describe("默认值"),
        })).describe("表单字段列表"),
      }),
      description:
        "动态表单收集器。用于收集 select/text/number 等基础输入。" +
        "适用场景: 选择学科/年级/班级/课型, 输入课时时长, 设置难度比例。",
    },

    TreeSelector: {
      props: z.object({
        label: z.string().describe("步骤标签"),
        multi_select: z.boolean().default(true),
        /** 数据来源: 从 MCP 获取, 或直接内联 */
        items: z.array(z.object({
          id: z.string(),
          label: z.string(),
          children: z.array(z.object({
            id: z.string(),
            label: z.string(),
          })).optional(),
        })).optional().describe("内联树数据 (如果不从 MCP 获取)"),
      }).merge(mcpSourceSchema.partial()),
      description:
        "层级树形选择器。用于选择课标知识点、教材章节。" +
        "支持两种数据源: 1) mcp_source 指定 MCP 工具动态获取; 2) items 直接内联。" +
        "选中项存入 $state/{step_id}/selected 数组。",
    },

    BarList: {
      props: z.object({
        label: z.string().describe("步骤标签"),
        value_key: z.string().describe("数值字段名 (如 error_rate)"),
        label_key: z.string().describe("标签字段名 (如 kp_name)"),
        items: z.array(z.object({
          id: z.string(),
          label: z.string(),
          value: z.number(),
        })).optional().describe("内联数据"),
        toggleable: z.boolean().default(false).describe("是否可标记"),
        toggle_label: z.string().optional().describe("标记按钮文案"),
        color_thresholds: z.object({
          danger: z.number().default(0.35),
          warning: z.number().default(0.25),
        }).optional(),
      }).merge(mcpSourceSchema.partial()),
      description:
        "条形数据列表, 带可选的标记操作。用于展示学情数据 (知识点错误率)。" +
        "每条数据显示: 名称 + 进度条 + 百分比 + 可选标记按钮。" +
        "toggleable=true 时, 用户可标记哪些项需要重点关注, 标记状态存入 $state。",
    },

    Summary: {
      props: z.object({
        label: z.string().default("确认").describe("步骤标签"),
      }),
      description:
        "汇总确认步骤, 自动收集前面所有步骤的 $state 并格式化展示。" +
        "显示提交按钮, 点击触发 StepWizard 的 submit_action。",
    },

    ReviewPanel: {
      props: z.object({
        title: z.string(),
        items: z.array(z.object({
          id: z.string(),
          content: z.string().describe("内容 (Markdown)"),
          metadata: z.record(z.string()).optional().describe("附加信息 (难度/知识点/题型)"),
        })),
        actions: z.array(z.object({
          key: z.string(),
          label: z.string(),
          style: z.enum(["primary", "default", "danger"]).default("default"),
        })).describe("每项可执行的操作"),
        submit_action: z.string().describe("全部审核完成后的提交 action"),
      }),
      description:
        "逐项审核面板。用于试卷审核 (逐题操作: 保留/替换/微调) 或教案审核。" +
        "每项独立展示, 附带操作按钮。审核结果汇总后通过 submit_action 提交。",
    },

    MetricDashboard: {
      props: z.object({
        metrics: z.array(z.object({
          label: z.string(),
          value: z.string(),
          delta: z.string().optional(),
          trend: z.enum(["up", "down", "neutral"]).optional(),
        })),
        chart: z.object({
          type: z.enum(["line", "bar"]),
          data: z.array(z.object({
            label: z.string(),
            value: z.number(),
          })),
          x_label: z.string().optional(),
          y_label: z.string().optional(),
        }).optional(),
        items: z.array(z.object({
          label: z.string(),
          value: z.number(),
          max_value: z.number().optional(),
          secondary: z.string().optional(),
        })).optional().describe("条形分布列表 (如学校使用分布)"),
      }),
      description:
        "指标仪表盘。用于 Skill 使用分析、学情概览。" +
        "顶部: 指标卡片 (数值+趋势)。中部: 可选图表。底部: 可选分布列表。",
    },
  },

  // ===== Actions =====

  actions: {
    submit: {
      description: "提交 widget 收集的数据给 Jijian 引擎",
      params: z.object({
        target_skill: z.string().describe("目标 Skill ID"),
        data: z.record(z.unknown()).describe("收集到的参数"),
      }),
    },
    navigate: {
      description: "在 Chat 中触发新的对话",
      params: z.object({
        prompt: z.string().describe("发送的 prompt 文本"),
      }),
    },
    call_mcp: {
      description: "客户端直接调用 MCP 工具 (不经过 LLM)",
      params: z.object({
        tool: z.string(),
        params: z.record(z.unknown()),
      }),
    },
  },
});

/**
 * 生成注入 system prompt 的组件描述。
 * 在 Harness 预处理时调用:
 *   const widgetPrompt = eduCatalog.prompt();
 *   system_prompt = base + skill_prompt + widgetPrompt + session + history;
 */
export const getWidgetSystemPrompt = () => eduCatalog.prompt();
