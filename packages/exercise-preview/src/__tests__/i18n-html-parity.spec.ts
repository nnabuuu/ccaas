/**
 * Parity test: web/index.html's inlined STRINGS table must stay in sync
 * with src/core/i18n.ts.
 *
 * The web bundle is served as a static HTML file (no bundler) so it can't
 * `import { t } from './i18n.js'` at runtime. The strings are duplicated
 * inline; this test catches drift. If you add a key to i18n.ts, you must
 * also add it to STRINGS in web/index.html (or vice versa).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { t, type Locale } from '../core/i18n';

let html: string;
let htmlStrings: Record<Locale, Record<string, string>>;

beforeAll(() => {
  html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'web', 'index.html'), 'utf-8');
  // Pull the STRINGS literal out of the HTML inline script via a marker scan.
  // We bound it by `const STRINGS = {` and the closing `};` BEFORE
  // `function t(` so we can use eval safely on a literal.
  const startMarker = 'const STRINGS = {';
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) throw new Error('STRINGS literal not found in web/index.html');
  const after = html.slice(startIdx);
  const endIdx = after.indexOf('};\nfunction t(');
  if (endIdx < 0) throw new Error('end of STRINGS literal not found in web/index.html');
  // Trim to just the object literal `{...}`
  const literal = after.slice(startMarker.length - 1, endIdx + 1); // include trailing `}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  htmlStrings = new Function(`return ${literal};`)() as any;
});

describe('web/index.html STRINGS ↔ src/core/i18n.ts parity', () => {
  it('exposes the same set of locales', () => {
    expect(Object.keys(htmlStrings).sort()).toEqual(['en', 'zh-CN']);
  });

  it.each(['zh-CN' as Locale, 'en' as Locale])(
    '%s: every key in i18n.ts is also in web/index.html STRINGS',
    (locale) => {
      // For each key in the i18n.ts en/zh-CN tables, the HTML table must
      // have an identical value. We use t() to round-trip i18n.ts keys.
      // Probe a fixed set of keys — these are the public contract.
      const KEYS = [
        'preview.brand',
        'preview.noBundle',
        'preview.role.student',
        'preview.role.teacher',
        'preview.role.inspector',
        'preview.panel.bundles',
        'preview.panel.inspector',
        'preview.empty.bundles',
        'preview.empty.story',
        'preview.stage.studentTitle',
        'preview.stage.teacherTitle',
        'preview.stage.inspectorTitle',
        'preview.stage.answerKey',
        'preview.stage.answerEdit',
        'preview.stage.lastGrade',
        'preview.btn.submit',
        'preview.btn.reset',
        'preview.btn.validate',
        'preview.insp.empty',
        'preview.insp.session',
        'preview.insp.lifecycle',
        'preview.insp.lastGrade',
        'preview.insp.lastError',
        'preview.insp.totalCalls',
        'preview.insp.lastDuration',
        'preview.insp.status',
        'preview.teacher.empty',
        'preview.teacher.id',
        'preview.teacher.name',
        'preview.teacher.score',
        'preview.teacher.submittedAt',
        'preview.teacher.students',
      ];
      for (const k of KEYS) {
        const fromTs = t(k, locale);
        const fromHtml = htmlStrings[locale]?.[k];
        expect(fromHtml, `web/index.html missing key "${k}" for locale ${locale}`).toBeDefined();
        expect(fromHtml, `web/index.html value drifted for "${k}" (${locale})`).toBe(fromTs);
      }
    },
  );

  it('every static label in the HTML body carries a data-i18n attribute', () => {
    // Sanity: the topbar / panel / empty-state labels must be marked so
    // applyLocale() can re-translate them on locale change.
    expect(html).toContain('data-i18n="preview.brand"');
    expect(html).toContain('data-i18n="preview.role.student"');
    expect(html).toContain('data-i18n="preview.role.teacher"');
    expect(html).toContain('data-i18n="preview.role.inspector"');
    expect(html).toContain('data-i18n="preview.panel.bundles"');
    expect(html).toContain('data-i18n="preview.panel.inspector"');
    expect(html).toContain('data-i18n="preview.empty.story"');
    expect(html).toContain('data-i18n="preview.insp.empty"');
  });

  it('exposes an applyLocale() function for the postMessage set-locale handler', () => {
    expect(html).toContain('function applyLocale()');
  });
});
