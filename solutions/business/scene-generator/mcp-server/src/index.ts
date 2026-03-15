#!/usr/bin/env node
/**
 * Chibi Scene Generator MCP Server
 *
 * Tools:
 * 1. generate_image - Generate chibi scene image via Gemini with reference image
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { processImage } from './image-processor.js';
import { generateImage } from './gemini-client.js';

// Output directory for generated images (cwd = session workspace)
const OUTPUT_DIR = 'generated-images';

/** Ensure output directory exists and return timestamped filename */
function makeOutputPath(mimeType: string): string {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(OUTPUT_DIR, `chibi-scene-${ts}.${ext}`);
}

// Create the MCP server
const server = new Server(
  {
    name: 'nano-banana-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const generateImageTool: Tool = {
  name: 'generate_image',
  description: `生成 chibi 角色场景插图。

输入参考角色图片（base64）和完整的图像生成 prompt，调用 Gemini 生成图片。

参考图片会自动压缩到适合 API 的大小。生成的图片直接返回。

Example:
{
  "prompt": "Look at this uploaded image carefully. Keep the EXACT same art style...",
  "reference_image": "<base64 encoded image>"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '完整的图像生成 prompt（包含4层架构：角色锁定、风格约束、身体取景、场景描述）',
      },
      reference_image: {
        type: 'string',
        description: '参考角色图片的 base64 编码',
      },
    },
    required: ['prompt', 'reference_image'],
  },
};

// Handle list_tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [generateImageTool] };
});

// Handle call_tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== 'generate_image') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  }

  // Validate inputs
  const prompt = typeof args?.prompt === 'string' ? args.prompt : '';
  const reference_image = typeof args?.reference_image === 'string' ? args.reference_image : '';

  if (!prompt.trim()) {
    return {
      content: [{ type: 'text', text: 'prompt 不能为空' }],
      isError: true,
    };
  }

  if (!reference_image.trim()) {
    return {
      content: [{ type: 'text', text: 'reference_image 不能为空，请提供参考角色图片的 base64 编码' }],
      isError: true,
    };
  }

  // Guard against oversized input (~15MB decoded)
  const MAX_BASE64_LENGTH = 20 * 1024 * 1024;
  if (reference_image.length > MAX_BASE64_LENGTH) {
    return {
      content: [{ type: 'text', text: '参考图片过大（超过 15MB），请使用较小的图片' }],
      isError: true,
    };
  }

  // Decode base64 reference image
  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(reference_image, 'base64');
    if (imageBuffer.length === 0) {
      throw new Error('Empty buffer');
    }
  } catch {
    return {
      content: [{ type: 'text', text: '参考图片格式错误，请确认是有效的 base64 编码图片' }],
      isError: true,
    };
  }

  // Compress reference image
  let processedBase64: string;
  let processedMimeType: string;
  try {
    const processed = await processImage(imageBuffer);
    processedBase64 = processed.data.toString('base64');
    processedMimeType = processed.mimeType;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `参考图片处理失败: ${msg}` }],
      isError: true,
    };
  }

  // Call Gemini API
  console.error(`[nano-banana] Generating image, prompt length: ${prompt.length}`);
  try {
    const result = await generateImage(prompt, processedBase64, processedMimeType);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: result.error }],
        isError: true,
      };
    }

    // Save to local file
    const outputPath = makeOutputPath(result.mimeType);
    const imgBuffer = Buffer.from(result.imageData, 'base64');
    fs.writeFileSync(outputPath, imgBuffer);
    const absPath = path.resolve(outputPath);
    console.error(`[nano-banana] Saved generated image: ${absPath} (${imgBuffer.length} bytes)`);

    // Return image + file path
    return {
      content: [
        {
          type: 'image',
          data: result.imageData,
          mimeType: result.mimeType,
        },
        {
          type: 'text',
          text: `图片已保存到: ${absPath}`,
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `图片生成失败: ${msg}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nano Banana MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
