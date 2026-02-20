#!/usr/bin/env node
/**
 * LEGO Mosaic MCP Server (stdio transport)
 *
 * Stdio wrapper that Claude Code CLI can spawn.
 * Defines the same tools as the REST API and forwards calls to the REST server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS } from './types.js';

// REST API base URL
const REST_API_URL = process.env.MCP_REST_URL || 'http://localhost:3006';

const server = new Server(
  { name: 'lego-mosaic-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将马赛克设计数据同步到前端界面的指定字段。

可用字段 (field):
- mosaicConfig: 马赛克配置 (object)
- placements: 砖块排布 (Placement[])
- billOfMaterials: 零件清单 (BillItem[])
- assessment: AI 评估 (LLMAssessment)
- iterationHistory: 迭代历史 (IterationSummary[])
- generationStatus: 生成状态 (object)
- assemblyGuideUrl: PDF 下载链接 (string)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      field: {
        type: 'string',
        description: '要更新的字段名',
        enum: [...SYNC_FIELDS],
      },
      value: {
        description: '字段值（类型取决于字段）',
      },
      preview: {
        type: 'string',
        description: '简短预览描述',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

const analyzeImageTool: Tool = {
  name: 'analyze_image',
  description: `分析上传的图片，提取主色调、构图类型、复杂度，推荐马赛克配置。

返回：dominantColors（含最近乐高颜色映射）、composition、complexity、recommendedSize、suggestedPalette`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      imagePath: {
        type: 'string',
        description: '图片文件路径',
      },
      targetWidth: {
        type: 'number',
        description: '目标宽度（颗粒数），默认 48',
      },
    },
    required: ['imagePath'],
  },
};

const generateMosaicTool: Tool = {
  name: 'generate_mosaic',
  description: `生成乐高马赛克砖块排布。使用 CIEDE2000 颜色匹配和贪心最大优先砖块排布算法。

返回：placements（砖块位置列表）、billOfMaterials（零件清单）、metadata`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      imagePath: {
        type: 'string',
        description: '图片文件路径',
      },
      config: {
        type: 'object',
        description: '马赛克配置',
        properties: {
          widthStuds: { type: 'number', description: '宽度颗粒数 (8-128)' },
          heightStuds: { type: 'number', description: '高度颗粒数 (8-128)' },
          layerCount: { type: 'number', description: '层数 (2或3)' },
          colorPalette: { type: 'array', items: { type: 'number' }, description: 'BrickLink 颜色 ID 数组' },
          brickPool: { type: 'array', items: { type: 'string' }, description: 'BrickLink 零件 ID 数组' },
          resampling: { type: 'string', enum: ['lanczos', 'mitchell'], description: '缩放算法' },
          backgroundColor: { type: 'string', description: '背景色 (hex)' },
        },
        required: ['widthStuds', 'heightStuds', 'layerCount'],
      },
      refinement: {
        type: 'object',
        description: '迭代优化参数（可选）',
        properties: {
          feedback: { type: 'string' },
          concernAreas: { type: 'array' },
        },
      },
    },
    required: ['imagePath', 'config'],
  },
};

const generateAssemblyPdfTool: Tool = {
  name: 'generate_assembly_pdf',
  description: `生成 PDF 拼装指南。包含封面、零件清单（BOM）、分区拼装图和 BrickLink XML。`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      placements: {
        type: 'array',
        description: '砖块排布列表',
      },
      bom: {
        type: 'array',
        description: '零件清单列表',
      },
      config: {
        type: 'object',
        description: '马赛克配置',
      },
      title: {
        type: 'string',
        description: '拼装指南标题',
      },
      outputDir: {
        type: 'string',
        description: '输出目录路径',
      },
    },
    required: ['placements', 'bom', 'config', 'outputDir'],
  },
};

const getLegoColorsTool: Tool = {
  name: 'get_lego_colors',
  description: '获取乐高颜色目录。可过滤透明色和金属色。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      includeTransparent: {
        type: 'boolean',
        description: '是否包含透明色（默认 false）',
      },
      includeMetallic: {
        type: 'boolean',
        description: '是否包含金属色（默认 false）',
      },
    },
  },
};

const getLegoBricksTool: Tool = {
  name: 'get_lego_bricks',
  description: '获取乐高砖块目录。可按零件类型过滤。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      partType: {
        type: 'string',
        description: '零件类型：plate, tile, round_plate, round_tile',
        enum: ['plate', 'tile', 'round_plate', 'round_tile'],
      },
    },
  },
};

const generateMosaicFromGridTool: Tool = {
  name: 'generate_mosaic_from_grid',
  description: `从 AI 生成的全分辨率色块地图生成砖块排布。适合画布 ≤16x16（256 值以内）。

AI 直接输出 heightStuds × widthStuds 的完整颜色网格，此工具只做确定性砖块填充和 BOM 计算。

返回：placements、billOfMaterials、metadata (algorithm="ai-native-grid")`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      colorGrid: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        description: '全分辨率颜色网格（2D 数组，值为 BrickLink 颜色 ID）',
      },
      config: {
        type: 'object',
        description: '马赛克配置',
        properties: {
          widthStuds: { type: 'number' },
          heightStuds: { type: 'number' },
          layerCount: { type: 'number' },
          colorPalette: { type: 'array', items: { type: 'number' } },
          brickPool: { type: 'array', items: { type: 'string' } },
          resampling: { type: 'string' },
          backgroundColor: { type: 'string' },
        },
        required: ['widthStuds', 'heightStuds', 'layerCount'],
      },
    },
    required: ['colorGrid', 'config'],
  },
};

const generateMosaicFromCoarseGridTool: Tool = {
  name: 'generate_mosaic_from_coarse_grid',
  description: `两步 AI Pipeline 第一步：从粗分辨率网格（如 12x12）生成马赛克。

AI 输出低分辨率色块地图（减少 token 消耗），此工具自动最近邻上采样到目标尺寸，然后进行砖块排布。

适合画布 32x32 及以上的大尺寸马赛克。

返回：placements、billOfMaterials、fullGrid（上采样后的全分辨率网格，供 Step 2 使用）、metadata (algorithm="ai-coarse-upscale")`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      coarseGrid: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        description: '粗分辨率颜色网格（如 12x12，值为 BrickLink 颜色 ID）',
      },
      targetWidth: {
        type: 'number',
        description: '目标宽度 studs（上采样目标）',
      },
      targetHeight: {
        type: 'number',
        description: '目标高度 studs（上采样目标）',
      },
      config: {
        type: 'object',
        description: '马赛克配置',
        properties: {
          widthStuds: { type: 'number' },
          heightStuds: { type: 'number' },
          layerCount: { type: 'number' },
          colorPalette: { type: 'array', items: { type: 'number' } },
          brickPool: { type: 'array', items: { type: 'string' } },
          resampling: { type: 'string' },
          backgroundColor: { type: 'string' },
        },
        required: ['widthStuds', 'heightStuds', 'layerCount'],
      },
    },
    required: ['coarseGrid', 'targetWidth', 'targetHeight', 'config'],
  },
};

const refineMosaicRegionsTool: Tool = {
  name: 'refine_mosaic_regions',
  description: `两步 AI Pipeline 第二步：对马赛克进行区域级打磨。

AI 审视 Step 1 结果后，指定区域进行修改：
- recolor: 区域内颜色替换（fromColorId → toColorId）
- fill: 区域填充为指定颜色
- fine_grid: 用精细子网格替换区域（AI 可为眼睛等细节区域提供更高分辨率的子网格）

返回：placements、billOfMaterials、fullGrid（修改后的全分辨率网格）、metadata (algorithm="ai-region-refined")`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      currentGrid: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        description: '当前全分辨率网格（来自 Step 1 的 fullGrid）',
      },
      edits: {
        type: 'array',
        description: '区域编辑列表',
        items: {
          type: 'object',
          properties: {
            startX: { type: 'number' },
            startY: { type: 'number' },
            endX: { type: 'number' },
            endY: { type: 'number' },
            operation: {
              type: 'object',
              description: '操作类型：recolor、fill 或 fine_grid',
            },
          },
          required: ['startX', 'startY', 'endX', 'endY', 'operation'],
        },
      },
      config: {
        type: 'object',
        description: '马赛克配置',
        properties: {
          widthStuds: { type: 'number' },
          heightStuds: { type: 'number' },
          layerCount: { type: 'number' },
          colorPalette: { type: 'array', items: { type: 'number' } },
          brickPool: { type: 'array', items: { type: 'string' } },
          resampling: { type: 'string' },
          backgroundColor: { type: 'string' },
        },
        required: ['widthStuds', 'heightStuds', 'layerCount'],
      },
    },
    required: ['currentGrid', 'edits', 'config'],
  },
};

const tools: Tool[] = [
  writeOutputTool,
  analyzeImageTool,
  generateMosaicTool,
  generateMosaicFromGridTool,
  generateMosaicFromCoarseGridTool,
  refineMosaicRegionsTool,
  generateAssemblyPdfTool,
  getLegoColorsTool,
  getLegoBricksTool,
];

// ============================================================================
// HELPER: Call REST API
// ============================================================================

async function callRestApi(endpoint: string, method: string, body?: unknown): Promise<unknown> {
  const url = `${REST_API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    return { status: 'error', error: `Failed to call REST API: ${error}` };
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'write_output':
        result = await callRestApi('/tools/write_output', 'POST', args);
        break;
      case 'analyze_image':
        result = await callRestApi('/tools/analyze_image', 'POST', args);
        break;
      case 'generate_mosaic':
        result = await callRestApi('/tools/generate_mosaic', 'POST', args);
        break;
      case 'generate_mosaic_from_grid':
        result = await callRestApi('/tools/generate_mosaic_from_grid', 'POST', args);
        break;
      case 'generate_mosaic_from_coarse_grid':
        result = await callRestApi('/tools/generate_mosaic_from_coarse_grid', 'POST', args);
        break;
      case 'refine_mosaic_regions':
        result = await callRestApi('/tools/refine_mosaic_regions', 'POST', args);
        break;
      case 'generate_assembly_pdf':
        result = await callRestApi('/tools/generate_assembly_pdf', 'POST', args);
        break;
      case 'get_lego_colors':
        result = await callRestApi('/tools/get_lego_colors', 'POST', args);
        break;
      case 'get_lego_bricks':
        result = await callRestApi('/tools/get_lego_bricks', 'POST', args);
        break;
      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
});

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LEGO Mosaic MCP Server (stdio) started');
  console.error(`REST API URL: ${REST_API_URL}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
