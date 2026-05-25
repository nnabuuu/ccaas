/**
 * Project sub-module — Phase 0 interface skeleton.
 *
 * A `Project` is a tenant-owned container for `Artifact`s. Concrete
 * `ProjectStore` impls land in Phase 1 (TypeORM-backed for ccaas
 * backend; solutions can write their own).
 *
 * **v0 — these interfaces will likely change as Phase 1 impls are
 * built. Don't depend on the shape externally until v1.**
 *
 * Driving use case (live-lesson today, bespoke):
 *   - `CourseProject` (id, title, status, description) → maps to `Project`
 *   - `ProjectFile` (projectId, path, content, fileType) → maps to `Artifact`
 *   - REST `POST /projects/:id/files` → would use `ArtifactStore.save`
 */

export interface Project {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly description?: string;
  readonly status: 'draft' | 'active' | 'archived';
  /** Solution-specific extra fields (e.g. live-lesson's "grade", "subject"). */
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectListOptions {
  status?: Project['status'];
  limit?: number;
  offset?: number;
}

export interface ProjectStore {
  load(projectId: string): Promise<Project | null>;
  list(tenantId: string, opts?: ProjectListOptions): Promise<ReadonlyArray<Project>>;
  save(project: Project): Promise<void>;
  delete(projectId: string): Promise<void>;
}

/**
 * Binds a ccaas runtime session to a project. The session's
 * workspace gets the project's artifacts materialized into it; agent
 * writes can be persisted back to the project.
 */
export interface ProjectSession {
  readonly sessionId: string;
  readonly projectId: string;
}
