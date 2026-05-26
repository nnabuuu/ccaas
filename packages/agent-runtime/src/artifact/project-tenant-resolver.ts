/**
 * `ProjectTenantResolver` — the port solutions implement so the
 * agent-runtime sync layer can enforce per-project tenant isolation
 * on the SSE feed (and the invalidate endpoint).
 *
 * Why solution-provided: project ownership lives in the solution's
 * DB (live-lesson's `CourseProject` table, etc.). ccaas only sees
 * opaque `projectId` strings; it can't know which tenant they belong
 * to without asking the solution.
 *
 * Resolution flow (Phase 2b-2):
 *   1. SSE subscriber hits `GET /projects/:id/changes?token=K`
 *   2. ccaas validates the token via `ApiKeyService.validateKey(K)` → tenant T
 *   3. ccaas calls `verifyProjectAccess(projectId, T)` → true / false
 *   4. If false → 403 Forbidden; if true → stream the changes
 *
 * Default impl (when no solution registers one): returns false for every
 * call → all requests get 403. Solutions opt in by registering an impl
 * under the `PROJECT_TENANT_RESOLVER` DI token in their module.
 *
 * **API shape rationale (Phase 2b-2 review)**: the port asks the
 * verification question directly (`does this tenant own this project?`)
 * rather than answering "who owns this project?" + having the caller
 * compare. The former is what every caller actually needs, and shape
 * pushes the impl to do a single indexed lookup keyed on the pair —
 * the "who owns" shape encouraged impls to return the first match
 * regardless of which tenant asked, which is a footgun for multi-tenant
 * resolvers (the OLDEST binding wins, even if the caller is a
 * legitimate later tenant for the same projectId).
 */

export interface ProjectTenantResolver {
  /**
   * Returns true iff `callerTenantId` is permitted to act on
   * `projectId`. Returns false when the project doesn't exist, when no
   * binding/permission exists for this caller, OR when the solution
   * explicitly wants to deny access.
   *
   * Performance: called once per SSE connection + once per invalidate
   * request. Cache aggressively if your project table is hot.
   */
  verifyProjectAccess(
    projectId: string,
    callerTenantId: string,
  ): Promise<boolean>;
}
