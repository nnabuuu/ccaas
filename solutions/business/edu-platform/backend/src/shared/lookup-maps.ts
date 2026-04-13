/**
 * Static lookup maps for ID ↔ display name resolution.
 * Used by services to transform DB entities into frontend-friendly responses.
 */

// ── Subject ID ↔ Name ──────────────────────────────────────

const SUBJECT_MAP: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  chinese: '语文',
  english: '英语',
  history: '历史',
  geography: '地理',
  politics: '道德与法治',
};

const SUBJECT_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECT_MAP).map(([k, v]) => [v, k]),
);

export function resolveSubjectName(subjectId: string): string {
  return SUBJECT_MAP[subjectId] || subjectId;
}

export function resolveSubjectId(subjectName: string): string {
  return SUBJECT_REVERSE[subjectName] || subjectName;
}

export function resolveSubjectNames(subjectIds: string[]): string {
  return subjectIds.map(resolveSubjectName).join('、');
}

// ── Class ID ↔ Name ────────────────────────────────────────

const CLASS_MAP: Record<string, string> = {
  class_701: '七(1)班',
  class_702: '七(2)班',
  class_703: '七(3)班',
  class_801: '八(1)班',
  class_802: '八(2)班',
  class_803: '八(3)班',
  class_901: '九(1)班',
  class_902: '九(2)班',
  class_903: '九(3)班',
};

const CLASS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CLASS_MAP).map(([k, v]) => [v, k]),
);

export function resolveClassName(classId: string): string {
  return CLASS_MAP[classId] || classId;
}

export function resolveClassId(className: string): string {
  return CLASS_REVERSE[className] || className;
}

// ── Version Formatting ─────────────────────────────────────

export function formatVersion(version: number): string {
  return `v${version}.0`;
}

// ── Activity Detail Serialization ──────────────────────────

export function formatActivityDetail(
  detail: Record<string, any> | null | undefined,
): string {
  if (!detail) return '';

  if (detail.desc) return String(detail.desc);
  if (detail.source === 'template') return '从模板创建';
  if (detail.source === 'lesson_plan') return '从教案保存';
  if (detail.field === 'blocks' && detail.count != null)
    return `更新了 ${detail.count} 个内容块`;
  if (detail.field) return `更新了${detail.field}`;
  if (detail.requirement_id) return '关联了学业要求';
  if (detail.exercise_ids)
    return `关联了 ${detail.exercise_ids.length} 道习题`;
  if (detail.count != null) return `${detail.count} 份`;
  if (detail.version) return detail.version;
  if (detail.class) return String(detail.class);
  if (detail.target_scope) return `推优至${detail.target_scope}`;
  if (detail.from_scope && detail.to_scope)
    return `从${detail.from_scope}推优至${detail.to_scope}`;

  return JSON.stringify(detail);
}
