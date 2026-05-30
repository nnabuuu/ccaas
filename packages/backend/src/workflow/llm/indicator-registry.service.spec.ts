/**
 * IndicatorRegistryService unit tests — pins the M5 pass-1 MF3 tenant
 * isolation invariants + the pass-2 N4 delimiter hardening.
 */

import { IndicatorRegistryService, type IndicatorDef } from './indicator-registry.service';

const A: IndicatorDef = { id: 'K1', type: 'knowledge', label: 'a', description: '' };
const B: IndicatorDef = { id: 'M1', type: 'misconception', label: 'b', description: '' };

describe('IndicatorRegistryService', () => {
  let svc: IndicatorRegistryService;

  beforeEach(() => {
    svc = new IndicatorRegistryService();
  });

  it('returns [] for an unknown (tenant, session)', () => {
    expect(svc.getIndicators('tenant-a', 'sess-1')).toEqual([]);
  });

  it('PUT semantics: setIndicators replaces the catalog under (tenant, session)', () => {
    svc.setIndicators('tenant-a', 'sess-1', [A]);
    svc.setIndicators('tenant-a', 'sess-1', [B]);
    expect(svc.getIndicators('tenant-a', 'sess-1')).toEqual([B]);
  });

  it('M5 pass-1 MF3: tenant A cannot read tenant B catalog (cross-tenant isolation)', () => {
    svc.setIndicators('tenant-a', 'shared-session', [A]);
    svc.setIndicators('tenant-b', 'shared-session', [B]);
    expect(svc.getIndicators('tenant-a', 'shared-session')).toEqual([A]);
    expect(svc.getIndicators('tenant-b', 'shared-session')).toEqual([B]);
    // And explicitly: neither tenant sees the other's data when only one is registered.
    svc.setIndicators('tenant-c', 'session-c', [A]);
    expect(svc.getIndicators('tenant-d', 'session-c')).toEqual([]);
  });

  it('clearSession drops entries across all tenants for the given sessionId', () => {
    svc.setIndicators('tenant-a', 'sess-1', [A]);
    svc.setIndicators('tenant-b', 'sess-1', [B]);
    svc.setIndicators('tenant-a', 'sess-2', [A]);
    svc.clearSession('sess-1');
    expect(svc.getIndicators('tenant-a', 'sess-1')).toEqual([]);
    expect(svc.getIndicators('tenant-b', 'sess-1')).toEqual([]);
    // Untouched session still present.
    expect(svc.getIndicators('tenant-a', 'sess-2')).toEqual([A]);
  });

  it('M5 pass-2 N4: clearSession does NOT drop entries whose sessionId is a partial suffix of another', () => {
    // sessionId 'foo' must not accidentally clear an entry where the
    // sessionId is 'barfoo' or '-foo'. Pre-N4 the delimiter was a single
    // space, which a hostile/oddly-shaped solutionId could be confused
    // with; the unit-separator delimiter `\x1f` makes the endsWith
    // suffix check tight by construction.
    svc.setIndicators('tenant-a', 'foo', [A]);
    svc.setIndicators('tenant-a', 'barfoo', [B]);
    svc.clearSession('foo');
    expect(svc.getIndicators('tenant-a', 'foo')).toEqual([]);
    // The 'barfoo' entry is untouched because the suffix is `\x1ffoo`,
    // not `foo`.
    expect(svc.getIndicators('tenant-a', 'barfoo')).toEqual([B]);
  });

  it('M6 pass-2 SF3: clearTenantSession only drops the (solutionId, sessionId) tuple', () => {
    // Tenant A's DELETE for a shared sessionId must NOT touch tenant B's
    // catalog. The broad clearSession (used by engine teardown) DOES
    // drop both; clearTenantSession is the auth-boundary-respecting
    // variant.
    svc.setIndicators('tenant-a', 'shared-session', [A]);
    svc.setIndicators('tenant-b', 'shared-session', [B]);
    svc.clearTenantSession('tenant-a', 'shared-session');
    expect(svc.getIndicators('tenant-a', 'shared-session')).toEqual([]);
    expect(svc.getIndicators('tenant-b', 'shared-session')).toEqual([B]);
  });

  it('reset() empties the registry', () => {
    svc.setIndicators('tenant-a', 'sess-1', [A]);
    svc.reset();
    expect(svc.getIndicators('tenant-a', 'sess-1')).toEqual([]);
  });
});
