/**
 * Run V1 (git-in-agentfs) suite. Outputs JSON to validation/results/v1-{platform}.json.
 */
import { execFileSync } from 'node:child_process';
import { runSuite } from '../harness.js';
import { tests } from './tests.js';

function v(cmd: string, args: string[]): string {
  try { return execFileSync(cmd, args, { encoding: 'utf8' }).trim().split('\n')[0]!; }
  catch { return 'unknown'; }
}

const versions = {
  agentfs: v('agentfs', ['--version']),
  git: v('git', ['--version']),
  node: process.version,
};

await runSuite('V1', tests, versions);
