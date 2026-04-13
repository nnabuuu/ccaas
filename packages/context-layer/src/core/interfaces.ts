// ============ Decorator Options ============

export interface ReferenceableOptions {
  type: string;
  displayName: string;
  icon: string;
  color?: string;
  abilities?: {
    search?: boolean | { queryParam?: string; endpoint?: string };
    browse?: boolean | { defaultSort?: string; filterFields?: string[] };
    resolve?: boolean | { folderPathField?: string };
    track?: boolean;
  };
  contextFields?: string[];
  hideRelations?: string[];
  relationLabels?: Record<string, string>;
  recommender?: {
    weights?: Record<string, number>;
    augment?: (base: Recommendation[], ctx: RecommendContext) => Promise<Recommendation[]>;
  };
}

export interface TrackedOptions {
  action: string;
  entityType?: string;
}

// ============ Entity Registry ============

export interface EntityTypeInfo {
  type: string;
  displayName: string;
  icon: string;
  color?: string | null;
  searchable: boolean;
  browsable: boolean;
}

export interface RelationInfo {
  parent: string;
  child: string;
  label: string;
  foreignKey: string;
}

export interface RelationTree {
  roots: string[];
  relations: RelationInfo[];
}

export interface RegisteredEntity {
  options: ReferenceableOptions;
  controllerPath?: string;
  entityClass?: unknown;
}

// ============ Activity ============

export interface ActivityRecord {
  userId: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  entityDisplayName: string;
  sessionId: string;
  sessionTemplateId?: string;
  action: 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted';
  source: 'auto_track' | 'tracked_decorator' | 'manual';
  timestamp: number;
}

// ============ Recommend ============

export interface Recommendation {
  entityType: string;
  entityId: string;
  displayName: string;
  icon: string;
  color?: string | null;
  score: number;
  breadcrumb: BreadcrumbItem[] | null;
  summary?: string;
}

export interface RecommendContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  sessionTemplateId?: string;
  currentRefs?: Array<{ entityType: string; entityId: string }>;
}

export interface BreadcrumbItem {
  type: string;
  id: string;
  displayName: string;
  icon: string;
}

// ============ API Response Types (Section 7.1) ============

export interface EntityTypesResponse {
  types: EntityTypeInfo[];
  tree: RelationTree;
}

export interface BrowseItem {
  entityType: string;
  entityId: string;
  displayName: string;
  subtitle?: string;
  timestamp?: string;
  hasChildren: boolean;
  summary?: string;
}

export interface BrowseResponse {
  items: BrowseItem[];
  total: number;
  page: number;
}

export interface SuggestResponse {
  recents: Recommendation[];
  cachedAt: string;
}

export interface SearchResult {
  entityType: string;
  entityId: string;
  displayName: string;
  subtitle?: string;
  icon: string;
  breadcrumb: BreadcrumbItem[] | null;
  summary?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface ResolveResponse {
  entityType: string;
  entityId: string;
  displayName: string;
  data: Record<string, unknown>;
  dataHash: string;
  resolvedAt: string;
  breadcrumb: BreadcrumbItem[] | null;
}

export interface ShortcutsResponse {
  pinned: string[];
  hidden: string[];
}

export interface ShortcutsConfig {
  pinned: string[];
  hidden: string[];
}

// ============ Core Service Interfaces ============

export interface ActivityQueue {
  add(record: ActivityRecord): Promise<void>;
}

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  zincrby(key: string, increment: number, member: string): Promise<void>;
  zrevrange(key: string, start: number, stop: number): Promise<Array<{ member: string; score: number }>>;
  hget(key: string, field: string): Promise<string | null>;
  hmget(key: string, fields: string[]): Promise<Array<string | null>>;
  hset(key: string, field: string, value: string): Promise<void>;
}

export interface OrmAdapter {
  getEntityRelations(entityClass: unknown): Array<{
    propertyName: string;
    relationType: 'one-to-many' | 'many-to-one' | 'many-to-many';
    targetEntity: unknown;
    foreignKey?: string;
  }>;
  getEntityClass(controllerPath: string): unknown | null;
}

export interface EntityBrowseProvider {
  browse(entityType: string, opts: { parentType?: string; parentId?: string; page?: number }): Promise<BrowseResponse>;
  search(query: string, opts?: { entityType?: string; limit?: number }): Promise<SearchResponse>;
  resolve(entityType: string, entityId: string, fields?: string[]): Promise<ResolveResponse>;
}

// ============ AtReference & EntityContext (Phase 1-3) ============

export interface AtReference {
  type: string;
  id: string;
  display_name: string;
  summary: string;
}

export interface EntityContext {
  ref: AtReference;
  structured: Record<string, any>;
  relations: AtReference[];
  attachments: EntityAttachment[];
}

export interface EntityAttachment {
  name: string;
  path: string;
  mime_type: string;
  size_bytes: number;
}

export interface ApplyAction {
  id: string;
  target: AtReference;
  field_path: string;
  suggested_value: any;
  description: string;
  status: 'pending' | 'applied' | 'outdated';
  applied_at?: string;
}

export interface ApplyRequest {
  entity_id: string;
  field_path: string;
  suggested_value: any;
  action_description: string;
  session_id: string;
}

// ============ Edit Operations (Phase 4) ============

export type EditOperation =
  | { op: 'str_replace'; old_string: string; new_string: string }
  | { op: 'field_set'; field: string; value: any };

export interface EditResult {
  success: boolean;
  error?: string;
  document?: string;
}

export interface EntityContextProvider {
  getContext(id: string, userId: string): Promise<EntityContext>;
  search(query: string, userId: string, limit: number): Promise<AtReference[]>;
  /** @deprecated Use edit() with field_set operations instead */
  apply?(req: ApplyRequest, userId: string): Promise<{ success: boolean; error?: string }>;
  serialize?(id: string, userId: string): Promise<string>;
  edit?(id: string, ops: EditOperation[], userId: string): Promise<EditResult>;
}

// ============ Default Weights ============

export const DEFAULT_RECOMMEND_WEIGHTS = {
  session_affinity: 0.4,
  recency: 0.3,
  frequency: 0.15,
  cooccurrence: 0.15,
} as const;
