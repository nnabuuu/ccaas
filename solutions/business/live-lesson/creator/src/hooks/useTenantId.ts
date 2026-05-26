/**
 * useTenantId — resolve the ccaas tenantId attached to the current
 * API key. Cached at module level so multiple AiPanel mounts don't
 * each fire a `/auth/me` request.
 *
 * Returned `tenantId === null` means "no valid key" → the UI should
 * show the "paste your key" banner; chat will still mount but
 * bind-project will be skipped (graceful degrade).
 *
 * The cache invalidates when `localStorage.ccaas:apiKey` changes —
 * pasting a new key in DevTools + refreshing is enough for now;
 * cross-tab `storage` event-based invalidation can come later.
 */

import { useEffect, useState } from 'react';
import { fetchMe, getApiKey, type CcaasMe } from '../api/ccaas';

let cachePromise: Promise<CcaasMe | null> | null = null;
let cachedForKey: string | null = null;

function getOrFetch(): Promise<CcaasMe | null> {
  const key = getApiKey();
  // Invalidate cache on key change so a fresh paste takes effect
  // without a hard reload (the storage event from another tab also
  // bumps `localStorage` reads).
  if (cachedForKey !== key) {
    cachePromise = null;
    cachedForKey = key;
  }
  if (!cachePromise) {
    cachePromise = fetchMe().catch(() => null);
  }
  return cachePromise;
}

export interface TenantState {
  tenantId: string | null;
  tenantSlug: string | null;
  scopes: string[];
  isAnonymous: boolean;
  isLoading: boolean;
  /** Set when the fetch itself errored (network, server crash). 401/403 is silent. */
  error: Error | null;
}

export function useTenantId(): TenantState {
  const [state, setState] = useState<TenantState>({
    tenantId: null,
    tenantSlug: null,
    scopes: [],
    isAnonymous: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    getOrFetch()
      .then((me) => {
        if (!alive) return;
        if (!me) {
          setState({
            tenantId: null,
            tenantSlug: null,
            scopes: [],
            isAnonymous: false,
            isLoading: false,
            error: null,
          });
          return;
        }
        setState({
          tenantId: me.tenantId,
          tenantSlug: me.tenantSlug,
          scopes: me.scopes ?? [],
          isAnonymous: me.isAnonymous,
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (!alive) return;
        setState((s) => ({ ...s, isLoading: false, error: err }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
