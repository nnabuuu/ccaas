// src/widget-catalog/mcp-bridge.ts
// MCP 数据桥 — Jijian 在 json-render 上的增值层
//
// json-render 不知道 MCP 是什么。这个模块在 Renderer 外面包一层,
// 拦截 spec 中的 mcp_source 字段, 通过 callMcp 获取数据,
// 注入组件 props 后再交给 json-render 渲染。

import type { SessionContext, JsonRenderSpec } from "../types/chat";

// ===== MCP 调用接口 =====

export interface McpBridge {
  /**
   * 调用 MCP 工具
   * @param tool  工具名 (如 "curriculum_tree")
   * @param params 调用参数
   * @returns 工具返回的数据
   */
  callMcp(tool: string, params: Record<string, unknown>): Promise<unknown>;
}

// ===== State 变量解析 =====

/**
 * 解析 spec 中的 $state 引用。
 * json-render 自身的 $state 引用在 Renderer 内部处理,
 * 但 mcp_params 中的 $state 需要在调 MCP 之前解析。
 *
 * 示例:
 *   {"class_id": {"$state": "/step1/class_id"}}
 *   → {"class_id": "class_2"}
 */
export function resolveStateRefs(
  params: Record<string, unknown>,
  stateSnapshot: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (isStateRef(value)) {
      const path = (value as { $state: string }).$state;
      resolved[key] = getNestedValue(stateSnapshot, path);
    } else if (typeof value === "object" && value !== null) {
      resolved[key] = resolveStateRefs(
        value as Record<string, unknown>,
        stateSnapshot,
      );
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function isStateRef(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "$state" in value &&
    typeof (value as Record<string, unknown>).$state === "string"
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split("/").filter(Boolean);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

// ===== Spec 预处理: 注入 MCP 数据 =====

/**
 * 扫描 json-render spec 中所有包含 mcp_source 的组件,
 * 批量调用 MCP, 将返回数据注入组件 props。
 *
 * 调用时机: Harness 后处理阶段, 在交给 Renderer 之前。
 * 也可以在步骤切换时按需调用 (lazy loading)。
 */
export async function hydrateMcpData(
  spec: JsonRenderSpec,
  bridge: McpBridge,
  stateSnapshot: Record<string, unknown>,
  session: SessionContext,
): Promise<JsonRenderSpec> {
  const hydrated = structuredClone(spec);

  for (const [elementId, element] of Object.entries(hydrated.elements)) {
    const props = element.props as Record<string, unknown>;

    if (typeof props.mcp_source === "string") {
      const tool = props.mcp_source;
      const rawParams = (props.mcp_params ?? {}) as Record<string, unknown>;

      // 解析 $state 引用
      const resolvedParams = resolveStateRefs(rawParams, stateSnapshot);

      // 注入 session context (班级/学校等)
      const enrichedParams = {
        ...resolvedParams,
        _session: {
          schoolId: session.schoolId,
          classId: session.classId,
          userId: session.userId,
        },
      };

      try {
        const data = await bridge.callMcp(tool, enrichedParams);

        // 将 MCP 返回数据注入 items prop
        props.items = data;
        // 清理 MCP 声明字段 (Renderer 不需要)
        delete props.mcp_source;
        delete props.mcp_params;
      } catch (error) {
        // MCP 调用失败时注入错误状态, 组件可优雅降级
        props._mcp_error = {
          tool,
          message: error instanceof Error ? error.message : "MCP call failed",
        };
        delete props.mcp_source;
        delete props.mcp_params;
      }
    }
  }

  return hydrated;
}

// ===== 按需 MCP 加载 (步骤切换时) =====

/**
 * StepWizard 切换步骤时, 按需加载下一步的 MCP 数据。
 * 只水合指定 elementId 的数据, 避免不必要的 MCP 调用。
 */
export async function hydrateElementMcpData(
  spec: JsonRenderSpec,
  elementId: string,
  bridge: McpBridge,
  stateSnapshot: Record<string, unknown>,
  session: SessionContext,
): Promise<JsonRenderSpec> {
  const hydrated = structuredClone(spec);
  const element = hydrated.elements[elementId];

  if (!element) return hydrated;

  const props = element.props as Record<string, unknown>;

  if (typeof props.mcp_source === "string") {
    const resolvedParams = resolveStateRefs(
      (props.mcp_params ?? {}) as Record<string, unknown>,
      stateSnapshot,
    );

    try {
      const data = await bridge.callMcp(props.mcp_source as string, {
        ...resolvedParams,
        _session: {
          schoolId: session.schoolId,
          classId: session.classId,
          userId: session.userId,
        },
      });
      props.items = data;
    } catch (error) {
      props._mcp_error = {
        tool: props.mcp_source,
        message: error instanceof Error ? error.message : "MCP call failed",
      };
    }

    delete props.mcp_source;
    delete props.mcp_params;
  }

  return hydrated;
}
