import React, { useState } from 'react';
import { useMosaicStore } from '../../hooks/useStore';

export default function ColorPaletteGrid() {
  const colors = useMosaicStore((s) => s.colors);
  const palette = useMosaicStore((s) => s.config.colorPalette);
  const toggleColor = useMosaicStore((s) => s.toggleColor);
  const [search, setSearch] = useState('');
  const [showTransparent, setShowTransparent] = useState(false);

  const filtered = colors.filter((c) => {
    if (!showTransparent && c.isTransparent) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.nameZh.includes(q);
    }
    return true;
  });

  const selectAll = () => {
    const ids = filtered.map((c) => c.bricklinkId);
    useMosaicStore.getState().setConfig({ colorPalette: ids });
  };

  const clearAll = () => {
    useMosaicStore.getState().setConfig({ colorPalette: [] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-zinc-500">
          Colors {palette.length > 0 && <span className="text-blue-500">({palette.length})</span>}
        </label>
        <div className="flex gap-1">
          <button onClick={selectAll} className="text-[10px] text-blue-500 hover:underline">
            All
          </button>
          <button onClick={clearAll} className="text-[10px] text-zinc-400 hover:underline">
            Clear
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search colors..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-zinc-200 rounded px-2 py-1 text-xs mb-1.5"
      />

      <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto">
        {filtered.map((color) => {
          const selected = palette.includes(color.bricklinkId);
          return (
            <button
              key={color.bricklinkId}
              onClick={() => toggleColor(color.bricklinkId)}
              title={`${color.name} (${color.nameZh})`}
              className={`w-full aspect-square rounded-sm border-2 transition-all ${
                selected
                  ? 'border-blue-500 scale-110 shadow-sm'
                  : 'border-transparent hover:border-zinc-300'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>

      <label className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500 cursor-pointer">
        <input
          type="checkbox"
          checked={showTransparent}
          onChange={(e) => setShowTransparent(e.target.checked)}
          className="w-3 h-3"
        />
        Show transparent
      </label>
    </div>
  );
}
