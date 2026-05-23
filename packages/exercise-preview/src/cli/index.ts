#!/usr/bin/env node
/**
 * exercise-preview CLI entry.
 *
 * Usage:
 *   exercise-preview [cwd]                            start dev server (default cwd = process.cwd())
 *   exercise-preview --port 4321 .                    explicit port + path
 *   exercise-preview build [cwd] --out <dir>          static demo build (P4)
 */
import { startDevServer } from './dev-server';
import { buildStaticDemo } from './build';

interface Args {
  cwd: string;
  port: number;
  command: 'dev' | 'build' | 'help';
  outDir: string;
  baseUrl: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    cwd: process.cwd(),
    port: 4321,
    command: 'dev',
    outDir: './dist-demo',
    baseUrl: '',
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') {
      args.port = parseInt(argv[++i] ?? '4321', 10);
    } else if (a === '--out' || a === '-o') {
      args.outDir = argv[++i] ?? './dist-demo';
    } else if (a === '--base-url') {
      args.baseUrl = argv[++i] ?? '';
    } else if (a === '--help' || a === '-h') {
      args.command = 'help';
    } else if (a === 'build') {
      args.command = 'build';
    } else if (a === 'dev') {
      args.command = 'dev';
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }

  if (positional.length > 0) args.cwd = positional[0];
  return args;
}

function printHelp(): void {
  console.log(`exercise-preview — preview platform for KedgeAgentic exercise type plugins

Usage:
  exercise-preview [cwd]                          start dev server
  exercise-preview --port <n> [cwd]               custom port (default 4321)
  exercise-preview build [cwd] --out <dir>        build static public demo
  exercise-preview build [cwd] --base-url <url>   set base URL for catalog links
  exercise-preview --help                          show this message

Dev server: scans cwd for *.stories.ts files, loads them, starts an HTTP
server with REST endpoints under /preview/* and serves the PreviewApp UI.

Build:      generates a static directory tree with one HTML page per story
and a catalog index. Suitable for shipping to S3 / Cloudflare Pages / etc.
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'help') {
    printHelp();
    return;
  }

  if (args.command === 'build') {
    const result = await buildStaticDemo({
      cwd: args.cwd,
      outDir: args.outDir,
      baseUrl: args.baseUrl || undefined,
    });
    console.error(
      `[build] done — ${result.bundleCount} bundle(s), ${result.storyCount} stor${result.storyCount === 1 ? 'y' : 'ies'}`,
    );
    return;
  }

  await startDevServer({ cwd: args.cwd, port: args.port });
  // Keep process alive until SIGINT
  process.stdin.resume();
}

main().catch((err) => {
  console.error('[preview] fatal error', err);
  process.exit(1);
});
