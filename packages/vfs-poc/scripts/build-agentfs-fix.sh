#!/usr/bin/env bash
# Build and install our patched agentfs over the current agentfs binary.
# Required for V1 to pass on macOS NFS — see ../docs/VALIDATION_REPORT.md
# (v3 revision) for context.
#
# Default branch (feat/nfs-drop-appledouble) carries TWO patches:
#   1. rail44's fix/nfs-write-owner-bypass-mode-check — lets git's loose
#      objects survive the NFS WRITE-after-CREATE-0444 mode check
#      (originally from tursodatabase/agentfs#333)
#   2. Our nfs-drop-appledouble — server-side suppression of macOS
#      AppleDouble `._foo` sidecars (means no app-layer .gitignore /
#      cleanAppleDoubles workaround needed)
#
# Backs up the existing binary to ~/.cargo/bin/agentfs.upstream so you can
# revert with: cp ~/.cargo/bin/agentfs.upstream ~/.cargo/bin/agentfs
#
# Requires: rustup with a nightly toolchain installed.
set -euo pipefail

FORK_URL="${AGENTFS_FORK_URL:-https://github.com/nnabuuu/agentfs.git}"
FORK_BRANCH="${AGENTFS_FORK_BRANCH:-feat/nfs-drop-appledouble}"
WORKDIR="${TMPDIR:-/tmp}/agentfs-fix-build"
TARGET_BIN="$HOME/.cargo/bin/agentfs"
BACKUP_BIN="$HOME/.cargo/bin/agentfs.upstream"

if [ ! -x "$(command -v cargo)" ]; then
  echo "error: cargo not found. install rustup first." >&2
  exit 1
fi

echo "==> cloning $FORK_URL @ $FORK_BRANCH → $WORKDIR"
rm -rf "$WORKDIR"
# Shallow clone for build speed. Override AGENTFS_FORK_URL / AGENTFS_FORK_BRANCH
# env vars to build a different source.
git clone --depth 1 --branch "$FORK_BRANCH" "$FORK_URL" "$WORKDIR"

echo "==> building (release)"
cd "$WORKDIR/cli"
cargo build --release

NEW_BIN="$WORKDIR/cli/target/release/agentfs"
[ -x "$NEW_BIN" ] || { echo "error: build did not produce $NEW_BIN" >&2; exit 1; }

if [ -x "$TARGET_BIN" ] && [ ! -e "$BACKUP_BIN" ]; then
  echo "==> backing up current $TARGET_BIN → $BACKUP_BIN"
  cp "$TARGET_BIN" "$BACKUP_BIN"
fi

echo "==> installing → $TARGET_BIN"
cp "$NEW_BIN" "$TARGET_BIN"

echo "==> sanity"
"$TARGET_BIN" --version

cat <<EOF

Done. To revert to upstream:
  cp $BACKUP_BIN $TARGET_BIN
EOF
