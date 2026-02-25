import React, { useState } from 'react';
import { Lock, LockOpen } from '@phosphor-icons/react';
import { useMosaicStore } from '../../hooks/useStore';

const PRESETS = [
  { label: '16x16', w: 16, h: 16 },
  { label: '32x32', w: 32, h: 32 },
  { label: '48x48', w: 48, h: 48 },
  { label: '64x64', w: 64, h: 64 },
];

export default function DimensionControls() {
  const config = useMosaicStore((s) => s.config);
  const setConfig = useMosaicStore((s) => s.setConfig);
  const [locked, setLocked] = useState(true);

  const handleWidth = (w: number) => {
    const clamped = Math.max(8, Math.min(128, w));
    if (locked) {
      const ratio = config.heightStuds / config.widthStuds;
      setConfig({ widthStuds: clamped, heightStuds: Math.round(clamped * ratio) });
    } else {
      setConfig({ widthStuds: clamped });
    }
  };

  const handleHeight = (h: number) => {
    const clamped = Math.max(8, Math.min(128, h));
    if (locked) {
      const ratio = config.widthStuds / config.heightStuds;
      setConfig({ heightStuds: clamped, widthStuds: Math.round(clamped * ratio) });
    } else {
      setConfig({ heightStuds: clamped });
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-zinc-500 block mb-1.5">Dimensions</label>

      <div className="flex gap-1 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setConfig({ widthStuds: p.w, heightStuds: p.h })}
            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
              config.widthStuds === p.w && config.heightStuds === p.h
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-5">W</span>
          <input
            type="range"
            min={8}
            max={128}
            value={config.widthStuds}
            onChange={(e) => handleWidth(Number(e.target.value))}
            className="flex-1 h-1 accent-blue-500"
          />
          <span className="text-xs text-zinc-700 w-8 text-right">{config.widthStuds}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-5">H</span>
          <input
            type="range"
            min={8}
            max={128}
            value={config.heightStuds}
            onChange={(e) => handleHeight(Number(e.target.value))}
            className="flex-1 h-1 accent-blue-500"
          />
          <span className="text-xs text-zinc-700 w-8 text-right">{config.heightStuds}</span>
        </div>
      </div>

      <button
        onClick={() => setLocked(!locked)}
        className={`mt-1 text-[10px] px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1 ${
          locked ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-500'
        }`}
      >
        {locked ? <Lock size={12} weight="regular" /> : <LockOpen size={12} weight="regular" />}
        {locked ? 'Locked' : 'Unlocked'}
      </button>
    </div>
  );
}
