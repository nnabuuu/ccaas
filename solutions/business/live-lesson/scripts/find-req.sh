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
# workspace under a per-subject layout:
#   artifacts/_lib/teaching-requirements/<subject>.md
#   artifacts/_lib/my-interpretations/<subject>.md
# (one file per subject the project covers — see
#  docs/lesson-plan-format-design.md §4.1 for the layout).
#
# If bash isn't available (remote agent environments), use Grep -r on
# those directories directly — see skills/lesson-plan-editor/SKILL.md
# for the manual workflow.

set -euo pipefail

LIB_DIR="artifacts/_lib/teaching-requirements"
INTERP_DIR="artifacts/_lib/my-interpretations"

if [ "$#" -lt 1 ]; then
  echo "usage: bash scripts/find-req.sh <keyword-or-id>" >&2
  exit 1
fi

QUERY="$1"

if [ ! -d "$LIB_DIR" ]; then
  echo "error: $LIB_DIR/ not found. Run from the agent workspace root." >&2
  echo "       Library is materialized by ccaas at session start;" >&2
  echo "       its absence means the project has no subjects configured" >&2
  echo "       or materialization didn't run." >&2
  exit 2
fi

# Collect every library file (one per subject). nullglob makes an empty
# glob expand to nothing (instead of the literal pattern). Belt-and-
# -suspenders: also verify the first element actually exists in case
# shopt silently failed on an exotic shell.
shopt -s nullglob 2>/dev/null || true
LIB_FILES=("$LIB_DIR"/*.md)
if [ "${#LIB_FILES[@]}" -eq 0 ] || [ ! -e "${LIB_FILES[0]}" ]; then
  echo "error: no library files under $LIB_DIR/" >&2
  echo "       project may have empty subjects config." >&2
  exit 2
fi

# Match against both id (### r-X.Y.Z) and text lines across every
# subject's library file. The library file's format (per the renderer):
#
#   ## <category label> (<category id>)
#
#   ### <reqId> — <code>
#   <text>
#
# We grep the id line + the next line so a keyword search picks up
# either the id or the text. `-h` suppresses filename prefix; we
# extract the id from the heading line and re-find the subject from
# the matching file in the per-id loop below.

matches=$(grep -h -B 0 -A 1 -i -- "$QUERY" "${LIB_FILES[@]}" 2>/dev/null \
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
  # Find which subject file holds the canonical heading for this id,
  # then extract text + code from there. Subjects don't collide on ids
  # by convention but if they do we surface every hit.
  for lib_file in "${LIB_FILES[@]}"; do
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
    ' "$lib_file"
  done

  # If the user has an interpretation for this id in any subject's
  # interp file, append it as comments. Collect across all subject
  # files first, then print the header at most once — without this
  # dedupe, cross-subject reqId collisions (rare; ids namespace by
  # convention) would print "# 你的解读" multiple times per id.
  if [ -d "$INTERP_DIR" ]; then
    INTERP_FILES=("$INTERP_DIR"/*.md)
    if [ "${#INTERP_FILES[@]}" -gt 0 ] && [ -e "${INTERP_FILES[0]}" ]; then
      all_interps=""
      for interp_file in "${INTERP_FILES[@]}"; do
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
        ' "$interp_file" | sed -E '/^[[:space:]]*$/d')
        if [ -n "$interpretation" ]; then
          all_interps="${all_interps}${interpretation}"$'\n'
        fi
      done

      if [ -n "$all_interps" ]; then
        printf '\n'
        printf '# 你的解读 (来自当前 user):\n'
        # printf instead of echo: macOS bash 3.2's `echo` mishandles
        # backslash sequences if the interpretation happens to contain
        # any. Safe even when L2 content includes unusual chars.
        printf '%s' "$all_interps" | sed 's/^/# > /'
      fi
    fi
  fi
  printf '\n'
done
