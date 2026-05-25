/**
 * AgentfsWorkspaceProvider — virtual FS per session via the agentfs binary.
 *
 * Architecture (design source: packages/vfs-poc/docs/ARCHITECTURE.md +
 * docs/WORKSPACE_PROVIDER.md):
 *   - One shared base dir (materialized once at startup by BaseMaterializer)
 *     hosts read-only skills + mcp-servers content for all tenants.
 *   - Each session gets:
 *       delta db at  ${WORKSPACE_DIR}/_agentfs_deltas/{sessionId}.db (+wal/+shm)
 *       mount point  ${WORKSPACE_DIR}/sessions/{sessionId}/         ← claude's cwd
 *   - On macOS the mount is NFS (localhost), on Linux it's FUSE.
 *
 * Concurrency: per-sessionId Map<Promise> dedup, so two concurrent
 * `create()` calls for the same id share the same agentfs subprocess
 * pipeline (avoids the `agentfs init --force` race documented in
 * WORKSPACE_PROVIDER.md sanity check B).
 *
 * Restart resilience: `onModuleInit` unmounts any stale agentfs mounts
 * left over under `${WORKSPACE_DIR}/sessions/` from a previous backend
 * process (sanity check R3). Also fail-fast if the binary is missing
 * and this provider is the active one (R7).
 */

import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

import { BaseMaterializer } from './base-materializer';
import type {
  CreateOpts, WorkspaceCapabilities, WorkspaceHandle, WorkspaceProvider,
  FsDiffEntry, FsTimelineEntry, TimelineOpts,
} from './types';

const execFileAsync = promisify(execFile);

/** SQLite WAL means snapshots/rollbacks must copy these three files as a unit. */
const SQLITE_SIDECARS = ['', '-wal', '-shm'] as const;

const DEFAULT_SETTINGS = {
  permissions: {
    allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
    deny: [],
  },
  enabledPlugins: {},
};

interface MountDaemon {
  mountPoint: string;
  child: ChildProcess;
}

@Injectable()
export class AgentfsWorkspaceProvider implements WorkspaceProvider {
  private readonly logger = new Logger(AgentfsWorkspaceProvider.name);
  private readonly workspaceRoot: string;
  private readonly binPath: string;
  private readonly baseDir: string;
  private readonly deltaStore: string;
  private readonly mountRoot: string;

  /** Per-session create() dedup — see sanity check B. */
  private readonly inFlight = new Map<string, Promise<WorkspaceHandle>>();
  /** Live mount daemons keyed by sessionId, so close()/destroy() can stop them. */
  private readonly daemons = new Map<string, MountDaemon>();

  constructor(
    @Inject(ConfigService) private readonly cfg: ConfigService,
    @Inject(BaseMaterializer) private readonly baseMaterializer: BaseMaterializer,
  ) {
    this.workspaceRoot = path.resolve(this.cfg.get<string>('workspace.dir', '.agent-workspace'));
    this.binPath = this.cfg.get<string>('workspace.agentfs.binPath', 'agentfs');
    this.baseDir = this.cfg.get<string>('workspace.agentfs.baseDir', '')
      || path.join(this.workspaceRoot, '_agentfs_base');
    this.deltaStore = this.cfg.get<string>('workspace.agentfs.deltaStore', '')
      || path.join(this.workspaceRoot, '_agentfs_deltas');
    this.mountRoot = path.join(this.workspaceRoot, 'sessions');
  }

  async onModuleInit(): Promise<void> {
    const active = this.cfg.get<string>('workspace.provider', 'local') === 'agentfs';
    if (!active) return;

    // 1. sanity-check the binary exists + reports a version. Fail fast if not.
    try {
      const { stdout } = await execFileAsync(this.binPath, ['--version']);
      this.logger.log(`agentfs binary OK: ${stdout.trim()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `WORKSPACE_PROVIDER=agentfs but binary '${this.binPath}' is not invokable: ${msg}`,
      );
    }

    // 2. materialize the base. Cheap if unchanged (sha1 diff).
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.deltaStore, { recursive: true });
    fs.mkdirSync(this.mountRoot, { recursive: true });
    await this.baseMaterializer.materialize();

    // 3. clean up any stale mounts left under sessions/ by a previous
    //    backend process (sanity check R3 / WORKSPACE_PROVIDER.md).
    await this.unmountStale();
  }

  private async unmountStale(): Promise<void> {
    try {
      const mountOutput = execFileSync('mount', [], { encoding: 'utf8' });
      const lines = mountOutput.split('\n');
      const ourPrefix = this.mountRoot;
      // macOS resolves /tmp → /private/tmp etc; check both.
      const altPrefix = `/private${this.mountRoot}`;
      let cleaned = 0;
      for (const line of lines) {
        // macOS mount output: `127.0.0.1:/ on /private/tmp/foo (nfs, ...)`
        // Linux  mount output: `agentfs on /tmp/foo type fuse.agentfs (...)`
        // Capture greedily up to ` (` or ` type ` so paths with spaces work.
        const m = line.match(/^.*?\son\s(.+?)\s(?:type\s|\()/);
        if (!m) continue;
        const mp = m[1];
        if (!mp.startsWith(ourPrefix) && !mp.startsWith(altPrefix)) continue;
        try {
          execFileSync('umount', [mp], { stdio: 'ignore' });
          cleaned++;
        } catch {
          if (os.platform() === 'darwin') {
            try {
              execFileSync('diskutil', ['unmount', 'force', mp], { stdio: 'ignore' });
              cleaned++;
            } catch {}
          }
        }
      }
      if (cleaned > 0) this.logger.warn(`Unmounted ${cleaned} stale agentfs mount(s) at startup`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`stale-mount scan failed (non-fatal): ${msg}`);
    }
  }

  async create(opts: CreateOpts): Promise<WorkspaceHandle> {
    const existing = this.inFlight.get(opts.sessionId);
    if (existing) return existing;
    const promise = this._doCreate(opts).finally(() => {
      this.inFlight.delete(opts.sessionId);
    });
    this.inFlight.set(opts.sessionId, promise);
    return promise;
  }

  private async _doCreate(opts: CreateOpts): Promise<WorkspaceHandle> {
    const { sessionId } = opts;
    const mountPoint = path.join(this.mountRoot, sessionId);
    const sessionScratch = path.join(this.deltaStore, sessionId);

    // 1. agentfs init places the delta at `<cwd>/.agentfs/<id>.db`. Use a
    //    per-session scratch dir so deltas all land under deltaStore.
    fs.mkdirSync(sessionScratch, { recursive: true });
    await execFileAsync(
      this.binPath,
      ['init', sessionId, '--base', this.baseDir, '--force'],
      { cwd: sessionScratch },
    );

    // 2. mount the overlay at the standard session path. Daemon stays alive
    //    for the session's lifetime; we hold its handle in this.daemons.
    //    Register the daemon entry IMMEDIATELY after spawn-success so that if
    //    a later step in this method throws, close()/shutdown can still find
    //    and stop the daemon (avoids leaked mounts).
    fs.mkdirSync(mountPoint, { recursive: true });
    const daemon = await this.spawnMountDaemon(sessionId, sessionScratch, mountPoint);
    this.daemons.set(sessionId, daemon);

    try {
      // 3. write the same .claude scaffolding LocalProvider writes, so
      //    consumers see identical content regardless of provider.
      const claudeDir = path.join(mountPoint, '.claude');
      fs.mkdirSync(path.join(claudeDir, 'mcp-servers'), { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, 'settings.local.json'),
        JSON.stringify(DEFAULT_SETTINGS, null, 2),
      );
    } catch (err) {
      // Roll back the mount if scaffolding fails — otherwise caller never
      // gets a handle and the daemon hangs around.
      this.logger.warn(`agentfs scaffold failed for ${sessionId}, unmounting: ${err}`);
      await this.close(sessionId);
      throw err;
    }

    // MCP setup is intentionally NOT done here. SessionService.createMcpSymlinks
    // (called by the gateway once session.mcpServers is wired) operates on
    // session.workspaceDir = handle.path = mount point. agentfs SPEC supports
    // symlinks (fs_symlink table); targets are host-fs absolute paths that
    // resolve at access time via the kernel. Validated in vfs-poc.

    this.logger.log(`session ${sessionId} mounted at ${mountPoint} (delta: ${this.deltaDbPath(sessionId)})`);
    return {
      sessionId,
      path: mountPoint,
      snapshot: (label) => this.snapshot(sessionId, label),
      rollback: (label) => this.rollback(sessionId, label),
      diff: () => this.diff(sessionId),
      timeline: (opts) => this.timeline(sessionId, opts),
    };
  }

  private async spawnMountDaemon(
    sessionId: string,
    cwd: string,
    mountPoint: string,
  ): Promise<MountDaemon> {
    const child = spawn(
      this.binPath,
      ['mount', '-f', '-a', sessionId, mountPoint],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.stdout?.on('data', (b: Buffer) =>
      this.logger.debug(`[afs ${sessionId}] ${b.toString().trim()}`));
    child.stderr?.on('data', (b: Buffer) =>
      this.logger.debug(`[afs ${sessionId}] ${b.toString().trim()}`));

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (this.isMounted(mountPoint)) return { mountPoint, child };
      if (child.exitCode !== null) {
        throw new Error(`agentfs mount for ${sessionId} exited prematurely with code ${child.exitCode}`);
      }
      await wait(100);
    }
    child.kill('SIGTERM');
    throw new Error(`agentfs mount at ${mountPoint} did not appear within 10s`);
  }

  async close(sessionId: string): Promise<void> {
    const daemon = this.daemons.get(sessionId);
    if (!daemon) return;
    this.daemons.delete(sessionId);
    await this.stopDaemon(daemon);
  }

  async destroy(sessionId: string): Promise<void> {
    await this.close(sessionId);
    // Remove the delta db (+wal +shm), mount-point dir, and scratch dir.
    const deltaBase = this.deltaDbPath(sessionId);
    for (const ext of SQLITE_SIDECARS) {
      try { fs.unlinkSync(deltaBase + ext); } catch {}
    }
    try { fs.rmSync(path.join(this.mountRoot, sessionId), { recursive: true, force: true }); } catch {}
    try { fs.rmSync(path.join(this.deltaStore, sessionId), { recursive: true, force: true }); } catch {}
    this.logger.log(`destroyed agentfs session ${sessionId}`);
  }

  capabilities(): WorkspaceCapabilities {
    return { snapshot: true, multiMount: false, fastClone: false, observability: true };
  }

  /**
   * Read-only inspection of what the agent has written into the delta vs
   * the immutable base. Implementation: copy the SQLite delta (+ WAL
   * sidecars) to a temp dir, run `agentfs diff` against the copy, parse
   * the text output, clean up.
   *
   * Why the copy: the FUSE/NFS daemon holds an exclusive lock on the
   * live delta, so `agentfs diff <live-path>` errors with "Locking
   * error". A simple cp during a live session captures a near-real-time
   * view (last few WAL pages may be missing, accepted for an
   * observability read).
   *
   * Output format (text, one line per change):
   *   A d /.claude                           ← added directory
   *   A f /.claude/settings.local.json       ← added file
   *   M f /entities/customers/initech.md     ← modified file
   *   D f /resources/stale.md                ← removed file
   */
  async diff(sessionId: string): Promise<FsDiffEntry[]> {
    return this.withReadonlyDeltaCopy(sessionId, async (dbPath) => {
      const { stdout } = await execFileAsync(this.binPath, ['diff', dbPath]);
      return this.parseDiffOutput(stdout, sessionId);
    });
  }

  async timeline(sessionId: string, opts?: TimelineOpts): Promise<FsTimelineEntry[]> {
    return this.withReadonlyDeltaCopy(sessionId, async (dbPath) => {
      const args = ['timeline', '--format', 'json', dbPath];
      if (opts?.limit) args.splice(2, 0, '--limit', String(opts.limit));
      if (opts?.filter) args.splice(2, 0, '--filter', opts.filter);
      if (opts?.status) args.splice(2, 0, '--status', opts.status);
      const { stdout } = await execFileAsync(this.binPath, args);
      const trimmed = stdout.trim();
      if (!trimmed) return [];
      try {
        return JSON.parse(trimmed) as FsTimelineEntry[];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`agentfs timeline returned non-JSON: ${msg}; first 200 chars: ${trimmed.slice(0, 200)}`);
      }
    });
  }

  /**
   * Copy delta DB + sidecars to a tmpdir, hand the copy path to `fn`,
   * always clean up. Intended for read-only queries (`agentfs diff` /
   * `timeline`) against a live FUSE-held delta. For write operations
   * use `snapshot`/`rollback` which cycle the daemon for strong
   * consistency.
   *
   * Consistency contract — **eventual / best-effort**:
   *   - Three separate `cp` syscalls hold no SQLite lock. If the daemon
   *     commits a checkpoint between copying `.db` and `-wal`, the
   *     resulting triple can be internally inconsistent.
   *   - Copy order matters: `.db` first, then `.db-shm`, THEN `.db-wal`.
   *     This is the SQLite-recommended order for live backup-by-cp,
   *     because the -wal references pages in .db; opening with a -wal
   *     newer than .db triggers SQLite's recovery path, which is
   *     forgiving. The reverse order can leave the reader with a -wal
   *     pointing at pages that don't exist yet in .db → ERROR.
   *   - Worst-case impact: `agentfs diff/timeline` errors or returns
   *     empty. NO data leak (read-only operation against the agent's
   *     own sandbox), bad UX visible to operators who can retry.
   *
   * Future-proof fix (stage-2): replace with better-sqlite3's online
   * `db.backup(dest)` which holds shared locks across pages for
   * guaranteed consistency.
   */
  private async withReadonlyDeltaCopy<T>(
    sessionId: string,
    fn: (dbPath: string) => Promise<T>,
  ): Promise<T> {
    const liveBase = this.deltaDbPath(sessionId);
    if (!fs.existsSync(liveBase)) {
      throw new Error(`no delta db at ${liveBase} — session may have been destroyed`);
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentfs-ro-'));
    try {
      const copyBase = path.join(tmpDir, `${sessionId}.db`);
      // .db first → .db-shm next → .db-wal LAST.
      // (Reverse order can cause "WAL frame past end of DB" errors.)
      const RO_COPY_ORDER = ['', '-shm', '-wal'] as const;
      for (const ext of RO_COPY_ORDER) {
        const src = liveBase + ext;
        if (fs.existsSync(src)) fs.copyFileSync(src, copyBase + ext);
      }
      return await fn(copyBase);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  /** Snapshot the WAL set (pattern validated in vfs-poc v2). Returns the snapshot path. */
  async snapshot(sessionId: string, label: string): Promise<string> {
    const daemon = this.daemons.get(sessionId);
    if (!daemon) throw new Error(`snapshot: no live session ${sessionId}`);
    const sessionScratch = path.join(this.deltaStore, sessionId);
    const deltaBase = this.deltaDbPath(sessionId);
    const snapDir = path.join(sessionScratch, 'snapshots');
    fs.mkdirSync(snapDir, { recursive: true });
    const snapBase = path.join(snapDir, `${label}.db`);

    // Cycle the mount so the daemon flushes WAL before we copy.
    await this.stopDaemon(daemon);
    this.daemons.delete(sessionId);
    this.copyDbSet(deltaBase, snapBase);
    const fresh = await this.spawnMountDaemon(sessionId, sessionScratch, daemon.mountPoint);
    this.daemons.set(sessionId, fresh);
    return snapBase;
  }

  async rollback(sessionId: string, label: string): Promise<void> {
    const daemon = this.daemons.get(sessionId);
    if (!daemon) throw new Error(`rollback: no live session ${sessionId}`);
    const sessionScratch = path.join(this.deltaStore, sessionId);
    const deltaBase = this.deltaDbPath(sessionId);
    const snapBase = path.join(sessionScratch, 'snapshots', `${label}.db`);
    if (!fs.existsSync(snapBase)) throw new Error(`snapshot not found: ${label}`);

    await this.stopDaemon(daemon);
    this.daemons.delete(sessionId);
    // Drop any current sidecar so restored WAL isn't merged with current WAL.
    for (const ext of SQLITE_SIDECARS) {
      const live = deltaBase + ext;
      if (fs.existsSync(live)) try { fs.unlinkSync(live); } catch {}
    }
    this.copyDbSet(snapBase, deltaBase);
    const fresh = await this.spawnMountDaemon(sessionId, sessionScratch, daemon.mountPoint);
    this.daemons.set(sessionId, fresh);
  }

  // ---------- private helpers ----------

  private deltaDbPath(sessionId: string): string {
    return path.join(this.deltaStore, sessionId, '.agentfs', `${sessionId}.db`);
  }

  private async stopDaemon(daemon: MountDaemon): Promise<void> {
    try {
      execFileSync('umount', [daemon.mountPoint], { stdio: 'ignore' });
    } catch {
      if (os.platform() === 'darwin') {
        try { execFileSync('diskutil', ['unmount', 'force', daemon.mountPoint], { stdio: 'ignore' }); } catch {}
      }
    }
    await wait(200);
    if (daemon.child.exitCode === null) daemon.child.kill('SIGTERM');
    await wait(100);
    if (daemon.child.exitCode === null) daemon.child.kill('SIGKILL');
  }

  private isMounted(mountPoint: string): boolean {
    try {
      const out = execFileSync('mount', [], { encoding: 'utf8' });
      return out.includes(mountPoint) || out.includes(`/private${mountPoint}`);
    } catch {
      return false;
    }
  }

  private copyDbSet(srcBase: string, destBase: string): void {
    for (const ext of SQLITE_SIDECARS) {
      const src = srcBase + ext;
      const dest = destBase + ext;
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }
  }

  /**
   * Parse `agentfs diff` text output into structured entries.
   * Skips header lines (`Using agent: ...`, `Base: ...`) and blank lines.
   * Format per change line:
   *   <OP> <TYPE> <PATH>
   *     OP   ∈ {A, M, D}  (added / modified / removed)
   *     TYPE ∈ {f, d}     (file / directory)
   *     PATH = whitespace-separated tail (agentfs paths don't contain newlines)
   *
   * Unrecognized non-header lines are warned (rather than silently dropped)
   * so an upstream agentfs CLI format change is loud, not invisible.
   */
  private parseDiffOutput(stdout: string, sessionId: string): FsDiffEntry[] {
    const OPS: Record<string, FsDiffEntry['op']> = { A: 'added', M: 'modified', D: 'removed' };
    const TYPES: Record<string, FsDiffEntry['type']> = { f: 'file', d: 'directory' };
    const out: FsDiffEntry[] = [];
    const unrecognized: string[] = [];
    for (const raw of stdout.split('\n')) {
      const line = raw.trimEnd();
      if (!line) continue;
      if (line.startsWith('Using agent:') || line.startsWith('Base:')) continue;
      const m = /^([AMD])\s+([fd])\s+(.+)$/.exec(line);
      if (!m) { unrecognized.push(line); continue; }
      out.push({ op: OPS[m[1]], type: TYPES[m[2]], path: m[3] });
    }
    if (unrecognized.length > 0) {
      // Cap the sample so a corrupted multi-MB output doesn't flood the log.
      const sample = unrecognized.slice(0, 3).join(' | ');
      this.logger.warn(
        `agentfs diff for ${sessionId}: ignored ${unrecognized.length} unrecognized line(s) ` +
        `(format may have drifted). Sample: ${sample}`,
      );
    }
    return out;
  }
}
