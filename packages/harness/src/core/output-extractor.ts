import type { SessionResult, OutputSchema } from './interfaces.js';

export function extractOutput(
  sessionResult: SessionResult,
  schema: OutputSchema,
): Record<string, unknown> {
  // Try to parse JSON from session result text
  const text = sessionResult.text.trim();
  let parsed: Record<string, unknown> = {};

  // Try direct JSON parse
  try {
    const json = JSON.parse(text);
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[1]);
        if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
          parsed = json as Record<string, unknown>;
        }
      } catch {
        // Could not parse
      }
    }
  }

  // Validate required fields from schema
  const result: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.key in parsed) {
      result[field.key] = parsed[field.key];
    } else if (field.required) {
      result[field.key] = null;
    }
  }

  return result;
}
