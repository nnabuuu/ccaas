import React from 'react';
import { useMosaicStore } from '../../hooks/useStore';
import MosaicCanvas from './MosaicCanvas';
import CanvasToolbar from './CanvasToolbar';
import IterationTimeline from '../history/IterationTimeline';
import BillOfMaterials from '../bom/BillOfMaterials';

export default function CanvasWorkspace() {
  const placements = useMosaicStore((s) => s.placements);
  const generationStatus = useMosaicStore((s) => s.generationStatus);

  const isLoading =
    generationStatus.phase === 'analyzing' ||
    generationStatus.phase === 'generating' ||
    generationStatus.phase === 'assessing';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <CanvasToolbar />

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {placements.length > 0 ? (
          <MosaicCanvas />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isLoading ? (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">{generationStatus.message || 'Processing...'}</p>
                {generationStatus.progress > 0 && (
                  <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-2 mx-auto">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${generationStatus.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-2">🧱</div>
                <p className="text-sm">Upload an image and generate a mosaic</p>
                <p className="text-xs mt-1">or chat with AI to get started</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Iteration Timeline */}
      <IterationTimeline />

      {/* BOM Drawer */}
      <BillOfMaterials />
    </div>
  );
}
