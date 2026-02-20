import React from 'react';
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
    <div className="h-9 flex items-center px-3 gap-2 bg-white border-b border-gray-200 shrink-0">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <button
          onClick={() => setCanvasZoom(zoom / 1.2)}
          className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center"
        >
          −
        </button>
        <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setCanvasZoom(zoom * 1.2)}
          className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={() => setCanvasZoom(1)}
          className="px-1.5 py-0.5 rounded hover:bg-gray-100 text-[10px]"
        >
          Fit
        </button>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* Layer toggles */}
      <div className="flex items-center gap-1 text-xs">
        {Array.from({ length: config.layerCount }, (_, i) => (
          <button
            key={i}
            onClick={() => toggleLayerVisibility(i)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              visibleLayers[i]
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-400 border border-transparent'
            }`}
          >
            L{i + 1}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* Compare toggle */}
      <button
        onClick={() => setShowOriginalOverlay(!showOriginalOverlay)}
        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
          showOriginalOverlay
            ? 'bg-purple-50 text-purple-700'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        Compare
      </button>
    </div>
  );
}
