#!/usr/bin/env bash
# Container-side runner for one Linux V1 validation configuration.
#
# Usage (set CONFIG env var):
#   CONFIG=patched-bare              ours, no app-layer workaround
#   CONFIG=upstream-bare             upstream v0.6.4, no app-layer workaround
#   CONFIG=upstream-workaround       upstream v0.6.4, with macOS-style workarounds
#
# Mounts expected (read-only):
#   /agentfs-src   ← host ~/Documents/GitHub/agentfs       (for patched build)
#   /ccaas         ← host ~/Documents/GitHub/kedge-ccaas
# Mounts expected (writable):
#   /results       ← host /tmp/vfs-poc-linux-results
#   /cargo-target  ← host ~/.cache/vfs-poc-linux/cargo-target (build cache, optional)
#
# Output: /results/v1-linux-<CONFIG>.json + log.

set -euo pipefail

CONFIG="${CONFIG:?CONFIG env var must be set}"
case "$CONFIG" in
  patched-bare|upstream-bare|upstream-workaround) ;;
  *) echo "unknown CONFIG=$CONFIG"; exit 2 ;;
esac

LOG="/results/v1-linux-${CONFIG}.log"
mkdir -p /results
echo "==> entrypoint config=$CONFIG host=$(uname -a)" | tee "$LOG"

# --- 1. install / build agentfs ----------------------------------------------

install_upstream_agentfs() {
  echo "==> installing upstream agentfs v0.6.4 via curl installer" | tee -a "$LOG"
  curl -fsSL https://github.com/tursodatabase/agentfs/releases/latest/download/agentfs-installer.sh \
    | sh 2>&1 | tee -a "$LOG"
  # the installer drops binaries in $HOME/.cargo/bin which is already on PATH
  cp "$HOME/.cargo/bin/agentfs" /usr/local/bin/agentfs
  agentfs --version | tee -a "$LOG"
}

build_patched_agentfs() {
  echo "==> building patched agentfs from /agentfs-src" | tee -a "$LOG"
  if [[ ! -d /agentfs-src/cli ]]; then
    echo "ERROR: /agentfs-src/cli not mounted" | tee -a "$LOG"
    exit 1
  fi
  # Copy into rw scratch (cargo wants to write rust-toolchain triggers etc.)
  # but keep the build target dir as a separately-mounted volume for cache.
  cp -r /agentfs-src /tmp/agentfs-build
  cd /tmp/agentfs-build/cli
  # Wire target dir to host-volume cache if mounted.
  if [[ -d /cargo-target ]]; then
    export CARGO_TARGET_DIR=/cargo-target
    echo "==> using cargo target cache at $CARGO_TARGET_DIR" | tee -a "$LOG"
  fi
  cargo build --release 2>&1 | tail -10 | tee -a "$LOG"
  local BIN_PATH="${CARGO_TARGET_DIR:-target}/release/agentfs"
  cp "$BIN_PATH" /usr/local/bin/agentfs
  agentfs --version | tee -a "$LOG"
}

case "$CONFIG" in
  patched-bare)            build_patched_agentfs ;;
  upstream-bare|upstream-workaround) install_upstream_agentfs ;;
esac

# --- 2. install vfs-poc + run V1 --------------------------------------------

# Work in a writable copy of vfs-poc so npm install can drop node_modules.
mkdir -p /tmp/vfs-poc-run
cp -r /ccaas/packages/vfs-poc/. /tmp/vfs-poc-run/
cd /tmp/vfs-poc-run

echo "==> npm install" | tee -a "$LOG"
npm install --no-audit --no-fund 2>&1 | tail -8 | tee -a "$LOG"

# Bare mode flag.
case "$CONFIG" in
  *-bare)         export VFS_POC_BARE=1 ;;
  *-workaround)   unset VFS_POC_BARE   ;;
esac
echo "==> VFS_POC_BARE='${VFS_POC_BARE:-unset}'" | tee -a "$LOG"

echo "==> running V1 suite" | tee -a "$LOG"
# Don't `set -e` around this — V1 may legitimately have test failures
# that we want to capture into the JSON, not die on.
set +e
npm run validate:v1 2>&1 | tee -a "$LOG"
NPMEXIT=$?
set -e
echo "==> validate:v1 exit=$NPMEXIT" | tee -a "$LOG"

# Copy results JSON to /results with a config-tagged name.
if [[ -f /tmp/vfs-poc-run/validation/results/v1-linux.json ]]; then
  cp /tmp/vfs-poc-run/validation/results/v1-linux.json "/results/v1-linux-${CONFIG}.json"
else
  echo "WARN: results JSON not found at v1-linux.json" | tee -a "$LOG"
fi

echo "==> done config=$CONFIG" | tee -a "$LOG"
