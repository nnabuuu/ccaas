import { spawn, type ChildProcess, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { platform } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

export interface MountHandle {
  mountPoint: string;
  /** Unmount and stop the mount daemon. Idempotent. */
  unmount(): Promise<void>;
}

/**
 * Mount an agentfs delta+base overlay at `mountPoint`.
 * macOS → NFS (agentfs starts a localhost NFS server + mount_nfs).
 * Linux → FUSE.
 * Caller is responsible for running `agentfs init` first.
 */
export async function mountAgentfs(opts: {
  agentId: string;
  /** Working dir where `.agentfs/{agentId}.db` lives. */
  cwd: string;
  mountPoint: string;
  agentfsBin?: string;
}): Promise<MountHandle> {
  const { agentId, cwd, mountPoint } = opts;
  const bin = opts.agentfsBin ?? 'agentfs';

  if (!existsSync(mountPoint)) mkdirSync(mountPoint, { recursive: true });

  // `agentfs mount -f` runs in foreground; we keep the child alive for the
  // lifetime of the handle and rely on the OS unmount on `unmount()` to make
  // the daemon exit cleanly.
  const child: ChildProcess = spawn(
    bin,
    ['mount', '-f', '-a', agentId, mountPoint],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  child.stdout?.on('data', (b) => process.stderr.write(`[afs ${agentId}] ${b}`));
  child.stderr?.on('data', (b) => process.stderr.write(`[afs ${agentId}] ${b}`));

  // Wait until the kernel actually sees the mount (NFS handshake takes ~100-500ms).
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (isMounted(mountPoint)) break;
    if (child.exitCode !== null) {
      throw new Error(`agentfs mount exited prematurely with code ${child.exitCode}`);
    }
    await wait(100);
  }
  if (!isMounted(mountPoint)) {
    child.kill('SIGTERM');
    throw new Error(`agentfs mount at ${mountPoint} did not appear within 10s`);
  }

  let unmounted = false;
  return {
    mountPoint,
    async unmount() {
      if (unmounted) return;
      unmounted = true;
      try {
        // macOS NFS + Linux FUSE both accept plain `umount <mountpoint>`.
        execFileSync('umount', [mountPoint], { stdio: 'ignore' });
      } catch {
        // Fallback for macOS when umount complains about busy resources.
        if (platform() === 'darwin') {
          try {
            execFileSync('diskutil', ['unmount', 'force', mountPoint], { stdio: 'ignore' });
          } catch {}
        }
      }
      // Give the daemon a moment to notice, then kill if still alive.
      await wait(200);
      if (child.exitCode === null) child.kill('SIGTERM');
      await wait(100);
      if (child.exitCode === null) child.kill('SIGKILL');
    },
  };
}

export function isMounted(mountPoint: string): boolean {
  try {
    const out = execFileSync('mount', [], { encoding: 'utf8' });
    // Resolve symlinks (e.g. /tmp -> /private/tmp on macOS) by checking both raw and known prefix.
    return out.includes(mountPoint) || out.includes(`/private${mountPoint}`);
  } catch {
    return false;
  }
}
