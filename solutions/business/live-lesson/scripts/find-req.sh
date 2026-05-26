#!/usr/bin/env bash
#
# find-req.sh — search the teaching-requirements library + per-user
# interpretations for a keyword or id, print the canonical link
# template ready to paste into lesson-plan.md.
#
# Usage:
#   bash scripts/find-req.sh "<keyword>"     # substring match
#   bash scripts/find-req.sh r-1.2.3         # exact id
#
# Expects the materialized library files to be in the agent's
# workspace:
#   _lib/teaching-requirements.md
#   _lib/my-interpretations.md
#
# If bash isn't available (remote agent environments), use Grep on
# those files directly — see skills/lesson-plan-editor/SKILL.md for
# the manual workflow.

set -euo pipefail

LIB_FILE="_lib/teaching-requirements.md"
INTERP_FILE="_lib/my-interpretations.md"

if [ "$#" -lt 1 ]; then
  echo "usage: bash scripts/find-req.sh <keyword-or-id>" >&2
  exit 1
fi

QUERY="$1"

if [ ! -f "$LIB_FILE" ]; then
  echo "error: $LIB_FILE not found. Run from the agent workspace root." >&2
  echo "       The library is materialized by ccaas at session start;" >&2
  echo "       its absence means materialization didn't run." >&2
  exit 2
fi

# Match against both id (### r-X.Y.Z) and text lines. The library
# file's format (per the materializer's writer):
#
#   ## <category label> (<category id>)
#
#   ### <reqId> — <code>
#   <text>
#
# We grep for the QUERY in the next 2 lines around each `###` block
# so a keyword search picks up either the id or the text.

# Collect matching reqIds. `-B 0 -A 1` to grab the id line + the
# next line (which is the text body). awk extracts the id from the
# heading line.
matches=$(grep -B 0 -A 1 -i -- "$QUERY" "$LIB_FILE" 2>/dev/null \
  | awk '
    /^### / {
      # heading is "### <reqId> — <code>"
      id = $2
      print id
    }
  ' | sort -u)

if [ -z "$matches" ]; then
  echo "no matches for: $QUERY" >&2
  exit 3
fi

for id in $matches; do
  # Find the text + code for this id.
  # `awk` walks the file, when it hits the `### <id> — <code>` heading,
  # it captures the next non-empty line as text.
  awk -v target="$id" '
    /^### / {
      capture = 0
      # `### <id> — <code>`  → fields: ###, id, —, code, (rest)
      cur_id = $2
      cur_code = substr($0, index($0, $4))   # everything from the code on
      if (cur_id == target) capture = 1
      next
    }
    capture && NF > 0 {
      text = $0
      printf("[%s](req://%s \"%s\")\n", text, cur_id, cur_code)
      capture = 0
    }
  ' "$LIB_FILE"

  # If the user has an interpretation, append it as comments.
  if [ -f "$INTERP_FILE" ]; then
    interpretation=$(awk -v target="$id" '
      /^## / {
        # heading is "## <id> — <text>"
        cur_id = $2
        capture = (cur_id == target)
        next
      }
      capture {
        print
      }
      /^---$/ && capture { capture = 0 }
    ' "$INTERP_FILE" | sed -E '/^[[:space:]]*$/d')

    if [ -n "$interpretation" ]; then
      printf '\n'
      printf '# 你的解读 (来自当前 user):\n'
      # printf instead of echo: macOS bash 3.2's `echo` mishandles
      # backslash sequences if the interpretation happens to contain
      # any. Safe even when L2 content includes unusual chars.
      printf '%s\n' "$interpretation" | sed 's/^/# > /'
    fi
  fi
  printf '\n'
done
