/**
 * Integration test: real Vision LLM OCR → gradeImageBlank logic.
 *
 * Requires env vars:
 *   LLM_VISION_API_KEY  — API key for the vision model
 *   LLM_VISION_MODEL    — e.g. "qwen-vl-plus" (optional, defaults to qwen-vl-plus)
 *   LLM_VISION_BASE_URL — e.g. "https://dashscope.aliyuncs.com/compatible-mode/v1" (optional)
 *
 * Generates test images via node-canvas. Install: `npm i -D canvas`
 */

import { GuidedDiscoveryGrader } from '../guided-discovery.grader';
import type { GuidedDiscoveryAnswerKey } from '../../../../schemas';
import type { AiPromptBuilder } from '../../../../classroom/ai-prompt-builder';

const API_KEY = process.env.LLM_VISION_API_KEY;
const MODEL = process.env.LLM_VISION_MODEL || 'qwen-vl-plus';
const BASE_URL = process.env.LLM_VISION_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// Skip entire suite when no API key
const describeIf = API_KEY ? describe : describe.skip;

/** Minimal OpenAI-compatible vision call — no NestJS needed */
async function callVisionLlm(
  systemPrompt: string,
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>,
  options?: { maxTokens?: number; temperature?: number; responseFormat?: { type: 'json_object' } },
): Promise<string> {
  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0,
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Vision LLM HTTP ${resp.status}: ${text}`);
  }

  const json = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0].message.content;
}

function makeAiPromptBuilder(): AiPromptBuilder {
  return { callVisionLlm } as unknown as AiPromptBuilder;
}

// ── Image generation helpers (node-canvas) ──

let createCanvas: typeof import('canvas').createCanvas;

function toDataUri(canvas: ReturnType<typeof createCanvas>): string {
  const buf = canvas.toBuffer('image/png');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function drawSingleLine(): string {
  const c = createCanvas(400, 100);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 400, 100);
  ctx.fillStyle = '#000';
  ctx.font = '36px serif';
  ctx.fillText('a²-b²', 30, 60);
  return toDataUri(c);
}

function drawMultiLine(): string {
  const c = createCanvas(400, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 400, 200);
  ctx.fillStyle = '#000';
  ctx.font = '28px serif';
  ctx.fillText('(a+b)(a-b)', 30, 45);
  ctx.fillText('= a²-ab+ab-b²', 30, 100);
  ctx.fillText('= a²-b²', 30, 155);
  return toDataUri(c);
}

function drawCrossedOut(): string {
  const c = createCanvas(500, 120);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 500, 120);

  // Crossed-out wrong answer
  ctx.fillStyle = '#999';
  ctx.font = '32px serif';
  ctx.fillText('b²-a²', 30, 60);
  ctx.strokeStyle = '#f00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(25, 55);
  ctx.lineTo(170, 55);
  ctx.stroke();

  // Correct answer next to it
  ctx.fillStyle = '#000';
  ctx.fillText('a²-b²', 220, 60);
  return toDataUri(c);
}

// ── Tests ──

describeIf('GuidedDiscoveryGrader — vision integration (real LLM)', () => {
  let singleLineImg: string;
  let multiLineImg: string;
  let crossedOutImg: string;

  const answerKey: GuidedDiscoveryAnswerKey = {
    type: 'guided-discovery',
    title: 'test',
    steps: [{
      type: 'formula_blanks',
      id: 's',
      title: '平方差公式',
      blanks: [{ id: 'b', label: '右边', accepts: ['a²-b²', 'a^2-b^2'] }],
    }],
  };

  beforeAll(async () => {
    // Dynamic import so tests compile even without canvas installed
    const canvasModule = await import('canvas');
    createCanvas = canvasModule.createCanvas;

    singleLineImg = drawSingleLine();
    multiLineImg = drawMultiLine();
    crossedOutImg = drawCrossedOut();
  });

  it('single-line formula → correct', async () => {
    const grader = new GuidedDiscoveryGrader(makeAiPromptBuilder());
    const result = await grader.grade(answerKey, {
      steps: { s: { answers: { b: singleLineImg } } },
    });
    expect(result.byDimension.s).toBe(true);
  }, 30_000);

  it('multi-line derivation → recognized or allText fallback matches', async () => {
    const grader = new GuidedDiscoveryGrader(makeAiPromptBuilder());
    const result = await grader.grade(answerKey, {
      steps: { s: { answers: { b: multiLineImg } } },
    });
    expect(result.byDimension.s).toBe(true);
  }, 30_000);

  it('crossed-out content ignored → correct answer recognized', async () => {
    const grader = new GuidedDiscoveryGrader(makeAiPromptBuilder());
    const result = await grader.grade(answerKey, {
      steps: { s: { answers: { b: crossedOutImg } } },
    });
    expect(result.byDimension.s).toBe(true);
  }, 30_000);
});
