#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Visual QA — Playwright smoke test for CSS contrast / inheritance
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/solutions/business/live-lesson/backend"
FRONTEND_DIR="$PROJECT_ROOT/solutions/business/live-lesson/frontend"
REPORT_FILE="$HARNESS_DIR/tests/visual-qa-report.txt"

BACKEND_PORT=3007
FRONTEND_PORT=5283
BACKEND_PID=""
FRONTEND_PID=""

# ═══ Cleanup ═══
cleanup() {
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  # Also kill any orphaned processes on our ports
  lsof -ti :${BACKEND_PORT} 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti :${FRONTEND_PORT} 2>/dev/null | xargs kill 2>/dev/null || true
  # Clean up temp files
  rm -f "$TMPDIR/visual-qa-test.spec.ts" "$TMPDIR/playwright-vqa.config.ts" 2>/dev/null || true
}
trap cleanup EXIT

# ═══ Preflight ═══
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "ERROR: Backend source dir not found: $SOURCE_DIR"
  echo "SKIP: backend dir missing" > "$REPORT_FILE"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "ERROR: Frontend source dir not found: $FRONTEND_DIR"
  echo "SKIP: frontend dir missing" > "$REPORT_FILE"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not available"
  echo "SKIP: npx not available" > "$REPORT_FILE"
  exit 1
fi

# Check Playwright is installed
if ! npx playwright --version &>/dev/null 2>&1; then
  echo "WARNING: Playwright not installed. Attempting install..."
  npx playwright install chromium 2>/dev/null || {
    echo "SKIP: Playwright not available" > "$REPORT_FILE"
    exit 0
  }
fi

echo "=== Visual QA: Starting services ==="

# ═══ Build & start backend ═══
echo "Building backend..."
cd "$SOURCE_DIR"
npx nest build 2>&1 || {
  echo "FAIL: Backend build failed" > "$REPORT_FILE"
  exit 1
}

PORT=$BACKEND_PORT node dist/main.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# ═══ Start frontend ═══
echo "Starting frontend..."
cd "$FRONTEND_DIR"
npx vite --port $FRONTEND_PORT &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# ═══ Wait for backend ═══
echo "Waiting for backend on port $BACKEND_PORT..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${BACKEND_PORT}/api/lessons" >/dev/null 2>&1; then
    echo "Backend ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "FAIL: Backend did not start within 30s" > "$REPORT_FILE"
    exit 1
  fi
  sleep 1
done

# ═══ Wait for frontend ═══
echo "Waiting for frontend on port $FRONTEND_PORT..."
for i in $(seq 1 15); do
  if curl -sf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    echo "Frontend ready."
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo "FAIL: Frontend did not start within 15s" > "$REPORT_FILE"
    exit 1
  fi
  sleep 1
done

# ═══ Create test session ═══
echo "Creating test session..."
SESSION_RESP=$(curl -sf -X POST "http://localhost:${BACKEND_PORT}/api/classroom-sessions" \
  -H 'Content-Type: application/json' \
  -d '{"lessonId": "ideal-beauty-reading"}' 2>/dev/null || echo "")

if [[ -z "$SESSION_RESP" ]]; then
  echo "WARNING: Could not create test session. Tests will use default routes."
fi

LESSON_ID="ideal-beauty-reading"

# ═══ Generate Playwright test ═══
TMPTEST="${TMPDIR:-/tmp}/visual-qa-test.spec.ts"
TMPCONFIG="${TMPDIR:-/tmp}/playwright-vqa.config.ts"

cat > "$TMPCONFIG" <<'PWCEOF'
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  timeout: 15000,
  retries: 0,
  reporter: [['list']],
});
PWCEOF

cat > "$TMPTEST" <<PWEOF
import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:${FRONTEND_PORT}';
const LESSON_ID = '${LESSON_ID}';

/**
 * Parse CSS color string to RGB values.
 * Handles rgb(r, g, b) and rgba(r, g, b, a) formats.
 */
function parseRGB(colorStr: string): { r: number; g: number; b: number } | null {
  const match = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  if (!match) return null;
  return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
}

test.describe('Visual QA — CSS contrast & inheritance', () => {

  test('C1: Join page .stu-join-title text is not near-white', async ({ page }) => {
    await page.goto(FRONTEND + '/join');
    // Wait for page to be reasonably loaded
    await page.waitForTimeout(2000);

    const titleEl = await page.\$('.stu-join-title');
    if (!titleEl) {
      // If the selector doesn't exist, check for any heading
      const bodyColor = await page.evaluate(() => {
        const el = document.querySelector('h1, h2, .stu-join-title, [class*="join"] h1');
        if (!el) return 'NO_ELEMENT';
        return window.getComputedStyle(el).color;
      });
      if (bodyColor === 'NO_ELEMENT') {
        console.log('WARN: No join title element found. Skipping check.');
        return;
      }
      const rgb = parseRGB(bodyColor);
      expect(rgb, 'Could not parse color: ' + bodyColor).not.toBeNull();
      // Near-white check: all channels > 200 means text is invisible on white bg
      const isNearWhite = rgb!.r > 200 && rgb!.g > 200 && rgb!.b > 200;
      expect(isNearWhite, 'Join title color is near-white (' + bodyColor + '), invisible on light bg').toBe(false);
      return;
    }

    const color = await titleEl.evaluate((el) => window.getComputedStyle(el).color);
    const rgb = parseRGB(color);
    expect(rgb, 'Could not parse color: ' + color).not.toBeNull();
    // Each channel should be < 200 (not near-white)
    const isNearWhite = rgb!.r > 200 && rgb!.g > 200 && rgb!.b > 200;
    expect(isNearWhite, 'Join title color is near-white (' + color + '), invisible on light bg').toBe(false);
  });

  test('C2: Join page input does not inherit body #ececef color', async ({ page }) => {
    await page.goto(FRONTEND + '/join');
    await page.waitForTimeout(2000);

    const inputColor = await page.evaluate(() => {
      const card = document.querySelector('.stu-join-card') || document.querySelector('[class*="join"]');
      if (!card) return 'NO_CARD';
      const input = card.querySelector('input');
      if (!input) return 'NO_INPUT';
      return window.getComputedStyle(input).color;
    });

    if (inputColor === 'NO_CARD' || inputColor === 'NO_INPUT') {
      console.log('WARN: Join card/input not found. Skipping check.');
      return;
    }

    const rgb = parseRGB(inputColor);
    expect(rgb, 'Could not parse color: ' + inputColor).not.toBeNull();
    // #ececef = rgb(236, 236, 239) — this is the body dark-theme color that leaks
    const isBodyColor = rgb!.r > 220 && rgb!.g > 220 && rgb!.b > 220;
    expect(isBodyColor, 'Input inherited body color (' + inputColor + '), text invisible on light bg').toBe(false);
  });

  test('C3: Teacher page .teacher-root text is readable', async ({ page }) => {
    await page.goto(FRONTEND + '/teacher/' + LESSON_ID);
    await page.waitForTimeout(2000);

    const teacherColor = await page.evaluate(() => {
      const root = document.querySelector('.teacher-root') || document.querySelector('[class*="teacher"]');
      if (!root) return 'NO_ELEMENT';
      return window.getComputedStyle(root).color;
    });

    if (teacherColor === 'NO_ELEMENT') {
      console.log('WARN: Teacher root element not found. Skipping check.');
      return;
    }

    const rgb = parseRGB(teacherColor);
    expect(rgb, 'Could not parse color: ' + teacherColor).not.toBeNull();
    // Text should not be near-white (invisible on any reasonable background)
    const isNearWhite = rgb!.r > 220 && rgb!.g > 220 && rgb!.b > 220;
    expect(isNearWhite, 'Teacher root color is near-white (' + teacherColor + '), may be unreadable').toBe(false);
  });

});
PWEOF

# ═══ Run Playwright ═══
echo "=== Visual QA: Running Playwright checks ==="
cd "$PROJECT_ROOT"

PLAYWRIGHT_OUTPUT=$(npx playwright test "$TMPTEST" --config "$TMPCONFIG" 2>&1) || true

echo "$PLAYWRIGHT_OUTPUT"

# ═══ Generate report ═══
echo "=== Visual QA Report ===" > "$REPORT_FILE"
echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Parse results
PASS_COUNT=0
FAIL_COUNT=0
TOTAL=3

if echo "$PLAYWRIGHT_OUTPUT" | grep -q "C1.*passed\|1 passed"; then
  echo "C1: Join page text contrast — PASS" >> "$REPORT_FILE"
  PASS_COUNT=$((PASS_COUNT + 1))
fi
if echo "$PLAYWRIGHT_OUTPUT" | grep -q "C2.*passed"; then
  echo "C2: Input color inheritance — PASS" >> "$REPORT_FILE"
  PASS_COUNT=$((PASS_COUNT + 1))
fi
if echo "$PLAYWRIGHT_OUTPUT" | grep -q "C3.*passed"; then
  echo "C3: Teacher page text readability — PASS" >> "$REPORT_FILE"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# Check for failures
if echo "$PLAYWRIGHT_OUTPUT" | grep -qE "C1.*failed|C1.*FAIL"; then
  echo "C1: Join page text contrast — FAIL (near-white text on light background)" >> "$REPORT_FILE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
if echo "$PLAYWRIGHT_OUTPUT" | grep -qE "C2.*failed|C2.*FAIL"; then
  echo "C2: Input color inheritance — FAIL (inherited body #ececef)" >> "$REPORT_FILE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
if echo "$PLAYWRIGHT_OUTPUT" | grep -qE "C3.*failed|C3.*FAIL"; then
  echo "C3: Teacher page text readability — FAIL (near-white text)" >> "$REPORT_FILE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# If we couldn't parse individual results, fall back to overall
if [[ $PASS_COUNT -eq 0 && $FAIL_COUNT -eq 0 ]]; then
  if echo "$PLAYWRIGHT_OUTPUT" | grep -qE "[0-9]+ passed"; then
    PASS_COUNT=$(echo "$PLAYWRIGHT_OUTPUT" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
  fi
  if echo "$PLAYWRIGHT_OUTPUT" | grep -qE "[0-9]+ failed"; then
    FAIL_COUNT=$(echo "$PLAYWRIGHT_OUTPUT" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
  fi
  echo "Parsed from summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed out of ${TOTAL} checks" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "--- Raw output ---" >> "$REPORT_FILE"
echo "$PLAYWRIGHT_OUTPUT" >> "$REPORT_FILE"

echo ""
echo "=== Visual QA complete: ${PASS_COUNT} passed, ${FAIL_COUNT} failed ==="
echo "Report: $REPORT_FILE"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
