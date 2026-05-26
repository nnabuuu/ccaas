/**
 * Spec 16 — Creator V7 ↔ Agent-Runtime e2e
 *
 * Validates the wire we shipped in 7a231ae8 + 1d4080f7 through a real
 * Playwright run instead of the bash smoke. What this catches that
 * unit tests can't:
 *   - controller + auth pipeline composition (Phase 2b-2 SSE token)
 *   - real network round-trips for bind-project
 *   - bootstrap sync propagating from live-lesson artifact source
 *     through ccaas EventEmitter to the SSE bus
 *   - DTO validation pipe (class-validator) actually firing on the
 *     bind-project route
 *
 * NOT covered here (lives in unit specs):
 *   - cross-tenant 403, rebind 409 (session.service.bind-project.spec.ts)
 *   - skill walker safety (solution-loader.service.skill-walk.spec.ts)
 *   - transactional create (skills.service.spec.ts)
 *
 * Requirements (matches poc-smoke.sh runbook + the wider e2e suite):
 *   - ccaas :3001 + live-lesson :3007 running
 *   - SOLUTIONS_DIR exported when ccaas booted (live-lesson-creator
 *     tenant auto-imported)
 *   - AUTH_ALLOW_ANONYMOUS=true OR CCAAS_API_KEY exported
 *   - the existing /creator UI dev server on :5284 for the UI sanity
 *     test (skip via SKIP_CREATOR_UI=1 when only running headless CI)
 */

import { test, expect } from '@playwright/test';
import {
  CCAAS_URL,
  CREATOR_URL,
  CREATOR_TENANT_SLUG,
} from '../helpers/constants';
import {
  bindProject,
  bindProjectAfterCreate,
  createCourseProject,
  getCreatorTenantId,
  invalidateProject,
  listArtifacts,
  newSessionId,
  postFirstMessage,
  putArtifact,
  subscribeChanges,
} from '../helpers/ccaas-client';
import { getCcaasApiKeyCached } from '../helpers/api-key';

// ── Module-scoped fixtures ─────────────────────────────────────────────
// Tenant id + api key are resolved once per worker because the cost is
// non-trivial (sqlite read or subprocess mint). Project ids are
// per-test for isolation.

let solutionId: string;
let apiKey: string;

test.beforeAll(async () => {
  solutionId = getCreatorTenantId();
  apiKey = getCcaasApiKeyCached();
  // Sanity ping ccaas — fail fast if backend is down.
  const ping = await fetch(`${CCAAS_URL}/api/v1/health`).catch(() => null);
  if (!ping || !ping.ok) {
    throw new Error(
      `ccaas at ${CCAAS_URL} not reachable. Boot both backends per ` +
        `packages/backend/CLAUDE.md "End-to-end agent-runtime smoke" section.`,
    );
  }
});

test.describe('16 — creator-v7 ↔ agent-runtime', () => {
  test('GUI edit + /invalidate → SSE updated event reaches the consumer', async () => {
    // This mirrors the canonical Phase 2b-2 flow exercised by
    // solutions/business/live-lesson-creator/scripts/poc-smoke.sh.
    //
    // Why the order is bind-FIRST, subscribe-AFTER:
    // SSE auth (ProjectAccessGuard) requires a session_metadata row
    // for the project; bind-project is the canonical writer. So the
    // subscriber would 403 if we subscribed before binding. Bootstrap
    // events fired during bind are intentionally accepted as "missed"
    // — the test proves event delivery via a subsequent GUI edit +
    // /invalidate, which is closer to what the real creator-v7 UI
    // will need to handle anyway (the user types in the chat → agent
    // edits manifest → SSE delivers the change to other tabs).

    // 1. live-lesson scaffolds the project + artifacts
    const project = await createCourseProject({ title: 'e2e-invalidate' });
    const artifacts = await listArtifacts(project.id);
    expect(artifacts.length).toBeGreaterThanOrEqual(2);

    // 2. POST first message — queues session creation via MessageWorkerService
    const sessionId = newSessionId();
    const msg = await postFirstMessage({ sessionId, solutionId });
    expect(msg.status).toBe(201);

    // 3. bind — writes session_metadata(projectId → solutionId). Retries
    //    on 404 because the worker may not have inserted the session
    //    into the in-memory map before fetch's headers came back.
    const bind = await bindProjectAfterCreate(
      sessionId,
      { projectId: project.id, solutionId },
    );
    expect(bind.status).toBe(201);
    expect(bind.data).toMatchObject({ success: true, sessionId, projectId: project.id });

    // 4. Let the bootstrap sync settle so the next /invalidate sees the
    //    post-bootstrap snapshot as baseline. Matches the bash smoke's
    //    `sleep 2` after bind.
    await new Promise((r) => setTimeout(r, 2000));

    // 5. Subscribe now — auth passes because the metadata row exists.
    //    20s window covers the GUI PUT + invalidate + SSE delivery
    //    with comfortable headroom.
    const sse = subscribeChanges({ projectId: project.id, apiKey, timeoutMs: 20_000 });
    // Wait for the welcome `subscribed` envelope before triggering
    // changes — otherwise we'd race past the subscription handshake.
    await expect.poll(() => sse.events.some((e) => e.kind === 'subscribed'), {
      message: 'SSE never delivered welcome `subscribed` event',
      timeout: 8_000,
      intervals: [200, 200, 500, 500, 1000],
    }).toBe(true);

    // 6. Simulate a GUI-side edit by overwriting execution/manifest.json
    //    directly through live-lesson's REST artifact contract.
    const editedManifest = JSON.stringify({
      id: project.id,
      title: 'e2e-invalidate EDITED',
      subject: '',
      gradeLevel: '',
      lessonType: 'interactive',
      readingSteps: [],
    });
    await putArtifact({
      projectId: project.id,
      path: 'execution/manifest.json',
      content: editedManifest,
      type: 'json',
    });

    // 7. Tell ccaas to re-sync. The syncer diffs against its snapshot,
    //    sees the manifest changed, and fires an 'updated' ChangeEvent.
    const invalidated = await invalidateProject({ projectId: project.id, apiKey });
    expect(invalidated.accepted).toBeGreaterThanOrEqual(1);

    // 8. Wait for the 'updated' event to land. Tight timing because
    //    invalidate is fire-and-forget but the syncer runs on the
    //    next tick — 5s is plenty.
    await expect.poll(
      () => sse.events.filter((e) => e.kind === 'updated').length,
      {
        message: 'SSE did not deliver any updated events after /invalidate',
        timeout: 5_000,
        intervals: [200, 200, 500, 500, 1000],
      },
    ).toBeGreaterThanOrEqual(1);

    sse.stop();
    await sse.done;

    const updates = sse.events.filter((e) => e.kind === 'updated');
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates.some((e) => e.path === 'execution/manifest.json')).toBe(true);
  });

  test('SSE auth gate (Phase 2b-2): subscribing without ?token= returns 401/403', async () => {
    const project = await createCourseProject({ title: 'e2e-sse-auth' });
    const res = await fetch(`${CCAAS_URL}/projects/${project.id}/changes`);
    // Either gate behaviour is acceptable — the load-bearing fact is
    // that anonymous subscribers cannot tap a project's change stream.
    expect([401, 403]).toContain(res.status);
  });

  test('bind-project DTO validation: missing projectId returns 400', async () => {
    const sessionId = newSessionId();
    const res = await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solutionId }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string | string[] };
    // class-validator's BadRequestException emits a `message` field
    // listing each constraint that failed; we don't pin the exact
    // string but we do want to see "projectId" surfaced.
    const blob = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? '');
    expect(blob.toLowerCase()).toContain('projectid');
  });

  test('bind-project DTO validation: missing solutionId returns 400', async () => {
    const sessionId = newSessionId();
    const res = await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'whatever' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string | string[] };
    const blob = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? '');
    expect(blob.toLowerCase()).toContain('tenantid');
  });

  test('bind-project on unknown session returns 404', async () => {
    const ghostId = newSessionId();
    const bind = await bindProject(ghostId, { projectId: 'irrelevant', solutionId });
    expect(bind.status).toBe(404);
  });

  // ── Creator UI sanity — guarded for headless CI ─────────────────────
  // SKIP_CREATOR_UI=1 disables; default behaviour assumes :5284 is up.
  // We don't drive the v7 surfaces (they don't exist as real code yet);
  // this test just confirms that a freshly created project propagates
  // to the existing /projects list — i.e. the live-lesson backend the
  // creator UI talks to is the same one ccaas bound to.

  test.describe('UI sanity (skip with SKIP_CREATOR_UI=1)', () => {
    test.skip(!!process.env.SKIP_CREATOR_UI, 'SKIP_CREATOR_UI set');

    test('newly created project appears in /projects list', async ({ page }) => {
      const title = `e2e-ui-sanity-${Date.now()}`;
      await createCourseProject({ title });

      await page.goto(`${CREATOR_URL}/projects`);
      // /projects list is the existing creator route. Project title
      // becomes a row entry — Playwright's text-locator is enough for
      // the sanity check (no need to pin a specific selector that
      // could churn).
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    });
  });
});
