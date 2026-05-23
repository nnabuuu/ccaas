/**
 * Minimal i18n helper for the preview platform (§16).
 *
 * Avoids the react-i18next dependency in v1 — preview UI is plain JS, so we
 * just need a tiny `t(key, locale)` lookup table. The locale defaults to
 * zh-CN; en falls back to the key when no translation exists. Plugin authors
 * can extend strings via `registerLocale()`.
 *
 * v2 will swap this for react-i18next when the public demo (P4) ships, per
 * docs/exercise-plugin-preview-design.md §16.4. The key set defined here
 * is the contract that v2 translations must cover.
 */

export type Locale = 'zh-CN' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh-CN';

const strings: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    // Top bar
    'preview.brand': 'Exercise Preview',
    'preview.noBundle': '尚未加载 bundle',
    // Roles
    'preview.role.student': '学生视角',
    'preview.role.teacher': '教师视角',
    'preview.role.inspector': 'Inspector',
    // Panels
    'preview.panel.bundles': 'Bundles',
    'preview.panel.inspector': 'Inspector',
    'preview.empty.bundles': '未找到 bundle。添加 *.stories.ts (defineStories)。',
    'preview.empty.story': '从左侧选择一个 story 开始。',
    // Stage
    'preview.stage.studentTitle': '学生视图',
    'preview.stage.teacherTitle': '教师视图',
    'preview.stage.inspectorTitle': 'Inspector 视图',
    'preview.stage.answerKey': 'AnswerKey（学生可见的安全字段）',
    'preview.stage.answerEdit': '学生答案 (data) — 编辑 JSON 模拟输入',
    'preview.stage.lastGrade': '上次评分结果',
    'preview.btn.submit': '提交 / 检查',
    'preview.btn.reset': '重置',
    'preview.btn.validate': '校验',
    // Inspector
    'preview.insp.empty': '尚无 session。选择一个 story 开始。',
    'preview.insp.session': '会话',
    'preview.insp.lifecycle': 'Plugin 生命周期',
    'preview.insp.lastGrade': '上次评分',
    'preview.insp.lastError': '上次错误',
    'preview.insp.totalCalls': '总调用',
    'preview.insp.lastDuration': '上次耗时',
    'preview.insp.status': '状态',
    // Teacher
    'preview.teacher.empty': '此 story 未提供 classSubmissions。在 story 中加入数组以预览教师面板。',
    'preview.teacher.id': 'ID',
    'preview.teacher.name': '姓名',
    'preview.teacher.score': '得分',
    'preview.teacher.submittedAt': '提交时间',
    'preview.teacher.students': '学生',
  },
  en: {
    'preview.brand': 'Exercise Preview',
    'preview.noBundle': 'no bundle loaded',
    'preview.role.student': 'Student',
    'preview.role.teacher': 'Teacher',
    'preview.role.inspector': 'Inspector',
    'preview.panel.bundles': 'Bundles',
    'preview.panel.inspector': 'Inspector',
    'preview.empty.bundles': 'No bundles found. Add *.stories.ts (defineStories).',
    'preview.empty.story': 'Pick a story on the left.',
    'preview.stage.studentTitle': 'Student View',
    'preview.stage.teacherTitle': 'Teacher View',
    'preview.stage.inspectorTitle': 'Inspector Stage',
    'preview.stage.answerKey': 'AnswerKey (student-safe sanitized)',
    'preview.stage.answerEdit': 'Student Answer (data) — edit JSON to simulate input',
    'preview.stage.lastGrade': 'Last Grade Result',
    'preview.btn.submit': 'Submit / Check',
    'preview.btn.reset': 'Reset',
    'preview.btn.validate': 'Validate',
    'preview.insp.empty': 'No session yet. Pick a story to start.',
    'preview.insp.session': 'Session',
    'preview.insp.lifecycle': 'Plugin Lifecycle',
    'preview.insp.lastGrade': 'Last Grade',
    'preview.insp.lastError': 'Last Error',
    'preview.insp.totalCalls': 'total calls',
    'preview.insp.lastDuration': 'last duration',
    'preview.insp.status': 'status',
    'preview.teacher.empty': 'No classSubmissions on this story. Add an array to preview the teacher panel.',
    'preview.teacher.id': 'ID',
    'preview.teacher.name': 'Name',
    'preview.teacher.score': 'Score',
    'preview.teacher.submittedAt': 'Submitted',
    'preview.teacher.students': 'students',
  },
};

/** Look up a translation for a given key. Falls back to zh-CN, then the key itself. */
export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  return strings[locale]?.[key] ?? strings[DEFAULT_LOCALE]?.[key] ?? key;
}

/** Override or add strings for a locale (e.g. plugin-specific extension). */
export function registerLocale(locale: Locale, entries: Record<string, string>): void {
  strings[locale] = { ...strings[locale], ...entries };
}

/** All locales that have at least one string. */
export function getAvailableLocales(): Locale[] {
  return (Object.keys(strings) as Locale[]).filter((l) => Object.keys(strings[l] ?? {}).length > 0);
}
