import { useEffect } from 'react';
import { useMosaicStore } from './useStore';
import { fetchCatalogColors, fetchCatalogBricks } from '../utils/api';
import type { LegoColor, BrickPart } from '../types';

export function useCatalog() {
  const catalogLoaded = useMosaicStore((s) => s.catalogLoaded);
  const setCatalog = useMosaicStore((s) => s.setCatalog);

  useEffect(() => {
    if (catalogLoaded) return;

    async function load() {
      try {
        const [colors, bricks] = await Promise.all([
          fetchCatalogColors() as Promise<LegoColor[]>,
          fetchCatalogBricks() as Promise<BrickPart[]>,
        ]);
        setCatalog(colors, bricks);
      } catch (err) {
        console.error('Failed to load catalog:', err);
      }
    }

    load();
  }, [catalogLoaded, setCatalog]);
}
