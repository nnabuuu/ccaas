import React from 'react';
import { useMosaicStore } from '../../hooks/useStore';
import ImageUploadZone from './ImageUploadZone';
import DimensionControls from './DimensionControls';
import ColorPaletteGrid from './ColorPaletteGrid';
import BrickPoolSelector from './BrickPoolSelector';

export default function ConfigPanel() {
  const config = useMosaicStore((s) => s.config);

  return (
    <div className="p-3 space-y-4">
      <ImageUploadZone />

      <DimensionControls />

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">Layers</label>
        <div className="flex gap-2">
          {[2, 3].map((n) => (
            <button
              key={n}
              onClick={() => useMosaicStore.getState().setConfig({ layerCount: n as 2 | 3 })}
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                config.layerCount === n
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n} Layers
            </button>
          ))}
        </div>
      </div>

      <ColorPaletteGrid />

      <BrickPoolSelector />

      {/* Advanced Options */}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700 py-1">
          Advanced Options
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-gray-600 block mb-1">Resampling</label>
            <select
              value={config.resampling}
              onChange={(e) =>
                useMosaicStore.getState().setConfig({
                  resampling: e.target.value as 'lanczos' | 'mitchell',
                })
              }
              className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
            >
              <option value="lanczos">Lanczos (Sharper)</option>
              <option value="mitchell">Mitchell (Smoother)</option>
            </select>
          </div>
          <div>
            <label className="text-gray-600 block mb-1">Background Color</label>
            <input
              type="color"
              value={config.backgroundColor}
              onChange={(e) =>
                useMosaicStore.getState().setConfig({ backgroundColor: e.target.value })
              }
              className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
