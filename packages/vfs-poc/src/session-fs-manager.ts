import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, copyFileSync, existsSync, rmSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mountAgentfs, type MountHandle } from './platform/mount.js';

/**
 * agentfs stores delta state in SQLite WAL mode: the bulk of recent writes
 * live in `<id>.db-wal` (and ephemerally `<id>.db-shm`). Snapshot/rollback
 * MUST treat the three files as one unit, otherwise we capture an empty
 * main db and restore nothing.
 */
const SQLITE_SIDECARS = ['', '-wal', '-shm'] as const;

const execFileAsync = promisify(execFile);

export interface SessionFsManagerOptions {
  /** Host base dir, prepared by BaseMaterializer. */
  baseDir: string;
  /**
   * Where session delta .db files live, e.g. `.agent-workspace/sessions/`.
   * Each session gets `<store>/<sessionId>/fs.db` and snapshots under
   * `<store>/<sessionId>/snapshots/`.
   */
  deltaStore: string;
  /** Where mount points live, e.g. `/tmp/vfs-poc/mnt`. */
  mountRoot: string;
  agentfsBin?: string;
}

export interface SessionHandle {
  sessionId: string;
  mountPoint: string;
  deltaPath: string;
  /** Persist current delta state under a label that can be rolled back to. */
  snapshot(label: string): Promise<string>;
  /** Restore delta to a previously taken snapshot. Re-mounts the FS. */
  rollback(label: string): Promise<void>;
  /** Unmount + remove delta + remove mount dir. */
  destroy(): Promise<void>;
}

export class SessionFsManager {
  constructor(private readonly opts: SessionFsManagerOptions) {
    mkdirSync(opts.deltaStore, { recursive: true });
    mkdirSync(opts.mountRoot, { recursive: true });
  }

  async create(sessionId: string): Promise<SessionHandle> {
    const sessionDir = join(this.opts.deltaStore, sessionId);
    const snapshotsDir = join(sessionDir, 'snapshots');
    mkdirSync(snapshotsDir, { recursive: true });

    // agentfs writes the db to `<cwd>/.agentfs/<id>.db`; we want it at a stable
    // per-session path, so we use a per-session cwd.
    await execFileAsync(
      this.bin(),
      [
        'init',
        sessionId,
        '--base',
        resolve(this.opts.baseDir),
        '--force',
      ],
      { cwd: sessionDir },
    );

    const deltaPath = join(sessionDir, '.agentfs', `${sessionId}.db`);
    const mountPoint = join(this.opts.mountRoot, sessionId);

    let mount = await mountAgentfs({
      agentId: sessionId,
      cwd: sessionDir,
      mountPoint,
      agentfsBin: this.bin(),
    });

    const remount = async (): Promise<void> => {
      await mount.unmount();
      mount = await mountAgentfs({
        agentId: sessionId,
        cwd: sessionDir,
        mountPoint,
        agentfsBin: this.bin(),
      });
    };

    return {
      sessionId,
      mountPoint,
      deltaPath,
      snapshot: async (label) => {
        const target = join(snapshotsDir, `${label}.db`);
        // SQLite WAL means we need to copy `.db`, `.db-wal`, and `.db-shm`
        // as one set while the daemon is down (no writers, no readers).
        await mount.unmount();
        copyDbSet(deltaPath, target);
        mount = await mountAgentfs({
          agentId: sessionId,
          cwd: sessionDir,
          mountPoint,
          agentfsBin: this.bin(),
        });
        return target;
      },
      rollback: async (label) => {
        const source = join(snapshotsDir, `${label}.db`);
        if (!existsSync(source)) {
          throw new Error(`snapshot not found: ${label}`);
        }
        await mount.unmount();
        // Remove any sidecar that the snapshot didn't have so we don't merge
        // current WAL with restored main db (would resurrect post-snapshot writes).
        for (const ext of SQLITE_SIDECARS) {
          const live = `${deltaPath}${ext}`;
          if (existsSync(live)) {
            try { unlinkSync(live); } catch {}
          }
        }
        copyDbSet(source, deltaPath);
        await remount();
      },
      destroy: async () => {
        await mount.unmount();
        try {
          rmSync(mountPoint, { recursive: true, force: true });
        } catch {}
        try {
          rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
      },
    };
  }

  private bin(): string {
    return this.opts.agentfsBin ?? 'agentfs';
  }
}

function copyDbSet(srcDb: string, destDb: string): void {
  for (const ext of SQLITE_SIDECARS) {
    const src = `${srcDb}${ext}`;
    const dest = `${destDb}${ext}`;
    if (existsSync(src)) copyFileSync(src, dest);
  }
}
