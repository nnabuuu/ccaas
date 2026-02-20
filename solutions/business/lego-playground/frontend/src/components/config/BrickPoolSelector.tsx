import React from 'react';
import { useMosaicStore } from '../../hooks/useStore';

export default function BrickPoolSelector() {
  const bricks = useMosaicStore((s) => s.bricks);
  const pool = useMosaicStore((s) => s.config.brickPool);
  const toggleBrick = useMosaicStore((s) => s.toggleBrick);

  const useDefaults = () => {
    const defaults = bricks.filter((b) => b.isDefault).map((b) => b.bricklinkId);
    useMosaicStore.getState().setConfig({ brickPool: defaults });
  };

  const partTypes = ['plate', 'tile', 'round_plate', 'round_tile'] as const;
  const typeLabels: Record<string, string> = {
    plate: 'Plates',
    tile: 'Tiles',
    round_plate: 'Round Plates',
    round_tile: 'Round Tiles',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">
          Bricks {pool.length > 0 && <span className="text-blue-500">({pool.length})</span>}
        </label>
        <button onClick={useDefaults} className="text-[10px] text-blue-500 hover:underline">
          Defaults
        </button>
      </div>

      <div className="space-y-1.5">
        {partTypes.map((type) => {
          const typeBricks = bricks.filter((b) => b.partType === type);
          if (typeBricks.length === 0) return null;

          return (
            <div key={type}>
              <p className="text-[10px] text-gray-400 mb-0.5">{typeLabels[type]}</p>
              <div className="flex flex-wrap gap-1">
                {typeBricks.map((brick) => {
                  const selected = pool.includes(brick.bricklinkId);
                  return (
                    <button
                      key={brick.bricklinkId}
                      onClick={() => toggleBrick(brick.bricklinkId)}
                      title={`${brick.name} (${brick.nameZh})`}
                      className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {brick.widthStuds}×{brick.heightStuds}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
