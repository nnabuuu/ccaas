import { materializeBase } from '../src/base-materializer.js';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const ccaasDbPath = resolve(repoRoot, '.agent-workspace/data.db');
const baseDir = '/tmp/vfs-poc/base';

const result = materializeBase({ ccaasDbPath, baseDir, seedIfEmpty: true });

console.log(JSON.stringify(result, null, 2));
console.log(`base ready at ${baseDir}`);
