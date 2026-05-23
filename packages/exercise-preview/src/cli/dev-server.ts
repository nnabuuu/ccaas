import * as path from 'node:path';
import { loadBundlesFromDir } from './load-bundles';
import { createPreviewServer } from '../backend/preview-server';

export interface DevServerOptions {
  /** Directory to scan for *.stories.ts files */
  cwd: string;
  /** Server port (default 4321) */
  port?: number;
  /** Path to PreviewApp built UI assets (auto-detected if not given) */
  staticDir?: string;
}

/**
 * Start the preview dev server.
 *
 * Scans `cwd` for `*.stories.ts/tsx/js/mjs` files, loads them as bundles,
 * and starts the lightweight HTTP server on `port`.
 */
export async function startDevServer(options: DevServerOptions): Promise<{
  port: number;
  url: string;
  bundleCount: number;
  storyCount: number;
  stop(): Promise<void>;
}> {
  const cwd = path.resolve(options.cwd);
  console.error(`[preview] scanning ${cwd} for *.stories.{ts,tsx,js,mjs}...`);
  const bundles = await loadBundlesFromDir(cwd);
  if (bundles.length === 0) {
    console.error('[preview] no stories found. Add a *.stories.ts file with defineStories().');
  } else {
    for (const b of bundles) {
      const storyCount = Object.keys(b.stories).length;
      console.error(`[preview] loaded ${path.relative(cwd, b.filePath)} — plugin "${b.plugin.type}" with ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}`);
    }
  }

  const port = options.port ?? 4321;
  const staticDir = options.staticDir ?? defaultStaticDir();
  const server = createPreviewServer({ port, staticDir, bundles });
  const { url } = await server.start();
  console.error(`[preview] server listening on ${url}`);
  if (staticDir) console.error(`[preview] serving UI from ${staticDir}`);

  const totalStories = bundles.reduce((acc, b) => acc + Object.keys(b.stories).length, 0);
  return {
    port,
    url,
    bundleCount: bundles.length,
    storyCount: totalStories,
    stop: () => server.stop(),
  };
}

function defaultStaticDir(): string | undefined {
  // Built UI lives at <package>/web/ (relative to dist/cli/dev-server.js → dist/../web)
  // Try a few locations to support both dev and production layouts.
  const candidates = [
    path.resolve(__dirname, '..', '..', 'web'), // dist/cli/.. → package root
    path.resolve(__dirname, '..', 'web'), // src layout
  ];
  const fs = require('node:fs') as typeof import('node:fs');
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return undefined;
}
