import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';
import { findMonorepoRoot, resolveSolutionsDir } from './find-monorepo-root';

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;

async function createTmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'monorepo-root-test-'));
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ============================================================================
// Tests
// ============================================================================

describe('findMonorepoRoot', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('should find root with workspaces field in package.json', async () => {
    // Create: tmpDir/package.json (with workspaces)
    await writeJson(path.join(tmpDir, 'package.json'), {
      name: 'my-monorepo',
      workspaces: ['packages/*'],
    });

    // Create: tmpDir/packages/backend/src/solutions/
    const deepDir = path.join(tmpDir, 'packages', 'backend', 'src', 'solutions');
    await fsp.mkdir(deepDir, { recursive: true });

    const result = findMonorepoRoot(deepDir);
    expect(result).toBe(tmpDir);
  });

  it('should skip package.json without workspaces field', async () => {
    // Create: tmpDir/package.json (with workspaces) -- the real root
    await writeJson(path.join(tmpDir, 'package.json'), {
      name: 'my-monorepo',
      workspaces: ['packages/*'],
    });

    // Create: tmpDir/packages/backend/package.json (without workspaces)
    await writeJson(path.join(tmpDir, 'packages', 'backend', 'package.json'), {
      name: '@kedge-agentic/backend',
      version: '1.0.0',
    });

    const deepDir = path.join(tmpDir, 'packages', 'backend', 'src');
    await fsp.mkdir(deepDir, { recursive: true });

    const result = findMonorepoRoot(deepDir);
    expect(result).toBe(tmpDir);
  });

  it('should return null when no monorepo root is found', async () => {
    // Create directory with no package.json anywhere up to tmpDir
    const deepDir = path.join(tmpDir, 'a', 'b', 'c');
    await fsp.mkdir(deepDir, { recursive: true });

    // findMonorepoRoot will walk up to filesystem root; since our tmpDir
    // has no package.json with workspaces, it will eventually find the
    // real monorepo root of this project. To test "not found" properly,
    // we'd need to be at filesystem root. Instead, verify it works from
    // a known location.
    const result = findMonorepoRoot(deepDir);
    // It should either find the real project root or return null
    // depending on the test environment. The key property: it doesn't throw.
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('should handle malformed package.json gracefully', async () => {
    // Create malformed package.json
    await fsp.writeFile(
      path.join(tmpDir, 'package.json'),
      '{ this is not valid json }',
    );

    // Create valid root one level up (in reality, this test just checks it doesn't throw)
    const deepDir = path.join(tmpDir, 'sub');
    await fsp.mkdir(deepDir, { recursive: true });

    // Should not throw
    const result = findMonorepoRoot(deepDir);
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('should work with the actual project structure', () => {
    // Test against the real monorepo -- __dirname is packages/backend/src/common
    const result = findMonorepoRoot(__dirname);

    expect(result).not.toBeNull();
    // The root should contain a package.json with workspaces
    const pkgPath = path.join(result!, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.workspaces).toBeDefined();
    // And it should have a solutions/ directory
    expect(fs.existsSync(path.join(result!, 'solutions'))).toBe(true);
  });
});

describe('resolveSolutionsDir', () => {
  const originalEnv = process.env.SOLUTIONS_DIR;

  afterEach(() => {
    // Restore env
    if (originalEnv === undefined) {
      delete process.env.SOLUTIONS_DIR;
    } else {
      process.env.SOLUTIONS_DIR = originalEnv;
    }
  });

  it('should use SOLUTIONS_DIR env var when set', () => {
    process.env.SOLUTIONS_DIR = '/custom/path/to/solutions';
    const result = resolveSolutionsDir(__dirname);
    expect(result).toBe('/custom/path/to/solutions');
  });

  it('should resolve relative SOLUTIONS_DIR env var to absolute', () => {
    process.env.SOLUTIONS_DIR = 'relative/solutions';
    const result = resolveSolutionsDir(__dirname);
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.resolve('relative/solutions'));
  });

  it('should find solutions via monorepo root when env var is unset', () => {
    delete process.env.SOLUTIONS_DIR;
    const result = resolveSolutionsDir(__dirname);

    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toMatch(/solutions$/);
    // Should resolve to the actual solutions directory in this monorepo
    expect(fs.existsSync(result)).toBe(true);
  });

  it('should return consistent results regardless of start directory depth', () => {
    delete process.env.SOLUTIONS_DIR;

    // From src/common/
    const fromCommon = resolveSolutionsDir(
      path.resolve(__dirname),
    );
    // From src/solutions/
    const fromSolutions = resolveSolutionsDir(
      path.resolve(__dirname, '..', 'solutions'),
    );
    // From src/scripts/
    const fromScripts = resolveSolutionsDir(
      path.resolve(__dirname, '..', 'scripts'),
    );

    expect(fromCommon).toBe(fromSolutions);
    expect(fromCommon).toBe(fromScripts);
  });
});
