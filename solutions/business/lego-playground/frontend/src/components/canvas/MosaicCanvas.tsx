import React, { useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Group } from 'react-konva';
import { useMosaicStore } from '../../hooks/useStore';
import type { Placement, LegoColor, BrickPart } from '../../types';

const STUD_SIZE = 16;

/**
 * Rotate a coverage pattern offset by the given rotation angle.
 */
function rotateOffset(
  dx: number,
  dy: number,
  rotation: 0 | 90 | 180 | 270
): { dx: number; dy: number } {
  switch (rotation) {
    case 0:
      return { dx, dy };
    case 90:
      return { dx: -dy, dy: dx };
    case 180:
      return { dx: -dx, dy: -dy };
    case 270:
      return { dx: dy, dy: -dx };
  }
}

export default function MosaicCanvas() {
  const placements = useMosaicStore((s) => s.placements);
  const config = useMosaicStore((s) => s.config);
  const colors = useMosaicStore((s) => s.colors);
  const bricks = useMosaicStore((s) => s.bricks);
  const visibleLayers = useMosaicStore((s) => s.visibleLayers);
  const zoom = useMosaicStore((s) => s.canvasZoom);
  const setCanvasZoom = useMosaicStore((s) => s.setCanvasZoom);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build color lookup map
  const colorMap = useMemo(() => {
    const map = new Map<number, LegoColor>();
    for (const c of colors) {
      map.set(c.bricklinkId, c);
    }
    return map;
  }, [colors]);

  // Build brick lookup map
  const brickMap = useMemo(() => {
    const map = new Map<string, BrickPart>();
    for (const b of bricks) {
      map.set(b.bricklinkId, b);
    }
    return map;
  }, [bricks]);

  // Filter placements by visible layers
  const visiblePlacements = useMemo(() => {
    return placements.filter((p) => visibleLayers[p.layer] !== false);
  }, [placements, visibleLayers]);

  // Canvas dimensions
  const canvasWidth = config.widthStuds * STUD_SIZE;
  const canvasHeight = config.heightStuds * STUD_SIZE;

  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const scaleBy = 1.1;
      const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
      setCanvasZoom(newZoom);
    },
    [zoom, setCanvasZoom]
  );

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto bg-zinc-200">
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          onWheel={handleWheel}
          draggable
        >
          <Layer>
            {/* Background grid */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="#E5E7EB"
            />

            {/* Render placements */}
            {visiblePlacements.map((placement, i) => {
              const color = colorMap.get(placement.colorId);
              const hex = color?.hex || '#CCCCCC';
              const brick = brickMap.get(placement.brickId);
              const isRound = brick?.partType === 'round_plate' || brick?.partType === 'round_tile';
              const isTile = brick?.partType === 'tile' || brick?.partType === 'round_tile';

              // Compute rotated coverage offsets
              const pattern = brick?.coveragePattern || [{ x: 0, y: 0 }];
              const rotatedOffsets = pattern.map((p) =>
                rotateOffset(p.x, p.y, placement.rotation)
              );

              // Bounding box in stud coordinates (relative to placement origin)
              const minDx = Math.min(...rotatedOffsets.map((o) => o.dx));
              const minDy = Math.min(...rotatedOffsets.map((o) => o.dy));
              const maxDx = Math.max(...rotatedOffsets.map((o) => o.dx));
              const maxDy = Math.max(...rotatedOffsets.map((o) => o.dy));

              const bboxX = (placement.x + minDx) * STUD_SIZE;
              const bboxY = (placement.y + minDy) * STUD_SIZE;
              const bboxW = (maxDx - minDx + 1) * STUD_SIZE;
              const bboxH = (maxDy - minDy + 1) * STUD_SIZE;

              const key = `${placement.layer}-${placement.x}-${placement.y}-${i}`;

              if (isRound && rotatedOffsets.length === 1) {
                // Round 1x1 brick: render as circle
                const cx = (placement.x + rotatedOffsets[0].dx) * STUD_SIZE + STUD_SIZE / 2;
                const cy = (placement.y + rotatedOffsets[0].dy) * STUD_SIZE + STUD_SIZE / 2;
                return (
                  <Group key={key}>
                    <Circle
                      x={cx}
                      y={cy}
                      radius={STUD_SIZE / 2 - 0.5}
                      fill={hex}
                      stroke="#00000040"
                      strokeWidth={0.75}
                    />
                    {!isTile && (
                      <Circle
                        x={cx}
                        y={cy}
                        radius={STUD_SIZE * 0.25}
                        stroke="#00000020"
                        strokeWidth={0.5}
                      />
                    )}
                  </Group>
                );
              }

              // Rectangular brick: render body + stud dots
              return (
                <Group key={key}>
                  {/* Brick body */}
                  <Rect
                    x={bboxX}
                    y={bboxY}
                    width={bboxW}
                    height={bboxH}
                    fill={hex}
                    stroke="#00000040"
                    strokeWidth={0.75}
                    cornerRadius={1}
                  />
                  {/* Stud circles (only for plates, not tiles) */}
                  {!isTile &&
                    rotatedOffsets.map((offset, j) => {
                      const sx = (placement.x + offset.dx) * STUD_SIZE + STUD_SIZE / 2;
                      const sy = (placement.y + offset.dy) * STUD_SIZE + STUD_SIZE / 2;
                      return (
                        <Circle
                          key={j}
                          x={sx}
                          y={sy}
                          radius={STUD_SIZE * 0.25}
                          stroke="#00000020"
                          strokeWidth={0.5}
                        />
                      );
                    })}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
