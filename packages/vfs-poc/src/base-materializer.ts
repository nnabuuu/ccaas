import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';

export interface MaterializeOptions {
  /** Path to ccaas main db (e.g. .agent-workspace/data.db). */
  ccaasDbPath: string;
  /** Target host directory that agentfs will use as --base. */
  baseDir: string;
  /** Seed synthetic demo skills/mcp when db has no rows. POC convenience. */
  seedIfEmpty?: boolean;
}

export interface MaterializeResult {
  baseDir: string;
  skillsWritten: number;
  mcpServersWritten: number;
  seeded: boolean;
}

/**
 * Idempotently project ccaas main db rows onto a host directory tree that
 * agentfs `--base` can overlay. Layout matches ccaas's existing
 * `tenants/{tid}/{skills,mcp-servers}/...` convention so claude sees the same
 * relative paths whether it's running in the legacy local workspace or in a
 * virtual mount.
 */
export function materializeBase(opts: MaterializeOptions): MaterializeResult {
  const { ccaasDbPath, baseDir, seedIfEmpty = true } = opts;

  ensureDir(baseDir);

  if (!existsSync(ccaasDbPath)) {
    if (!seedIfEmpty) throw new Error(`ccaas db not found: ${ccaasDbPath}`);
    return { baseDir, ...seedDemo(baseDir), seeded: true };
  }

  const db = new Database(ccaasDbPath, { readonly: true, fileMustExist: true });
  try {
    const skills = db
      .prepare(
        `SELECT s.id, s.tenantId, s.slug, s.name, s.description, s.content
         FROM skills s WHERE s.enabled = 1 AND s.status != 'deleted'`,
      )
      .all() as Array<{ id: string; tenantId: string; slug: string; name: string; description: string | null; content: string }>;

    const skillFiles = db
      .prepare(`SELECT skillId, relativePath, content FROM skill_files`)
      .all() as Array<{ skillId: string; relativePath: string; content: string }>;

    const mcpServers = db
      .prepare(
        `SELECT id, tenantId, slug, name, type, config FROM mcp_servers WHERE status = 'active'`,
      )
      .all() as Array<{ id: string; tenantId: string; slug: string; name: string; type: string; config: string }>;

    if (skills.length === 0 && mcpServers.length === 0 && seedIfEmpty) {
      return { baseDir, ...seedDemo(baseDir), seeded: true };
    }

    let skillsWritten = 0;
    for (const s of skills) {
      const skillDir = join(baseDir, 'tenants', s.tenantId, 'skills', s.slug);
      writeIfChanged(join(skillDir, 'SKILL.md'), s.content);
      const meta = JSON.stringify(
        { id: s.id, name: s.name, description: s.description },
        null,
        2,
      );
      writeIfChanged(join(skillDir, '.skill.json'), meta);
      skillsWritten++;
    }

    for (const f of skillFiles) {
      const skill = skills.find((s) => s.id === f.skillId);
      if (!skill) continue;
      writeIfChanged(
        join(baseDir, 'tenants', skill.tenantId, 'skills', skill.slug, f.relativePath),
        f.content,
      );
    }

    let mcpServersWritten = 0;
    for (const m of mcpServers) {
      writeIfChanged(
        join(baseDir, 'tenants', m.tenantId, 'mcp-servers', m.slug, 'config.json'),
        JSON.stringify({ name: m.name, type: m.type, config: JSON.parse(m.config) }, null, 2),
      );
      mcpServersWritten++;
    }

    return { baseDir, skillsWritten, mcpServersWritten, seeded: false };
  } finally {
    db.close();
  }
}

function seedDemo(baseDir: string): { skillsWritten: number; mcpServersWritten: number } {
  const tid = 'demo-tenant';
  writeIfChanged(
    join(baseDir, 'tenants', tid, 'skills', 'hello-world', 'SKILL.md'),
    `---
name: hello-world
description: POC demo skill — proves skills are visible inside the agentfs mount.
---

When invoked, greet the user and write a file named greeting.txt in the
current directory containing "hello from session-aware skill".
`,
  );
  writeIfChanged(
    join(baseDir, 'tenants', tid, 'skills', 'hello-world', '.skill.json'),
    JSON.stringify({ id: 'demo-skill', name: 'hello-world' }, null, 2),
  );
  writeIfChanged(
    join(baseDir, 'shared', 'README.md'),
    `# vfs-poc shared base

This directory is mounted (read-through via overlay) into every session's
virtual filesystem. Writes never land here — they go into each session's
private delta.
`,
  );
  return { skillsWritten: 1, mcpServersWritten: 0 };
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

function writeIfChanged(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath);
    const same = createHash('sha1').update(existing).digest('hex') ===
      createHash('sha1').update(content).digest('hex');
    if (same) return;
  }
  writeFileSync(filePath, content);
}
