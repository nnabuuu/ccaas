import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { loadBundlesFromDir } from './load-bundles';
import type { LoadedBundle } from '../core/types';

export interface BuildOptions {
  /** Directory to scan for *.stories.ts files */
  cwd: string;
  /** Output directory (will be created if missing) */
  outDir: string;
  /** Base URL the demo will be served from (used in catalog links) */
  baseUrl?: string;
  /** Length of generated short codes (default 8) */
  shortCodeLength?: number;
}

interface BuildResult {
  outDir: string;
  bundleCount: number;
  storyCount: number;
  shortCodes: Record<string, { bundleId: string; storyName: string }>;
}

/**
 * Build a static public demo from a directory of stories.
 *
 * Output layout (in outDir):
 *   /index.html                       — landing page (auto-generated catalog)
 *   /catalog.json                     — machine-readable list of all bundles
 *   /shortcodes.json                  — short-code → {bundleId, storyName} table
 *   /p/<short-code>/index.html        — one demo page per story (single-story preview)
 *   /preview-app.html                 — copy of the runtime UI
 *
 * Each /p/<code>/index.html is a static HTML page that embeds a single story's
 * answerKey and uses the same client-side preview logic (with a stubbed grade
 * function for stories whose plugin.grade was attached at runtime — in v1 we
 * disable check by default for the static demo).
 */
export async function buildStaticDemo(options: BuildOptions): Promise<BuildResult> {
  const cwd = path.resolve(options.cwd);
  const outDir = path.resolve(options.outDir);
  const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
  const shortCodeLen = options.shortCodeLength ?? 8;

  console.error(`[build] scanning ${cwd}...`);
  const bundles = await loadBundlesFromDir(cwd);
  if (bundles.length === 0) {
    throw new Error('No bundles found. Add *.stories.ts files with defineStories().');
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'p'), { recursive: true });

  const shortCodes: Record<string, { bundleId: string; storyName: string }> = {};
  let storyCount = 0;

  // Catalog data
  const catalog = bundles.map((b) => ({
    bundleId: b.plugin.type,
    plugin: { type: b.plugin.type, displayName: b.plugin.displayName },
    meta: b.meta,
    stories: Object.entries(b.stories)
      .filter(([, s]) => !s.skipInDemo)
      .map(([name, s]) => {
        const code = makeShortCode(b.plugin.type, name, shortCodeLen);
        shortCodes[code] = { bundleId: b.plugin.type, storyName: name };
        storyCount++;
        return {
          name,
          displayName: s.name,
          locale: s.locale,
          shortCode: code,
          shareUrl: `${baseUrl}/p/${code}/`,
        };
      }),
  }));

  // Write static assets
  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(outDir, 'shortcodes.json'), JSON.stringify(shortCodes, null, 2));
  fs.writeFileSync(path.join(outDir, 'index.html'), renderLandingPage(catalog, baseUrl));

  // Write per-story demo pages
  for (const bundle of bundles) {
    for (const [storyName, story] of Object.entries(bundle.stories)) {
      if (story.skipInDemo) continue;
      const code = makeShortCode(bundle.plugin.type, storyName, shortCodeLen);
      const dir = path.join(outDir, 'p', code);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        renderDemoPage(bundle, storyName, story, code),
      );
    }
  }

  console.error(`[build] wrote ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'} to ${outDir}`);
  return { outDir, bundleCount: bundles.length, storyCount, shortCodes };
}

/** Deterministic short code (truncated SHA-256 of bundleId + storyName) */
function makeShortCode(bundleId: string, storyName: string, len: number): string {
  return crypto
    .createHash('sha256')
    .update(`${bundleId}:${storyName}`)
    .digest('base64url')
    .slice(0, len);
}

function renderLandingPage(
  catalog: ReturnType<typeof JSON.parse>,
  baseUrl: string,
): string {
  const cards = catalog
    .map((b: { bundleId: string; meta: { title: string; description?: string }; stories: Array<{ shareUrl: string; displayName: string; shortCode: string }> }) => `
    <div class="card">
      <h3>${escape(b.meta.title)} <code>${escape(b.bundleId)}</code></h3>
      ${b.meta.description ? `<p>${escape(b.meta.description)}</p>` : ''}
      <ul>
        ${b.stories.map((s) => `<li><a href="${escape(s.shareUrl)}">${escape(s.displayName)}</a> <span class="code">${escape(s.shortCode)}</span></li>`).join('')}
      </ul>
    </div>
  `)
    .join('');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>KedgeAgentic Exercise Demos</title>
<style>
body{font-family:-apple-system,"PingFang SC",sans-serif;background:#f4f3ef;color:#1c1c1a;padding:60px 40px;max-width:1100px;margin:0 auto}
h1{font-size:48px;letter-spacing:-1.5px;margin-bottom:8px}
.sub{color:#5c5b56;margin-bottom:48px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.card{background:#fbfaf7;border:1px solid rgba(28,28,26,.08);border-radius:12px;padding:22px}
.card h3{font-size:18px;display:flex;align-items:center;gap:8px;margin-bottom:8px}
.card code{font-family:"SF Mono",monospace;font-size:11px;color:#0d5245;background:#dfece8;padding:2px 8px;border-radius:3px}
.card p{font-size:13px;color:#5c5b56;margin-bottom:12px}
.card ul{list-style:none;padding:0}
.card li{padding:6px 0;font-size:13px;border-top:1px solid rgba(28,28,26,.06);display:flex;justify-content:space-between;align-items:center}
.card a{color:#1c1c1a;text-decoration:none;font-weight:600}
.card a:hover{color:#0d5245;text-decoration:underline}
.code{font-family:"SF Mono",monospace;font-size:10px;color:#9c9a92}
footer{margin-top:60px;text-align:center;color:#9c9a92;font-size:11px}
</style></head><body>
<h1>KedgeAgentic <em>Exercise Demos</em></h1>
<p class="sub">Self-contained static demos of exercise type bundles. Click any story to try.</p>
<div class="grid">${cards}</div>
<footer>Generated by <code>exercise-preview build</code> · ${new Date().toISOString().slice(0, 10)} · base=${baseUrl || '(relative)'}</footer>
</body></html>`;
}

function renderDemoPage(
  bundle: LoadedBundle,
  storyName: string,
  story: { name: string; answerKey: Record<string, unknown>; initialAns?: Record<string, unknown> },
  shortCode: string,
): string {
  const data = {
    bundleId: bundle.plugin.type,
    pluginDisplayName: bundle.plugin.displayName ?? bundle.plugin.type,
    bundleTitle: bundle.meta.title,
    storyName,
    storyDisplayName: story.name,
    answerKey: story.answerKey,
    initialAns: story.initialAns ?? {},
    shortCode,
  };
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>${escape(story.name)} · ${escape(bundle.meta.title)}</title>
<style>
body{font-family:-apple-system,"PingFang SC",sans-serif;background:#f4f3ef;color:#1c1c1a;margin:0;padding:24px;max-width:980px;margin:0 auto}
header{margin-bottom:24px}
h1{font-size:32px;letter-spacing:-.8px;margin-bottom:4px}
.crumb{font-size:11px;color:#9c9a92;text-transform:uppercase;letter-spacing:.4px;font-weight:600}
.section{background:#fbfaf7;border:1px solid rgba(28,28,26,.08);border-radius:10px;padding:16px;margin-bottom:14px}
.section-label{font-size:10px;color:#9c9a92;text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:8px}
pre{font-family:"SF Mono",monospace;font-size:11px;line-height:1.55;background:#f4f3ef;border:1px solid rgba(28,28,26,.06);border-radius:6px;padding:10px;overflow-x:auto;white-space:pre-wrap;max-height:340px;overflow-y:auto}
textarea{width:100%;min-height:160px;font-family:"SF Mono",monospace;font-size:12px;border:1px solid rgba(28,28,26,.14);border-radius:6px;padding:10px;resize:vertical}
.note{background:#f6edda;border-left:3px solid #7a4d0e;padding:10px 14px;border-radius:0 6px 6px 0;font-size:12px;color:#5c5b56;margin-bottom:20px}
.note strong{color:#7a4d0e}
footer{margin-top:40px;text-align:center;color:#9c9a92;font-size:10px}
</style></head><body>
<header>
  <div class="crumb">Exercise Demo · ${escape(data.pluginDisplayName)}</div>
  <h1>${escape(data.storyDisplayName)}</h1>
  <div style="font-size:13px;color:#5c5b56">${escape(data.bundleTitle)} · short-code <code>${escape(data.shortCode)}</code></div>
</header>

<div class="note"><strong>Static demo mode.</strong> AnswerKey is read-only and grading is disabled — this is a showcase preview. For live grading, run <code>npx exercise-preview .</code> on the bundle source.</div>

<div class="section">
  <div class="section-label">AnswerKey (read-only)</div>
  <pre id="ak"></pre>
</div>

<div class="section">
  <div class="section-label">Student Answer (editable, no scoring)</div>
  <textarea id="ans"></textarea>
</div>

<footer>Generated by <code>exercise-preview build</code> · KedgeAgentic 即见Agentic</footer>

<script type="application/json" id="story-data">${escape(JSON.stringify(data))}</script>
<script>
const data = JSON.parse(document.getElementById('story-data').textContent);
document.getElementById('ak').textContent = JSON.stringify(data.answerKey, null, 2);
document.getElementById('ans').value = JSON.stringify(data.initialAns, null, 2);
</script>
</body></html>`;
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
