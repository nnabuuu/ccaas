import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const MODEL_ID = 'gemini-3.1-flash-image-preview';

function loadApiKey(): string {
  // Priority 1: Environment variable
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // Priority 2: Config file
  const envFilePath = path.join(os.homedir(), '.kedge-agentic', 'scene-generator.env');
  try {
    const content = fs.readFileSync(envFilePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GEMINI_API_KEY=')) {
        let value = trimmed.slice('GEMINI_API_KEY='.length).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (value) return value;
      }
    }
  } catch {
    // File doesn't exist or can't be read
  }

  throw new Error(
    'GEMINI_API_KEY not found. Set it via:\n' +
    '  1. Environment variable: export GEMINI_API_KEY=your_key\n' +
    '  2. Config file: ~/.kedge-agentic/scene-generator.env (GEMINI_API_KEY=your_key)'
  );
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = loadApiKey();
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface GenerateImageResult {
  success: true;
  imageData: string; // base64
  mimeType: string;
}

export interface GenerateImageError {
  success: false;
  error: string;
}

export async function generateImage(
  prompt: string,
  referenceImageBase64: string,
  referenceImageMimeType: string = 'image/jpeg',
): Promise<GenerateImageResult | GenerateImageError> {
  const ai = getClient();

  const request = {
    model: MODEL_ID,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: referenceImageMimeType,
              data: referenceImageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  let lastError: unknown;

  // Try up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent(request);

      // Find image part in response
      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        return { success: false, error: '图片生成被安全策略拦截，请调整prompt后重试' };
      }

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const imageData = part.inlineData.data;
          if (!imageData) {
            return { success: false, error: 'Gemini returned an image part with no data' };
          }
          return {
            success: true,
            imageData,
            mimeType: part.inlineData.mimeType,
          };
        }
      }

      // No image part found
      const textParts = parts.filter((p: { text?: string }) => p.text).map((p: { text?: string }) => p.text).join('\n');
      return {
        success: false,
        error: textParts || '图片生成被安全策略拦截，请调整prompt后重试',
      };
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        console.error(`[gemini-client] Attempt ${attempt + 1} failed, retrying in 2s...`, err);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }
  }

  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  return { success: false, error: `Gemini API 调用失败: ${errMsg}` };
}
