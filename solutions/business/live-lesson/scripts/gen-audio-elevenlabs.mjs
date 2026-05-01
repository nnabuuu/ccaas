#!/usr/bin/env node
/**
 * gen-audio-elevenlabs.mjs
 *
 * Generates TTS audio via ElevenLabs API (curl-style, no browser needed).
 * Reads manifest.json → 16 text segments → 2 speeds each (1.0x + 0.9x) = 32 MP3 files.
 *
 * Auth: Uses a Bearer JWT token from ElevenLabs web UI (expires in ~1 hour).
 *       To get a fresh token:
 *         1. Open https://elevenlabs.io/app/speech-synthesis/text-to-speech
 *         2. Open DevTools → Network tab
 *         3. Generate any audio, find the POST to api.us.elevenlabs.io
 *         4. Copy the Authorization header value (without "Bearer " prefix)
 *         5. Paste into scripts/.elevenlabs-token
 *
 * Usage:
 *   node scripts/gen-audio-elevenlabs.mjs                  # generate, skip existing
 *   node scripts/gen-audio-elevenlabs.mjs --force           # regenerate all
 *   node scripts/gen-audio-elevenlabs.mjs --only p1         # generate only segment "p1"
 *   node scripts/gen-audio-elevenlabs.mjs --dry-run         # show what would be generated
 */

import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const VOICE_ID = 'qSeXEcewz7tA0Q0qk9fH';
const MODEL_ID = 'eleven_multilingual_v2';
const API_BASE = 'https://api.us.elevenlabs.io/v1/text-to-speech';
const TOKEN_FILE = join(__dirname, '.elevenlabs-token');
const MANIFEST_PATH = join(
  __dirname, '..', 'data', 'lessons', 'ideal-beauty-reading', 'manifest.json',
);
const AUDIO_DIR = join(
  __dirname, '..', 'data', 'lessons', 'ideal-beauty-reading', 'audio',
);
const MIN_FILE_SIZE = 5000; // bytes

// Speeds: normal (1.0) and slow (0.9)
const SPEEDS = [
  { value: 1.0, suffix: '' },
  { value: 0.9, suffix: '-slow' },
];

// Rate limit: pause between requests (ms)
const DELAY_BETWEEN = 2000;

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes('--force') || args.includes('-f');
const DRY_RUN = args.includes('--dry-run');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// ── Read token ──────────────────────────────────────────────────────────────
function readToken() {
  // 1. Environment variable
  if (process.env.ELEVENLABS_TOKEN) return process.env.ELEVENLABS_TOKEN.trim();

  // 2. Token file
  if (existsSync(TOKEN_FILE)) {
    const token = readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (token) return token;
  }

  console.error(`
ERROR: No ElevenLabs token found.

Set one of:
  1. echo "YOUR_JWT_TOKEN" > scripts/.elevenlabs-token
  2. ELEVENLABS_TOKEN="..." node scripts/gen-audio-elevenlabs.mjs

To get a token:
  1. Open https://elevenlabs.io/app/speech-synthesis/text-to-speech
  2. DevTools → Network → generate audio → copy Authorization header
  3. Paste the token (without "Bearer " prefix)
`);
  process.exit(1);
}

// ── Manifest extraction ─────────────────────────────────────────────────────
function cleanMd(s) {
  return s.replace(/\*+/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSegments() {
  const m = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const segments = [];

  if (m.lessonIntro) {
    segments.push({ name: 'lesson-intro', text: cleanMd(m.lessonIntro) });
  }
  if (m.lessonSummary) {
    segments.push({ name: 'lesson-summary', text: cleanMd(m.lessonSummary) });
  }

  for (const p of m.article?.paragraphs ?? []) {
    segments.push({ name: p.id, text: p.text });
  }

  let taskNum = 0;
  const steps = [...(m.readingSteps ?? [])].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  for (const s of steps) {
    if (s.type === 'instruction') {
      const tts = s.studentView?.ttsText ?? '';
      if (tts) segments.push({ name: 'step-i0-intro', text: tts });
    } else if (s.type === 'task') {
      taskNum++;
      const introTts = s.studentView?.ttsText ?? '';
      if (introTts) segments.push({ name: `step-${taskNum}-intro`, text: introTts });
      const summary = s.summary ?? '';
      if (summary) segments.push({ name: `step-${taskNum}-summary`, text: cleanMd(summary) });
    }
  }

  return segments;
}

// ── File helpers ────────────────────────────────────────────────────────────
function fileReady(filepath) {
  if (!existsSync(filepath)) return false;
  return statSync(filepath).size > MIN_FILE_SIZE;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Generate a single audio file ────────────────────────────────────────────
async function generateOne(token, text, speed, outPath) {
  const url = `${API_BASE}/${VOICE_ID}/stream`;

  const body = {
    text,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      speed,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  // Stream response body to file
  const arrayBuf = await res.arrayBuffer();
  writeFileSync(outPath, Buffer.from(arrayBuf));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const token = DRY_RUN ? 'dry-run' : readToken();
  const segments = extractSegments();
  const filtered = ONLY ? segments.filter((s) => s.name === ONLY) : segments;

  if (filtered.length === 0) {
    console.error(`No segments found${ONLY ? ` matching "${ONLY}"` : ''}`);
    process.exit(1);
  }

  const totalFiles = filtered.length * SPEEDS.length;
  console.log(`=== ElevenLabs TTS Generator ===`);
  console.log(`Voice:    ${VOICE_ID} (model: ${MODEL_ID})`);
  console.log(`Segments: ${filtered.length} × ${SPEEDS.length} = ${totalFiles} files`);
  console.log(`Output:   ${AUDIO_DIR}`);
  console.log(`Force:    ${FORCE}`);
  if (DRY_RUN) console.log(`DRY RUN — no files will be generated`);
  console.log('');

  let ok = 0, skip = 0, fail = 0;

  for (const seg of filtered) {
    console.log(`[${seg.name}] (${seg.text.length} chars)`);

    for (const speed of SPEEDS) {
      const filename = `${seg.name}${speed.suffix}.mp3`;
      const outPath = join(AUDIO_DIR, filename);

      // Skip if exists
      if (!FORCE && fileReady(outPath)) {
        const size = statSync(outPath).size;
        console.log(`  SKIP ${filename} (${size} bytes)`);
        skip++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  WOULD GEN ${filename} (speed=${speed.value})`);
        continue;
      }

      console.log(`  GEN  ${filename} (speed=${speed.value})...`);

      try {
        await generateOne(token, seg.text, speed.value, outPath);

        if (fileReady(outPath)) {
          const size = statSync(outPath).size;
          console.log(`  OK   ${filename} (${size} bytes)`);
          ok++;
        } else {
          const size = existsSync(outPath) ? statSync(outPath).size : 0;
          console.log(`  WARN ${filename} — only ${size} bytes`);
          fail++;
        }
      } catch (err) {
        console.log(`  FAIL ${filename} — ${err.message}`);
        fail++;
      }

      // Pause between requests
      await sleep(DELAY_BETWEEN);
    }
    console.log('');
  }

  if (!DRY_RUN) {
    console.log(`=== Done. OK=${ok}  SKIP=${skip}  FAIL=${fail} ===\n`);

    // Verification
    console.log('=== File verification ===');
    const allFiles = filtered.flatMap((s) =>
      SPEEDS.map((sp) => `${s.name}${sp.suffix}.mp3`),
    );
    for (const f of allFiles) {
      const fp = join(AUDIO_DIR, f);
      if (existsSync(fp)) {
        const size = statSync(fp).size;
        const status = size > MIN_FILE_SIZE ? '  ' : '!!';
        console.log(`${status} ${f.padEnd(30)} ${String(size).padStart(8)} bytes`);
      } else {
        console.log(`!! ${f.padEnd(30)}  MISSING`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
