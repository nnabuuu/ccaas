/**
 * One-time script to generate seed data from existing Zod schemas.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/generate-seed.ts
 *
 * This script:
 * 1. Imports each Zod schema from answer-key.schema.ts
 * 2. Converts to JSON Schema via zod-to-json-schema
 * 3. Outputs to data/seed/exercise-type-defs.json
 *
 * Note: The seed file has already been generated and manually enriched
 * with metadata (label, iconUrl, badgeClass, refinements, defaultValue).
 * This script is kept for reference — re-running it would overwrite the
 * enriched version. Use with caution.
 */

import * as fs from 'fs';
import * as path from 'path';

// Re-import the schemas inline to avoid compilation issues with NestJS decorators
// In practice, the seed file was hand-crafted from the output of this script.

console.log('=== Exercise Type Seed Generator ===');
console.log('');
console.log('The seed file at data/seed/exercise-type-defs.json has been');
console.log('manually created with enriched metadata (labels, icons, badges,');
console.log('refinements). This script is kept for documentation purposes.');
console.log('');
console.log('To regenerate JSON schemas from Zod, you would:');
console.log('  1. Import each XxxAnswerKeySchema from src/schemas/answer-key.schema.ts');
console.log('  2. Call zodToJsonSchema(schema) on each');
console.log('  3. Merge the output into exercise-type-defs.json');
console.log('');

const seedPath = path.resolve(__dirname, '..', 'data/seed/exercise-type-defs.json');
if (fs.existsSync(seedPath)) {
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`Current seed file contains ${data.length} type definitions:`);
  for (const def of data) {
    console.log(`  - ${def.type}: ${def.label} (${def.category})`);
  }
} else {
  console.log('No seed file found at:', seedPath);
}
