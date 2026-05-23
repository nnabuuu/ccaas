import { describe, it, expect } from 'vitest';
import { t, registerLocale, getAvailableLocales } from '../core/i18n';

describe('§16 i18n helper', () => {
  it('returns zh-CN string by default', () => {
    expect(t('preview.btn.submit')).toBe('提交 / 检查');
    expect(t('preview.brand', 'zh-CN')).toBe('Exercise Preview');
  });

  it('returns en string when requested', () => {
    expect(t('preview.btn.submit', 'en')).toBe('Submit / Check');
    expect(t('preview.role.teacher', 'en')).toBe('Teacher');
  });

  it('falls back to default locale when missing in requested', () => {
    registerLocale('zh-CN', { 'test.only.zh': '只有中文' });
    expect(t('test.only.zh', 'en')).toBe('只有中文'); // falls back to zh-CN
  });

  it('falls back to key when missing in all locales', () => {
    expect(t('completely.nonexistent.key')).toBe('completely.nonexistent.key');
  });

  it('registerLocale extends strings', () => {
    registerLocale('en', { 'plugin.long-division.title': 'Long Division' });
    expect(t('plugin.long-division.title', 'en')).toBe('Long Division');
  });

  it('lists available locales', () => {
    const locales = getAvailableLocales();
    expect(locales).toContain('zh-CN');
    expect(locales).toContain('en');
  });
});
