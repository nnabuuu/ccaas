/**
 * MCP Server: Rehab Motion Renderer
 *
 * Provides a single tool: create_training_page
 * Accepts ExercisePlan → resolves animation data → returns hosted URL
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exerciseLibrary } from "./exercise-library.js";
import type { ExercisePlan, ExerciseSpec, ExerciseRenderData, RenderConfig } from "./types.js";

const server = new McpServer({
  name: "rehab-motion-renderer",
  version: "0.1.0",
});

// ─────────────────────────────────────────────
// Schema definitions
// ─────────────────────────────────────────────

const ExerciseSpecSchema = z.object({
  type: z.string(),
  customDescription: z.string().optional(),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  restSec: z.number().int().min(10).max(120),
  tempo: z.string(),
  howTo: z.array(z.string()),
  safety: z.array(z.string()),
  overrides: z.object({
    nameZh: z.string().optional(),
    nameEn: z.string().optional(),
    muscles: z.string().optional(),
    phases: z.array(z.string()).optional(),
    phaseDurations: z.array(z.number()).optional(),
  }).optional(),
});

const ExercisePlanSchema = z.object({
  meta: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    locale: z.enum(["zh-CN", "en"]).default("zh-CN"),
  }),
  principles: z.object({
    do: z.array(z.string()),
    avoid: z.array(z.string()),
    frequency: z.string().optional(),
  }).optional(),
  exercises: z.array(ExerciseSpecSchema),
});

// ─────────────────────────────────────────────
// Core logic: resolve ExerciseSpec → ExerciseRenderData
// ─────────────────────────────────────────────

async function resolveExercise(spec: ExerciseSpec): Promise<ExerciseRenderData> {
  if (spec.type !== "custom" && spec.type in exerciseLibrary) {
    // Hot path: table lookup
    const template = exerciseLibrary[spec.type as keyof typeof exerciseLibrary];
    return {
      id: spec.type,
      name: spec.overrides?.nameEn ?? template.name,
      nameZh: spec.overrides?.nameZh ?? template.nameZh,
      sets: spec.sets,
      reps: spec.reps,
      restSec: spec.restSec,
      tempo: spec.tempo,
      muscles: spec.overrides?.muscles ?? template.muscles,
      howTo: spec.howTo,
      safety: spec.safety,
      phases: spec.overrides?.phases ?? template.phases,
      phaseDurations: spec.overrides?.phaseDurations ?? template.phaseDurations,
      figure: template.figure,
      keyframes: template.keyframes,
      visualHints: template.visualHints,
    };
  }

  // Cold path: call Skill B (Animation Engineer) session
  // TODO: Implement isolated Skill B session call
  // For now, throw an informative error
  throw new Error(
    `Unknown exercise type "${spec.type}". ` +
    `Custom exercise generation (Skill B cold path) not yet implemented. ` +
    `Available types: ${Object.keys(exerciseLibrary).join(", ")}`
  );
}

// ─────────────────────────────────────────────
// Hosting: generate accessible URL from RenderConfig
// ─────────────────────────────────────────────

async function hostPage(config: RenderConfig): Promise<string> {
  // Strategy A: Hash URL (zero backend, config in URL)
  const encoded = Buffer.from(JSON.stringify(config)).toString("base64url");
  const baseUrl = process.env.RENDERER_BASE_URL || "https://r.jijian.dev";
  return `${baseUrl}/#config=${encoded}`;

  // Strategy B: KV store (short URL)
  // const id = generateShortId();
  // await kvStore.put(`training:${id}`, JSON.stringify(config), { expirationTtl: 86400 * 30 });
  // return `${baseUrl}/t/${id}`;
}

// ─────────────────────────────────────────────
// MCP Tool definition
// ─────────────────────────────────────────────

server.tool(
  "create_training_page",
  `Generate an interactive rehabilitation training page with animated exercise demonstrations.

Input: An ExercisePlan JSON containing:
- meta: title, subtitle, locale
- principles: training dos/don'ts (optional)
- exercises: array of exercise specs with type, sets, reps, howTo instructions

Available exercise types: pelvic-tilt, dead-bug, cat-cow, seated-boxing, bridge, bird-dog, seated-march, wall-slide

Output: A hosted URL to the interactive training page.`,
  {
    plan: ExercisePlanSchema,
  },
  async ({ plan }) => {
    try {
      const exercises = await Promise.all(
        plan.exercises.map(resolveExercise)
      );

      const renderConfig: RenderConfig = {
        meta: {
          ...plan.meta,
          theme: "dark",
        },
        principles: plan.principles,
        exercises,
      };

      const url = await hostPage(renderConfig);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              url,
              exerciseCount: exercises.length,
              exercises: exercises.map(e => ({
                id: e.id,
                nameZh: e.nameZh,
                sets: e.sets,
                reps: e.reps,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Rehab Motion Renderer MCP Server running on stdio");
}

main().catch(console.error);
