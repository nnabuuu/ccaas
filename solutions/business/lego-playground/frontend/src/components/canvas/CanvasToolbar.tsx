import React from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import { useMosaicStore } from '../../hooks/useStore';

export default function CanvasToolbar() {
  const config = useMosaicStore((s) => s.config);
  const zoom = useMosaicStore((s) => s.canvasZoom);
  const setCanvasZoom = useMosaicStore((s) => s.setCanvasZoom);
  const visibleLayers = useMosaicStore((s) => s.visibleLayers);
  const toggleLayerVisibility = useMosaicStore((s) => s.toggleLayerVisibility);
  const showOriginalOverlay = useMosaicStore((s) => s.showOriginalOverlay);
  const setShowOriginalOverlay = useMosaicStore((s) => s.setShowOriginalOverlay);
  const placements = useMosaicStore((s) => s.placements);

  if (placements.length === 0) return null;

  return (
    <div className="h-9 flex items-center px-3 gap-2 bg-white border-b border-zinc-200 shrink-0">
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        <button
          onClick={() => setCanvasZoom(zoom / 1.2)}
          className="w-6 h-6 rounded hover:bg-zinc-100 flex items-center justify-center"
        >
          <Minus size={14} weight="regular" />
        </button>
        <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setCanvasZoom(zoom * 1.2)}
          className="w-6 h-6 rounded hover:bg-zinc-100 flex items-center justify-center"
        >
          <Plus size={14} weight="regular" />
        </button>
        <button
          onClick={() => setCanvasZoom(1)}
          className="px-1.5 py-0.5 rounded hover:bg-zinc-100 text-[10px]"
        >
          Fit
        </button>
      </div>

      <div className="w-px h-4 bg-zinc-200" />

      <div className="flex items-center gap-1 text-xs">
        {Array.from({ length: config.layerCount }, (_, i) => (
          <button
            key={i}
            onClick={() => toggleLayerVisibility(i)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              visibleLayers[i]
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-zinc-100 text-zinc-400 border border-transparent'
            }`}
          >
            L{i + 1}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-zinc-200" />

      <button
        onClick={() => setShowOriginalOverlay(!showOriginalOverlay)}
        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
          showOriginalOverlay
            ? 'bg-purple-50 text-purple-700'
            : 'text-zinc-500 hover:bg-zinc-100'
        }`}
      >
        Compare
      </button>
    </div>
  );
}
