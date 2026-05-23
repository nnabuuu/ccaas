import { StateCacheService } from './state-cache.service';

describe('StateCacheService', () => {
  let service: StateCacheService;

  beforeEach(() => {
    service = new StateCacheService();
    jest.restoreAllMocks();
  });

  it('returns null for unknown session', () => {
    expect(service.get('unknown')).toBeNull();
  });

  it('returns cached state within TTL', () => {
    const state = { sessionStatus: 'active' } as any;
    service.set('s1', state);
    expect(service.get('s1')).toBe(state);
  });

  it('returns null after TTL expires', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    service.set('s1', { sessionStatus: 'active' } as any);

    jest.spyOn(Date, 'now').mockReturnValue(now + 2001);
    expect(service.get('s1')).toBeNull();
  });

  it('returns cached state at TTL boundary', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const state = { sessionStatus: 'active' } as any;
    service.set('s1', state);

    jest.spyOn(Date, 'now').mockReturnValue(now + 2000);
    expect(service.get('s1')).toBe(state);
  });

  it('markDirty invalidates cache', () => {
    service.set('s1', { sessionStatus: 'active' } as any);
    service.markDirty('s1');
    expect(service.get('s1')).toBeNull();
  });

  it('clear is alias for markDirty', () => {
    service.set('s1', { sessionStatus: 'active' } as any);
    service.clear('s1');
    expect(service.get('s1')).toBeNull();
  });

  it('markDirty on non-existent key is a no-op', () => {
    expect(() => service.markDirty('nonexistent')).not.toThrow();
  });

  it('set overwrites previous entry', () => {
    service.set('s1', { sessionStatus: 'active' } as any);
    const updated = { sessionStatus: 'ended' } as any;
    service.set('s1', updated);
    expect(service.get('s1')).toBe(updated);
  });

  it('isolates sessions from each other', () => {
    const s1 = { sessionStatus: 'active' } as any;
    const s2 = { sessionStatus: 'ended' } as any;
    service.set('s1', s1);
    service.set('s2', s2);
    service.markDirty('s1');
    expect(service.get('s1')).toBeNull();
    expect(service.get('s2')).toBe(s2);
  });
});
