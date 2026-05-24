#!/usr/bin/env bash
# Linux V1 validation runner (host side).
#
# Builds the validation image once, then runs three configurations:
#   patched-bare           our 9180ed4 fork + VFS_POC_BARE=1
#   upstream-bare          upstream agentfs v0.6.4 + VFS_POC_BARE=1
#   upstream-workaround    upstream v0.6.4 + .gitignore/cleanAppleDoubles workaround
#
# Output: /tmp/vfs-poc-linux-results/v1-linux-<config>.{json,log}
#
# Requires: docker (or compatible runtime; OrbStack tested), /dev/fuse,
# and `--privileged` permission. Mounts source from
#   ~/Documents/GitHub/agentfs              (read-only)
#   ~/Documents/GitHub/kedge-ccaas          (read-only)
# and a cargo target cache from ~/.cache/vfs-poc-linux/cargo-target.
set -euo pipefail

# --- locations ---------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VFS_POC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$VFS_POC_DIR/docker"

AGENTFS_SRC="${AGENTFS_SRC:-$HOME/Documents/GitHub/agentfs}"
CCAAS_SRC="${CCAAS_SRC:-$HOME/Documents/GitHub/kedge-ccaas}"
RESULTS_DIR="${RESULTS_DIR:-/tmp/vfs-poc-linux-results}"
CARGO_CACHE="${CARGO_CACHE:-$HOME/.cache/vfs-poc-linux/cargo-target}"
IMAGE_TAG="${IMAGE_TAG:-vfs-poc-v1-linux:latest}"

# --- preflight ---------------------------------------------------------------
for path in "$AGENTFS_SRC/cli/Cargo.toml" "$CCAAS_SRC/packages/vfs-poc/package.json"; do
  [[ -f "$path" ]] || { echo "ERROR: missing $path" >&2; exit 1; }
done
mkdir -p "$RESULTS_DIR" "$CARGO_CACHE"

# --- build image -------------------------------------------------------------
echo "==> docker build $IMAGE_TAG"
docker build -t "$IMAGE_TAG" "$DOCKER_DIR"

# --- helpers ----------------------------------------------------------------
run_config() {
  local config="$1"
  echo
  echo "================================================================"
  echo "  CONFIG: $config"
  echo "================================================================"
  docker run --rm \
    --privileged \
    --device /dev/fuse \
    -e CONFIG="$config" \
    -v "$AGENTFS_SRC:/agentfs-src:ro" \
    -v "$CCAAS_SRC:/ccaas:ro" \
    -v "$RESULTS_DIR:/results" \
    -v "$CARGO_CACHE:/cargo-target" \
    "$IMAGE_TAG"
}

# --- run matrix --------------------------------------------------------------
if [[ $# -gt 0 ]]; then
  CONFIGS=("$@")
else
  CONFIGS=(patched-bare upstream-bare upstream-workaround)
fi
for cfg in "${CONFIGS[@]}"; do
  run_config "$cfg"
done

# --- summary -----------------------------------------------------------------
echo
echo "================================================================"
echo "  Summary"
echo "================================================================"
for cfg in "${CONFIGS[@]}"; do
  json="$RESULTS_DIR/v1-linux-$cfg.json"
  if [[ -f "$json" ]]; then
    pass=$(jq '[.tests[] | select(.status=="pass")] | length' "$json" 2>/dev/null || echo "?")
    fail=$(jq '[.tests[] | select(.status=="fail")] | length' "$json" 2>/dev/null || echo "?")
    skip=$(jq '[.tests[] | select(.status=="skip")] | length' "$json" 2>/dev/null || echo "?")
    afsver=$(jq -r '.versions.agentfs' "$json" 2>/dev/null || echo "?")
    printf "  %-22s pass=%s fail=%s skip=%s  [%s]\n" "$cfg" "$pass" "$fail" "$skip" "$afsver"
  else
    printf "  %-22s NO RESULT JSON (see log)\n" "$cfg"
  fi
done
echo
echo "Results dir: $RESULTS_DIR"
