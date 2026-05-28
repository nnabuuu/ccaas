/**
 * SolutionLoaderService — skill filesystem walker safety
 *
 * Covers CRITICAL #2 (path traversal), HIGH #4 (extension allowlist),
 * MEDIUM #8 (aggregate caps), MEDIUM #9 (unsupported glob warning).
 *
 * These are operator-controlled inputs (solution.json + skill source
 * tree). Anything that lands as `skill_files` content is queryable via
 * the admin API later, so the walker MUST refuse to slurp:
 *  - paths that escape solutionDir (`folder: "../../etc"`)
 *  - symlinks that escape skillDir
 *  - non-text/source extensions (`.env`, `.pem`, `.key`, binaries)
 *  - more than N files / N bytes per skill
 * and must NOT silently fall through on unsupported glob shapes.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SolutionLoaderService } from './solution-loader.service';
import type { ImportSolutionConfig } from './solution-loader.service';

// --------------------------------------------------------------------------
// Mocks — minimal stand-ins so we can construct the service in isolation.
// --------------------------------------------------------------------------

function makeTenants() {
  return {
    findOne: jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'tenant-1', slug: 'walker-test', config: {} }),
    create: jest.fn().mockResolvedValue({
      tenant: { id: 'tenant-1', slug: 'walker-test', name: 'Walker Test' },
    }),
    update: jest.fn().mockResolvedValue({}),
  };
}

function makeSkills() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((_tid, dto) =>
      Promise.resolve({ id: `skill-${dto.slug}`, slug: dto.slug, name: dto.name }),
    ),
  };
}

function makeMcpPool() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  };
}

function makeEventMapper() {
  return {
    registerTenantToolTriggers: jest.fn(),
    clearAllTenantToolTriggers: jest.fn(),
  };
}

function makeBundleService() {
  return {
    resolveActiveBundles: jest.fn().mockReturnValue({
      mcpServers: {},
      toolEventTriggers: [],
      appendSystemPrompts: [],
      activeBundleIds: [],
    }),
    getAvailableBundles: jest.fn().mockReturnValue([]),
  };
}

// --------------------------------------------------------------------------
// On-disk fixtures — each test mints its own temp solutionDir.
// --------------------------------------------------------------------------

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function writeSkill(
  solutionDir: string,
  slug: string,
  opts: {
    frontmatter?: Record<string, string>;
    siblings?: Record<string, string | Buffer>;
  } = {},
) {
  const dir = path.join(solutionDir, 'skills', slug);
  fs.mkdirSync(dir, { recursive: true });
  const fm = {
    name: slug,
    description: `Test skill ${slug}`,
    ...opts.frontmatter,
  };
  const fmYaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\n${fmYaml}\n---\n\nSkill body for ${slug}.\n`,
  );
  for (const [rel, content] of Object.entries(opts.siblings ?? {})) {
    const absPath = path.join(dir, rel);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(absPath, content);
    } else {
      fs.writeFileSync(absPath, content);
    }
  }
  return dir;
}

function makeConfig(overrides: Partial<ImportSolutionConfig> = {}): ImportSolutionConfig {
  return {
    tenant: { name: 'Walker Test', slug: 'walker-test' },
    mode: 'simple',
    mcpServers: {},
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('SolutionLoaderService — skill walker safety', () => {
  let loader: SolutionLoaderService;
  let skills: ReturnType<typeof makeSkills>;
  let tempDirs: string[] = [];
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    skills = makeSkills();
    loader = new SolutionLoaderService(
      makeTenants() as any,
      skills as any,
      makeMcpPool() as any,
      makeEventMapper() as any,
      makeBundleService() as any,
      { get: jest.fn(() => undefined) } as any,
      // Phase 4: SolutionToolkitRegistry — skill-walk specs never hit
      // a proxyEnabled MCP server, so an inert stub is sufficient.
      { registerToolkit: jest.fn(), listToolsForSolution: () => [] } as any,
    );
    // Pin warn so we can assert specific messages without polluting test output.
    warnSpy = jest.spyOn((loader as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((loader as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((loader as any).logger, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const d of tempDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    tempDirs = [];
    jest.restoreAllMocks();
  });

  function tmpSolution(): string {
    const d = mkTmp('skill-walk');
    tempDirs.push(d);
    return d;
  }

  // ----- CRITICAL #2 path traversal --------------------------------------

  it('refuses to import a skill ref that escapes solutionDir via `..`', async () => {
    const solutionDir = tmpSolution();
    // Build a "skill" outside the solutionDir; the malicious solution.json
    // points at it via "../escape".
    const outsideDir = mkTmp('escape-target');
    tempDirs.push(outsideDir);
    writeSkill(outsideDir, 'should-not-import');

    // ref points OUTSIDE solutionDir
    const relativeEscape = path.relative(
      solutionDir,
      path.join(outsideDir, 'skills'),
    );
    await loader.importFromConfig(
      makeConfig({ skills: [`${relativeEscape}/*`] as any }),
      { solutionDir },
    );

    expect(skills.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/escapes solutionDir/));
  });

  // ----- MEDIUM #9 unsupported glob shapes -------------------------------

  it('warns and skips when the skill ref uses an unsupported glob (`**`)', async () => {
    const solutionDir = tmpSolution();
    writeSkill(solutionDir, 'real-skill');

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/**' as any] }),
      { solutionDir },
    );

    expect(skills.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/unsupported glob/));
  });

  it('warns and skips on brace expansion in the ref', async () => {
    const solutionDir = tmpSolution();
    writeSkill(solutionDir, 'a');
    writeSkill(solutionDir, 'b');

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/{a,b}' as any] }),
      { solutionDir },
    );

    expect(skills.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/unsupported glob/));
  });

  // ----- HIGH #4 extension allowlist --------------------------------------

  it('skips secret-shaped files (.env, .key, .pem, binaries) when collecting skill files', async () => {
    const solutionDir = tmpSolution();
    writeSkill(solutionDir, 'manifest-editor', {
      siblings: {
        'tools/readme.md': '# tool readme',
        'secrets.json': '{"api_key": "redact-me"}', // .json — extension is allowed
        '.env': 'OPENAI_API_KEY=abc',                // dotfile — already skipped
        'id_rsa': 'PRIVATE KEY MATERIAL',            // no extension — must be skipped
        'cert.pem': '-----BEGIN CERTIFICATE-----',
        'token.key': 'oauth-token-xyz',
        'icon.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG magic
        'scripts/lint.sh': '#!/bin/sh\necho ok',
      },
    });

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/*'] }),
      { solutionDir },
    );

    expect(skills.create).toHaveBeenCalledTimes(1);
    const createDto = skills.create.mock.calls[0][1];
    const relPaths = (createDto.files ?? []).map((f: any) => f.relativePath).sort();

    // High-risk file shapes the allowlist explicitly excludes.
    expect(relPaths).not.toContain('id_rsa');     // no extension
    expect(relPaths).not.toContain('cert.pem');   // .pem
    expect(relPaths).not.toContain('token.key');  // .key
    expect(relPaths).not.toContain('icon.png');   // .png (binary)
    expect(relPaths).not.toContain('.env');       // dotfile

    // Belt-and-suspenders: secret material from those files must not leak.
    const allContent = (createDto.files ?? []).map((f: any) => f.content).join('\n');
    expect(allContent).not.toContain('PRIVATE KEY MATERIAL');
    expect(allContent).not.toContain('-----BEGIN CERTIFICATE-----');
    expect(allContent).not.toContain('OPENAI_API_KEY');
    expect(allContent).not.toContain('oauth-token-xyz');

    // Allow-listed source/doc shapes still come through.
    expect(relPaths).toContain('scripts/lint.sh');
    expect(relPaths).toContain('tools/readme.md');

    // Trade-off documented in skills.service.ts allowlist: `.json` IS
    // allowed because skill examples / configs legitimately use it.
    // A file literally named `secrets.json` therefore IS imported —
    // operators must not park real secrets in skill dirs. This
    // assertion pins that contract; tightening the allowlist further
    // (e.g. denylist filename patterns) is a deliberate follow-up.
    expect(relPaths).toContain('secrets.json');
  });

  // ----- MEDIUM #8 aggregate caps ----------------------------------------

  it('stops collecting after the per-skill file-count cap', async () => {
    const solutionDir = tmpSolution();
    const siblings: Record<string, string> = {};
    // Generate way more than MAX_SKILL_FILES (200). Use .md so they
    // pass the allowlist; the count cap is the only gate left.
    for (let i = 0; i < 300; i++) {
      siblings[`docs/note-${String(i).padStart(3, '0')}.md`] = `note ${i}`;
    }
    writeSkill(solutionDir, 'manifest-editor', { siblings });

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/*'] }),
      { solutionDir },
    );

    const createDto = skills.create.mock.calls[0][1];
    expect(createDto.files.length).toBeLessThanOrEqual(200);
    expect(createDto.files.length).toBeGreaterThan(150); // sanity — we got plenty
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/-file cap/));
  });

  it('stops collecting after the per-skill byte cap', async () => {
    const solutionDir = tmpSolution();
    // Each file ~100KB; 150 of them = ~15MB > MAX_SKILL_BYTES (10MB).
    // Use .md so the allowlist passes.
    const big = 'a'.repeat(100_000);
    const siblings: Record<string, string> = {};
    for (let i = 0; i < 150; i++) {
      siblings[`docs/big-${String(i).padStart(3, '0')}.md`] = big;
    }
    writeSkill(solutionDir, 'manifest-editor', { siblings });

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/*'] }),
      { solutionDir },
    );

    const createDto = skills.create.mock.calls[0][1];
    const totalBytes = createDto.files.reduce(
      (sum: number, f: any) => sum + Buffer.byteLength(f.content, 'utf8'),
      0,
    );
    expect(totalBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/byte aggregate cap|-file cap/),
    );
  });

  // ----- Happy-path smoke (regression guard) ------------------------------

  it('imports a well-formed skill with allow-listed sibling files', async () => {
    const solutionDir = tmpSolution();
    writeSkill(solutionDir, 'manifest-editor', {
      siblings: {
        'tools/overview.md': '# overview',
        'examples/add-quiz.md': '# example',
        'scripts/lint.sh': '#!/bin/sh',
      },
    });

    await loader.importFromConfig(
      makeConfig({ skills: ['skills/*'] }),
      { solutionDir },
    );

    expect(skills.create).toHaveBeenCalledTimes(1);
    const [, dto] = skills.create.mock.calls[0];
    expect(dto.slug).toBe('manifest-editor');
    expect(dto.files.map((f: any) => f.relativePath).sort()).toEqual([
      'examples/add-quiz.md',
      'scripts/lint.sh',
      'tools/overview.md',
    ]);
  });
});
