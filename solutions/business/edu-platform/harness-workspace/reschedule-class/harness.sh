#!/usr/bin/env bash
set -eu

# ============================================================
# Reschedule-Class Skill + Dynamic Mock MCP — Harness Loop
# ============================================================

# --- Nested Session Guard ---
# Required when harness is launched from inside a Claude Code session.
# env -u is more reliable than unset in sandboxed environments.
claude_safe() {
  env -u CLAUDECODE \
      -u CLAUDE_CODE_ENTRYPOINT \
      -u CLAUDE_CODE_DISABLE_TERMINAL_TITLE \
      -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS \
      claude "$@"
}

# --- Configuration ---
TASK_NAME="reschedule-class"
MAX_ITERATIONS=10
SCORE_THRESHOLD=90
MIN_IMPROVEMENT=3
ROLLBACK_THRESHOLD=5
MAX_COST_USD="${MAX_COST:-150}"

# Agent tool permissions
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Write,Grep,Glob,Bash"

COST_PER_ITERATION=3.00  # estimate: Skill + MCP scope

# E2E configuration
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
CCAAS_BOOTSTRAP_KEY="${CCAAS_BOOTSTRAP_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"
E2E_CONFIG=""  # set by setup_e2e()

# --- Directories ---
REPO_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
SOLUTION_DIR="${REPO_ROOT}/solutions/business/edu-platform"
HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
EVAL_DIR="${HARNESS_DIR}/eval-reports"
CHANGELOG_DIR="${HARNESS_DIR}/changelogs"
PROMPTS_DIR="${HARNESS_DIR}/prompts"
PROGRESS_FILE="${HARNESS_DIR}/progress.md"

# Source directories to track
SOURCE_DIRS=(
  "${SOLUTION_DIR}/skills/reschedule-class"
  "${SOLUTION_DIR}/mcp-server/src"
  "${SOLUTION_DIR}/solution.json"
)

# Frozen paths (must NOT be modified by generator)
FROZEN_PATHS=(
  "solutions/business/edu-platform/backend/"
  "solutions/business/edu-platform/frontend/"
  "packages/"
)

# --- Flags ---
DRY_RUN=false
RESUME=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --resume) RESUME=true ;;
    --max-cost) shift; MAX_COST_USD="$1" ;;
    --max-cost=*) MAX_COST_USD="${arg#*=}" ;;
  esac
done

# --- Functions ---

get_last_version() {
  local last=$(ls "${EVAL_DIR}"/v*-eval.md 2>/dev/null | sort -V | tail -1)
  if [[ -n "$last" ]]; then
    basename "$last" | sed 's/[^0-9]//g'
  else
    echo "0"
  fi
}

extract_score() {
  local eval_file="$1"
  grep -E '(总分|Total)[：:][[:space:]]*[0-9]+' "$eval_file" | head -1 | sed 's/.*[：:][[:space:]]*//' | sed 's|/.*||' | tr -d '[:space:]'
}

estimate_cost() {
  local iterations=$1
  echo "scale=2; $iterations * $COST_PER_ITERATION" | bc
}

append_progress() {
  local version=$1 score=$2 d1=$3 d2=$4 d3=$5 d4=$6 d5=$7 d6=$8 top_issue=$9
  local timestamp=$(date '+%Y-%m-%d %H:%M')
  echo "| v${version} | ${timestamp} | ${score} | ${d1} | ${d2} | ${d3} | ${d4} | ${d5} | ${d6} | ${top_issue} |" >> "$PROGRESS_FILE"
}

append_progress_simple() {
  local version=$1 score=$2 top_issue=$3
  local timestamp=$(date '+%Y-%m-%d %H:%M')
  echo "| v${version} | ${timestamp} | ${score} | - | - | - | - | - | - | ${top_issue} |" >> "$PROGRESS_FILE"
}

check_frozen_files() {
  local violations=0
  cd "$REPO_ROOT"
  for frozen_path in "${FROZEN_PATHS[@]}"; do
    local changed=$(git diff --name-only | grep "^${frozen_path}" 2>/dev/null | wc -l)
    if [[ $changed -gt 0 ]]; then
      echo "FROZEN PATH VIOLATION: ${frozen_path} has ${changed} modified file(s). Reverting."
      git diff --name-only | grep "^${frozen_path}" | xargs -I{} git checkout -- "{}"
      violations=$((violations + changed))
    fi
  done
  return $violations
}

run_pregate() {
  echo "  [Pre-gate] TypeScript compilation..."
  cd "${SOLUTION_DIR}/mcp-server"
  if npx tsc --noEmit 2>&1; then
    echo "  [Pre-gate] PASS"
    return 0
  else
    echo "  [Pre-gate] FAIL — tsc errors found"
    return 1
  fi
}

update_mcp_tools_config() {
  # Extract tool names from MCP source and update DB config.tools
  local ccaas_url="$1" tenant_id="$2" api_key="$3"
  echo "  [E2E Setup] Updating MCP config.tools in DB..."

  # Get MCP server ID
  local mcp_info
  mcp_info=$(curl -s "${ccaas_url}/api/v1/mcp-servers/edu-tools" \
    -H "X-Tenant-Id: ${tenant_id}" -H "X-Api-Key: ${api_key}" 2>/dev/null)
  local mcp_id
  mcp_id=$(echo "$mcp_info" | jq -r '.id // empty')
  if [[ -z "$mcp_id" ]]; then
    echo "  [E2E Setup] WARNING: Could not find MCP server edu-tools"
    return 1
  fi

  # Extract tool names from source
  local tool_names
  tool_names=$(grep "name: '" "${SOLUTION_DIR}/mcp-server/src/index.ts" \
    | grep -v '//' \
    | sed "s/.*name: '//;s/'.*//" \
    | grep -E '^[a-z_]+$' \
    | sort -u \
    | jq -R -s -c 'split("\n") | map(select(length > 0))')

  # Get current config and merge tools into it
  local current_config
  current_config=$(echo "$mcp_info" | jq -c '.config')
  local updated_config
  updated_config=$(echo "$current_config" | jq -c --argjson tools "$tool_names" '. + {tools: $tools}')

  # Update MCP server via API
  curl -s -X PUT "${ccaas_url}/api/v1/mcp-servers/${mcp_id}" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: ${tenant_id}" \
    -H "X-Api-Key: ${api_key}" \
    -d "{\"name\":\"edu-tools\",\"config\":${updated_config},\"status\":\"active\"}" > /dev/null 2>&1

  local tool_count
  tool_count=$(echo "$tool_names" | jq 'length')
  echo "  [E2E Setup] Updated config.tools with ${tool_count} tools"
}

verify_mcp_workspace() {
  # Verify MCP server files exist at workspace path (including node_modules)
  local tenant_id="$1"
  local workspace_dir="${REPO_ROOT}/packages/backend/.agent-workspace"
  local mcp_dir="${workspace_dir}/tenants/${tenant_id}/mcp-servers/edu-tools"

  if [[ ! -f "${mcp_dir}/dist/index.js" ]] || [[ ! -d "${mcp_dir}/node_modules" ]]; then
    echo "  [E2E Setup] MCP workspace files missing, redeploying..."
    mkdir -p "${mcp_dir}"
    cp -r "${SOLUTION_DIR}/mcp-server/"* "${mcp_dir}/"
    echo "  [E2E Setup] MCP files redeployed to workspace"
    return 1  # signal that we needed to redeploy
  fi
  return 0
}

setup_e2e() {
  echo "  [E2E Setup] Registering tenant and configuring services..."

  E2E_CONFIG="${HARNESS_DIR}/.e2e-config"

  # Reuse existing config if CCAAS is still running AND MCP files exist
  if [[ -f "$E2E_CONFIG" ]]; then
    source "$E2E_CONFIG"
    if curl -s "${CCAAS_URL}/api/v1/health" > /dev/null 2>&1; then
      verify_mcp_workspace "$TENANT_ID"
      echo "  [E2E Setup] Reusing existing config (TENANT_ID=${TENANT_ID:0:8}...)"
      return 0
    fi
    echo "  [E2E Setup] CCAAS not responding, re-configuring..."
  fi

  # Check CCAAS backend is up
  if ! curl -s "${CCAAS_URL}/api/v1/health" > /dev/null 2>&1; then
    echo "  [E2E Setup] WARNING: CCAAS not running at ${CCAAS_URL}. D6 will score 0."
    return 1
  fi

  # Source solution-lib.sh (disable -u temporarily for its guard variable)
  # Save SOLUTION_DIR — solution-lib.sh resets it to ""
  local saved_solution_dir="${SOLUTION_DIR}"
  set +u
  source "${REPO_ROOT}/tools/solution-lib.sh"
  set -u
  SOLUTION_DIR="${saved_solution_dir}"
  load_solution_config "${SOLUTION_DIR}"

  # Create or get tenant
  eval "$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION" "$CCAAS_BOOTSTRAP_KEY")" || {
    echo "  [E2E Setup] Failed to create tenant. D6 will score 0."
    return 1
  }

  # Create API key
  eval "$(create_solution_api_key "$CCAAS_URL" "$TENANT_ID" "$CCAAS_BOOTSTRAP_KEY" "$SOLUTION_NAME")" || {
    echo "  [E2E Setup] Failed to create API key. D6 will score 0."
    return 1
  }

  # Build MCP server
  echo "  [E2E Setup] Building MCP server..."
  cd "${SOLUTION_DIR}/mcp-server"
  npm run build 2>&1 || {
    echo "  [E2E Setup] MCP build failed. D6 will score 0."
    return 1
  }

  # Inject skills and MCP servers
  inject_skills "${SOLUTION_DIR}/skills" "$CCAAS_URL" "$TENANT_ID" "$API_KEY" 2>&1
  inject_mcp_servers "${SOLUTION_DIR}" "$CCAAS_URL" "$TENANT_ID" "$API_KEY" 2>&1

  # Ensure MCP workspace has node_modules (inject_mcp_servers copies files but may miss deps)
  verify_mcp_workspace "$TENANT_ID"

  # Update config.tools so tool registry prompt is injected into sessions
  update_mcp_tools_config "$CCAAS_URL" "$TENANT_ID" "$API_KEY"

  # Sync session templates (maps templateName → enabledSkills)
  echo "  [E2E Setup] Syncing session templates..."
  local templates_body
  templates_body=$(jq -c '{ templates: .sessionTemplates }' "${SOLUTION_DIR}/solution.json")
  local sync_result
  sync_result=$(curl -s -X POST "${CCAAS_URL}/api/v1/admin/tenants/${TENANT_ID}/session-templates/sync" \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: ${API_KEY}" \
    -d "$templates_body")
  echo "  [E2E Setup] Session templates synced: $sync_result"

  # Save config for evaluator
  cat > "$E2E_CONFIG" <<EOFCONFIG
export CCAAS_URL="${CCAAS_URL}"
export TENANT_ID="${TENANT_ID}"
export API_KEY="${API_KEY}"
export SOLUTION_SLUG="${SOLUTION_SLUG}"
EOFCONFIG

  echo "  [E2E Setup] Done. Config saved to ${E2E_CONFIG}"
  return 0
}

rebuild_mcp() {
  echo "  [Rebuild] Compiling MCP server..."
  cd "${SOLUTION_DIR}/mcp-server"
  if npm run build 2>&1; then
    echo "  [Rebuild] PASS"
    # Re-inject so new sessions use updated code
    if [[ -f "${HARNESS_DIR}/.e2e-config" ]]; then
      source "${HARNESS_DIR}/.e2e-config"
      local saved_sd="${SOLUTION_DIR}"
      set +u; source "${REPO_ROOT}/tools/solution-lib.sh" 2>/dev/null || true; set -u
      SOLUTION_DIR="${saved_sd}"
      inject_mcp_servers "${SOLUTION_DIR}" "$CCAAS_URL" "$TENANT_ID" "$API_KEY" 2>&1 || true
      inject_skills "${SOLUTION_DIR}/skills" "$CCAAS_URL" "$TENANT_ID" "$API_KEY" 2>&1 || true
      # Ensure workspace has node_modules and config.tools is updated
      verify_mcp_workspace "$TENANT_ID"
      update_mcp_tools_config "$CCAAS_URL" "$TENANT_ID" "$API_KEY"
    fi
    return 0
  else
    echo "  [Rebuild] FAIL — tsc errors, skipping re-inject"
    return 1
  fi
}

run_generator() {
  local version=$1
  local prev=$((version - 1))
  local prompt=$(cat "$PROMPTS_DIR/generator.md")

  if [[ $version -eq 1 ]]; then
    prompt="${prompt}

---
## Iteration Context (injected by orchestrator)

This is the **FIRST** iteration (v1). Create all files from scratch.

**Your starting point**: No existing reschedule-class skill or timetable tools. Create:
1. \`skills/reschedule-class/SKILL.md\` with full intent-parsing decision tree + 4 types + confirmation gate
2. Add 6 dynamic timetable tools to \`mcp-server/src/index.ts\` with shared schedule data model
3. Update \`solution.json\`

**Priority**: Get tsc --noEmit to pass. Then focus on D2 (dynamic mock) and D1 (decision tree).

**Save changelog to**: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## Iteration Context (injected by orchestrator)

This is iteration **v${version}**.

**Your starting point**: Read existing files — they have been modified by prior iterations. Continue from here, DO NOT recreate from scratch.

**Read the eval report**: harness-workspace/reschedule-class/eval-reports/v${prev}-eval.md — it tells you exactly what to fix.

**Save changelog to**: ${CHANGELOG_DIR}/v${version}-changelog.md"
  fi

  cd "$REPO_ROOT"
  claude_safe -p "$prompt" --allowedTools "$GENERATOR_TOOLS" 2>&1 || {
    echo "ERROR: Generator failed on v${version}" >&2
    return 1
  }
}

run_evaluator() {
  local version=$1
  local prompt=$(cat "$PROMPTS_DIR/evaluator.md")

  # Inject version number
  prompt=$(echo "$prompt" | sed "s/{N}/${version}/g")

  cd "$REPO_ROOT"
  claude_safe -p "$prompt" --allowedTools "$EVALUATOR_TOOLS" 2>&1 || {
    echo "ERROR: Evaluator failed on v${version}" >&2
    return 1
  }
}

# --- Pre-flight ---

mkdir -p "$EVAL_DIR" "$CHANGELOG_DIR"
mkdir -p "${SOLUTION_DIR}/skills/reschedule-class"

# E2E setup: register tenant, build MCP, inject skills
setup_e2e || echo "  E2E setup failed — D6 will be evaluated as 0."

# --- Main Loop ---

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ${TASK_NAME} Harness — Skill + Dynamic Mock MCP            ║"
echo "║  Artifact: skills/reschedule-class + mcp-server timetable   ║"
echo "║  Dimensions: D1-D5 static + D6 E2E (conditional)           ║"
echo "║  Max iterations: ${MAX_ITERATIONS}                          ║"
echo "║  Score threshold: ${SCORE_THRESHOLD}/100                    ║"
echo "║  Cost cap: \$${MAX_COST_USD}                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"

if $RESUME; then
  START_VERSION=$(( $(get_last_version) + 1 ))
  echo "Resuming from v${START_VERSION}..."
else
  START_VERSION=1
fi

if $DRY_RUN; then
  remaining=$((MAX_ITERATIONS - START_VERSION + 1))
  est=$(estimate_cost $remaining)
  echo "[DRY RUN] Would run ${remaining} iterations, estimated cost: \$${est}"
  exit 0
fi

low_improvement_count=0
prev_score=0

# If resuming, recover prev_score from last eval
if [[ $START_VERSION -gt 1 ]]; then
  prev_eval="${EVAL_DIR}/v$((START_VERSION - 1))-eval.md"
  if [[ -f "$prev_eval" ]]; then
    prev_score=$(extract_score "$prev_eval" || echo "0")
  fi
fi

for i in $(seq $START_VERSION $MAX_ITERATIONS); do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Iteration $i / $MAX_ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cost check
  completed=$((i - START_VERSION))
  spent=$(estimate_cost $completed)
  if (( $(echo "$spent > $MAX_COST_USD" | bc -l) )); then
    echo "Cost cap reached (\$${spent} > \$${MAX_COST_USD}). Stopping."
    break
  fi

  # ─── Step 1: Generator ───
  echo ""
  echo "  [Step 1/6] Running Generator..."
  run_generator $i || {
    echo "  Generator failed. Retrying once..."
    sleep 5
    run_generator $i || {
      echo "  Generator failed twice. Stopping."
      append_progress_simple $i "ERROR" "Generator failure"
      break
    }
  }

  # ─── Step 2: Frozen file check ───
  echo ""
  echo "  [Step 2/6] Checking frozen files..."
  cd "$REPO_ROOT"
  check_frozen_files || {
    echo "  WARNING: $? frozen file(s) were reverted."
  }

  # ─── Step 3: Rebuild MCP + re-inject ───
  echo ""
  echo "  [Step 3/6] Rebuilding MCP server..."
  rebuild_mcp || {
    echo "  MCP rebuild failed. Evaluator will score pre-gate FAIL."
  }

  # ─── Step 4: Pre-gate validation ───
  echo ""
  echo "  [Step 4/6] Running pre-gate validation..."
  if ! run_pregate; then
    echo "  Pre-gate FAILED. Evaluator will score 0/100 but still report errors."
  fi

  # ─── Git snapshot ───
  cd "$REPO_ROOT"
  git add "solutions/business/edu-platform/skills/reschedule-class/" \
          "solutions/business/edu-platform/mcp-server/src/" \
          "solutions/business/edu-platform/solution.json" \
          "${CHANGELOG_DIR}/" 2>/dev/null || true
  git commit -m "feat(shared): reschedule-class v${i} iteration" --allow-empty 2>/dev/null || true

  # ─── Step 5: Evaluator ───
  echo ""
  echo "  [Step 5/6] Running Evaluator..."
  run_evaluator $i || {
    echo "  Evaluator failed. Retrying once..."
    sleep 5
    run_evaluator $i || {
      echo "  Evaluator failed twice. Stopping."
      append_progress_simple $i "ERROR" "Evaluator failure"
      break
    }
  }

  # ─── Step 6: Extract results + exit conditions ───
  echo ""
  echo "  [Step 6/6] Extracting results..."

  eval_file="${EVAL_DIR}/v${i}-eval.md"
  if [[ ! -f "$eval_file" ]]; then
    echo "  Eval report not found at ${eval_file}. Stopping."
    append_progress_simple $i "ERROR" "No eval report"
    break
  fi

  score=$(extract_score "$eval_file")
  if [[ -z "$score" ]]; then
    echo "  Could not extract score from eval report. Stopping."
    append_progress_simple $i "ERROR" "Score extraction failed"
    break
  fi

  # Extract per-dimension scores
  extract_dim() {
    local dim="$1" file="$2"
    grep "| ${dim} |" "$file" 2>/dev/null | head -1 | awk -F'|' '{gsub(/[[:space:]]/, "", $4); print $4}'
  }
  d1=$(extract_dim "D1" "$eval_file" || echo "-")
  d2=$(extract_dim "D2" "$eval_file" || echo "-")
  d3=$(extract_dim "D3" "$eval_file" || echo "-")
  d4=$(extract_dim "D4" "$eval_file" || echo "-")
  d5=$(extract_dim "D5" "$eval_file" || echo "-")
  d6=$(extract_dim "D6" "$eval_file" || echo "-")

  # Extract top issue
  top_issue=$(grep -A1 "Priority Fix" "$eval_file" 2>/dev/null | tail -1 | cut -c1-60 || echo "N/A")

  append_progress "$i" "$score" "$d1" "$d2" "$d3" "$d4" "$d5" "$d6" "$top_issue"
  echo "  Score: ${score}/100"

  # Git snapshot: eval
  cd "$REPO_ROOT"
  git add "${EVAL_DIR}/" "${PROGRESS_FILE}" 2>/dev/null || true
  git commit -m "feat(shared): reschedule-class v${i} eval — score ${score}/100" --allow-empty 2>/dev/null || true

  # ─── Exit conditions ───

  # 1. Score threshold
  if [[ "$score" -ge "$SCORE_THRESHOLD" ]]; then
    echo ""
    echo "  Score threshold reached! (${score} >= ${SCORE_THRESHOLD})"
    break
  fi

  # 2. Regression detection
  if [[ $prev_score -gt 0 && $score -lt $((prev_score - ROLLBACK_THRESHOLD)) ]]; then
    echo ""
    echo "  REGRESSION detected: ${prev_score} -> ${score}. Reverting source files."
    cd "$REPO_ROOT"
    git checkout HEAD~2 -- \
      "solutions/business/edu-platform/skills/reschedule-class/" \
      "solutions/business/edu-platform/mcp-server/src/" \
      "solutions/business/edu-platform/solution.json" 2>/dev/null || true
    git add -A && git commit -m "feat(shared): reschedule-class v${i} REVERTED — regression ${prev_score}->${score}" 2>/dev/null || true
    continue
  fi

  # 3. Diminishing returns
  if [[ $prev_score -gt 0 ]]; then
    improvement=$((score - prev_score))
    if [[ $improvement -lt $MIN_IMPROVEMENT ]]; then
      low_improvement_count=$((low_improvement_count + 1))
      if [[ $low_improvement_count -ge 2 ]]; then
        echo ""
        echo "  Diminishing returns (< ${MIN_IMPROVEMENT} pts for 2 consecutive iterations). Stopping."
        echo "  Bottleneck: ${top_issue}"
        break
      fi
      echo "  Low improvement (${improvement} pts). Count: ${low_improvement_count}/2"
    else
      low_improvement_count=0
    fi
  fi

  prev_score=$score
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Run Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Progress:  ${PROGRESS_FILE}"
echo "  Skill:     solutions/business/edu-platform/skills/reschedule-class/SKILL.md"
echo "  MCP:       solutions/business/edu-platform/mcp-server/src/index.ts"
echo "  History:   git log --grep='reschedule-class' --oneline"
echo ""
echo "  Next steps:"
echo "    cat ${PROGRESS_FILE}"
echo "    cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit"
echo ""
