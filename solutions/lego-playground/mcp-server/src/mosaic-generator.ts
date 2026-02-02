/**
 * Mosaic Generator - Convert images to LEGO brick placements
 *
 * Algorithm:
 * 1. Resize image to target stud dimensions
 * 2. Map each pixel to nearest LEGO color using CIEDE2000
 * 3. Greedy largest-first brick placement with staggered joints
 * 4. Calculate BOM from placements
 */

import sharp from 'sharp';
import { findNearestColor, getBrickById, loadBricks } from './lego-catalog.js';
import type {
  MosaicConfig,
  MosaicResult,
  Placement,
  BillItem,
  BrickPart,
  RefinementInput,
  RegionEdit,
} from './types.js';

interface ColorGrid {
  width: number;
  height: number;
  /** colorId at each [y][x] position */
  cells: number[][];
}

/**
 * Resize image and map each pixel to nearest LEGO color
 */
async function imageToColorGrid(
  imagePath: string,
  config: MosaicConfig
): Promise<ColorGrid> {
  const { widthStuds, heightStuds, resampling, backgroundColor, colorPalette } = config;

  const kernel = resampling === 'mitchell' ? 'mitchell' : 'lanczos3';

  // Read and resize
  const { data } = await sharp(imagePath)
    .flatten({ background: backgroundColor })
    .resize(widthStuds, heightStuds, { fit: 'fill', kernel })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cells: number[][] = [];
  const palette = colorPalette.length > 0 ? colorPalette : undefined;

  for (let y = 0; y < heightStuds; y++) {
    const row: number[] = [];
    for (let x = 0; x < widthStuds; x++) {
      const idx = (y * widthStuds + x) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const nearest = findNearestColor(r, g, b, palette);
      row.push(nearest.color.bricklinkId);
    }
    cells.push(row);
  }

  return { width: widthStuds, height: heightStuds, cells };
}

/**
 * Sort bricks by area (largest first) for greedy placement
 */
function sortBricksByArea(brickPool: string[]): BrickPart[] {
  const allBricks = loadBricks();
  const poolBricks = brickPool.length > 0
    ? allBricks.filter((b) => brickPool.includes(b.bricklinkId))
    : allBricks.filter((b) => b.isDefault);

  return poolBricks.sort((a, b) => {
    const areaA = a.widthStuds * a.heightStuds;
    const areaB = b.widthStuds * b.heightStuds;
    return areaB - areaA; // Largest first
  });
}

/**
 * Check if a brick can be placed at position (x, y) on a given layer
 * All covered cells must have the same color and not be already occupied
 */
function canPlaceBrick(
  brick: BrickPart,
  x: number,
  y: number,
  colorGrid: ColorGrid,
  occupied: boolean[][],
  rotation: 0 | 90 | 180 | 270
): boolean {
  const pattern = getRotatedPattern(brick, rotation);
  const targetColor = colorGrid.cells[y]?.[x];
  if (targetColor === undefined) return false;

  for (const offset of pattern) {
    const px = x + offset.x;
    const py = y + offset.y;
    if (px < 0 || px >= colorGrid.width || py < 0 || py >= colorGrid.height) return false;
    if (occupied[py][px]) return false;
    if (colorGrid.cells[py][px] !== targetColor) return false;
  }

  return true;
}

/**
 * Get rotated coverage pattern
 */
function getRotatedPattern(
  brick: BrickPart,
  rotation: 0 | 90 | 180 | 270
): Array<{ x: number; y: number }> {
  if (rotation === 0) return brick.coveragePattern;

  return brick.coveragePattern.map(({ x, y }) => {
    switch (rotation) {
      case 90:
        return { x: -y, y: x };
      case 180:
        return { x: -x, y: -y };
      case 270:
        return { x: y, y: -x };
      default:
        return { x, y };
    }
  });
}

/**
 * Check staggered joint constraint:
 * Joints between bricks on adjacent layers should not align vertically
 */
function checkStaggeredJoint(
  x: number,
  y: number,
  brickWidth: number,
  layer: number,
  previousLayerJoints: Set<string>
): boolean {
  if (layer === 0) return true;
  // Check right edge of brick
  const rightEdge = x + brickWidth;
  const jointKey = `${rightEdge},${y}`;
  return !previousLayerJoints.has(jointKey);
}

/**
 * Greedy largest-first brick placement for one layer
 */
function placeLayer(
  colorGrid: ColorGrid,
  layerIndex: number,
  sortedBricks: BrickPart[],
  previousLayerJoints: Set<string>
): { placements: Placement[]; joints: Set<string> } {
  const placements: Placement[] = [];
  const joints = new Set<string>();
  const occupied: boolean[][] = Array.from({ length: colorGrid.height }, () =>
    new Array(colorGrid.width).fill(false)
  );

  // Scan all positions
  for (let y = 0; y < colorGrid.height; y++) {
    for (let x = 0; x < colorGrid.width; x++) {
      if (occupied[y][x]) continue;

      // Try each brick (largest first), then rotations
      let placed = false;
      for (const brick of sortedBricks) {
        for (const rotation of [0, 90] as const) {
          // Only try 0 and 90 for rectangular bricks
          if (rotation === 90 && brick.widthStuds === brick.heightStuds) continue;
          if (rotation === 90 && brick.coveragePattern.length === 1) continue;

          if (!canPlaceBrick(brick, x, y, colorGrid, occupied, rotation)) continue;

          const effectiveWidth = rotation === 90 ? brick.heightStuds : brick.widthStuds;
          if (!checkStaggeredJoint(x, y, effectiveWidth, layerIndex, previousLayerJoints)) {
            continue;
          }

          // Place the brick
          const pattern = getRotatedPattern(brick, rotation);
          for (const offset of pattern) {
            occupied[y + offset.y][x + offset.x] = true;
          }

          placements.push({
            brickId: brick.bricklinkId,
            colorId: colorGrid.cells[y][x],
            x,
            y,
            layer: layerIndex,
            rotation,
          });

          // Record joints (right edge)
          const rightEdge = x + effectiveWidth;
          if (rightEdge < colorGrid.width) {
            joints.add(`${rightEdge},${y}`);
          }

          placed = true;
          break;
        }
        if (placed) break;
      }

      // Fallback: place 1x1 if nothing else fits
      if (!placed) {
        occupied[y][x] = true;
        placements.push({
          brickId: '3024', // 1x1 plate
          colorId: colorGrid.cells[y][x],
          x,
          y,
          layer: layerIndex,
          rotation: 0,
        });
        joints.add(`${x + 1},${y}`);
      }
    }
  }

  return { placements, joints };
}

/**
 * Calculate Bill of Materials from placements
 */
function calculateBOM(placements: Placement[]): BillItem[] {
  const bomMap = new Map<string, BillItem>();

  for (const p of placements) {
    const key = `${p.brickId}:${p.colorId}`;
    const existing = bomMap.get(key);
    if (existing) {
      existing.quantity++;
    } else {
      bomMap.set(key, { brickId: p.brickId, colorId: p.colorId, quantity: 1 });
    }
  }

  return Array.from(bomMap.values()).sort((a, b) => b.quantity - a.quantity);
}

/**
 * Generate a LEGO mosaic from an AI-provided color grid.
 * The AI agent uses vision to understand the image and outputs a simplified
 * color grid (2D array of BrickLink color IDs). This function handles only
 * the deterministic brick packing and BOM calculation.
 */
export function generateMosaicFromGrid(
  colorGrid: number[][],
  config: MosaicConfig
): MosaicResult {
  const height = colorGrid.length;
  const width = height > 0 ? colorGrid[0].length : 0;

  const grid: ColorGrid = { width, height, cells: colorGrid };

  // Sort bricks for greedy placement
  const sortedBricks = sortBricksByArea(config.brickPool);

  // Place bricks layer by layer with staggered joints
  const allPlacements: Placement[] = [];
  let previousJoints = new Set<string>();

  for (let layer = 0; layer < config.layerCount; layer++) {
    const { placements, joints } = placeLayer(
      grid,
      layer,
      sortedBricks,
      previousJoints
    );
    allPlacements.push(...placements);
    previousJoints = joints;
  }

  // Calculate BOM
  const bom = calculateBOM(allPlacements);

  // Compute metadata
  const uniqueColors = new Set(allPlacements.map((p) => p.colorId));

  return {
    placements: allPlacements,
    billOfMaterials: bom,
    metadata: {
      generationTimestamp: new Date().toISOString(),
      totalBrickCount: allPlacements.length,
      uniqueColorsUsed: uniqueColors.size,
      coveragePercent: 100,
      algorithm: 'ai-native-grid',
    },
  };
}

/**
 * Nearest-neighbor upscale a coarse grid to target dimensions
 */
function upscaleCoarseGrid(
  coarseGrid: number[][],
  targetWidth: number,
  targetHeight: number
): number[][] {
  const coarseH = coarseGrid.length;
  const coarseW = coarseH > 0 ? coarseGrid[0].length : 0;

  const result: number[][] = [];
  for (let y = 0; y < targetHeight; y++) {
    const row: number[] = [];
    const srcY = Math.floor(y * coarseH / targetHeight);
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * coarseW / targetWidth);
      row.push(coarseGrid[srcY][srcX]);
    }
    result.push(row);
  }

  return result;
}

/**
 * Generate mosaic from a coarse (low-resolution) grid.
 * Step 1 of the two-step AI pipeline: upscale coarse grid → brick packing.
 */
export function generateMosaicFromCoarseGrid(
  coarseGrid: number[][],
  targetWidth: number,
  targetHeight: number,
  config: MosaicConfig
): MosaicResult & { fullGrid: number[][] } {
  const fullGrid = upscaleCoarseGrid(coarseGrid, targetWidth, targetHeight);

  const grid: ColorGrid = { width: targetWidth, height: targetHeight, cells: fullGrid };
  const sortedBricks = sortBricksByArea(config.brickPool);

  const allPlacements: Placement[] = [];
  let previousJoints = new Set<string>();

  for (let layer = 0; layer < config.layerCount; layer++) {
    const { placements, joints } = placeLayer(grid, layer, sortedBricks, previousJoints);
    allPlacements.push(...placements);
    previousJoints = joints;
  }

  const bom = calculateBOM(allPlacements);
  const uniqueColors = new Set(allPlacements.map((p) => p.colorId));

  return {
    placements: allPlacements,
    billOfMaterials: bom,
    fullGrid,
    metadata: {
      generationTimestamp: new Date().toISOString(),
      totalBrickCount: allPlacements.length,
      uniqueColorsUsed: uniqueColors.size,
      coveragePercent: 100,
      algorithm: 'ai-coarse-upscale',
    },
  };
}

/**
 * Apply region edits to a full-resolution grid.
 * Supports recolor, fill, and fine_grid operations.
 */
function applyRegionEdits(grid: number[][], edits: RegionEdit[]): number[][] {
  // Deep copy
  const result = grid.map((row) => [...row]);

  for (const edit of edits) {
    const { startX, startY, endX, endY, operation } = edit;

    if (operation.type === 'recolor') {
      for (let y = startY; y <= endY && y < result.length; y++) {
        for (let x = startX; x <= endX && x < result[y].length; x++) {
          if (result[y][x] === operation.fromColorId) {
            result[y][x] = operation.toColorId;
          }
        }
      }
    } else if (operation.type === 'fill') {
      for (let y = startY; y <= endY && y < result.length; y++) {
        for (let x = startX; x <= endX && x < result[y].length; x++) {
          result[y][x] = operation.colorId;
        }
      }
    } else if (operation.type === 'fine_grid') {
      const fineGrid = operation.colorGrid;
      const fineH = fineGrid.length;
      const fineW = fineH > 0 ? fineGrid[0].length : 0;
      const regionW = endX - startX + 1;
      const regionH = endY - startY + 1;

      for (let ry = 0; ry < regionH && (startY + ry) < result.length; ry++) {
        for (let rx = 0; rx < regionW && (startX + rx) < result[startY + ry].length; rx++) {
          const srcY = Math.floor(ry * fineH / regionH);
          const srcX = Math.floor(rx * fineW / regionW);
          result[startY + ry][startX + rx] = fineGrid[srcY][srcX];
        }
      }
    }
  }

  return result;
}

/**
 * Refine a mosaic by applying region edits.
 * Step 2 of the two-step AI pipeline: apply edits → re-pack bricks.
 */
export function refineMosaicRegions(
  currentGrid: number[][],
  edits: RegionEdit[],
  config: MosaicConfig
): MosaicResult & { fullGrid: number[][] } {
  const fullGrid = applyRegionEdits(currentGrid, edits);

  const height = fullGrid.length;
  const width = height > 0 ? fullGrid[0].length : 0;
  const grid: ColorGrid = { width, height, cells: fullGrid };

  const sortedBricks = sortBricksByArea(config.brickPool);

  const allPlacements: Placement[] = [];
  let previousJoints = new Set<string>();

  for (let layer = 0; layer < config.layerCount; layer++) {
    const { placements, joints } = placeLayer(grid, layer, sortedBricks, previousJoints);
    allPlacements.push(...placements);
    previousJoints = joints;
  }

  const bom = calculateBOM(allPlacements);
  const uniqueColors = new Set(allPlacements.map((p) => p.colorId));

  return {
    placements: allPlacements,
    billOfMaterials: bom,
    fullGrid,
    metadata: {
      generationTimestamp: new Date().toISOString(),
      totalBrickCount: allPlacements.length,
      uniqueColorsUsed: uniqueColors.size,
      coveragePercent: 100,
      algorithm: 'ai-region-refined',
    },
  };
}

/**
 * Main entry point: Generate a LEGO mosaic from an image
 */
export async function generateMosaic(
  imagePath: string,
  config: MosaicConfig,
  refinement?: RefinementInput
): Promise<MosaicResult> {
  // Step 1: Convert image to color grid
  const colorGrid = await imageToColorGrid(imagePath, config);

  // Step 2: Sort bricks for greedy placement
  const sortedBricks = sortBricksByArea(config.brickPool);

  // Step 3: Place bricks layer by layer with staggered joints
  const allPlacements: Placement[] = [];
  let previousJoints = new Set<string>();

  for (let layer = 0; layer < config.layerCount; layer++) {
    const { placements, joints } = placeLayer(
      colorGrid,
      layer,
      sortedBricks,
      previousJoints
    );
    allPlacements.push(...placements);
    previousJoints = joints;
  }

  // Step 4: Calculate BOM
  const bom = calculateBOM(allPlacements);

  // Step 5: Compute metadata
  const uniqueColors = new Set(allPlacements.map((p) => p.colorId));
  const totalBricks = allPlacements.length;

  return {
    placements: allPlacements,
    billOfMaterials: bom,
    metadata: {
      generationTimestamp: new Date().toISOString(),
      totalBrickCount: totalBricks,
      uniqueColorsUsed: uniqueColors.size,
      coveragePercent: 100,
      algorithm: 'greedy-largest-first',
    },
  };
}
