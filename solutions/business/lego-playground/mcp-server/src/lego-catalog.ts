/**
 * LEGO Catalog - Color & Brick data management + CIEDE2000 color matching
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { LegoColor, BrickPart } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache
let colorsCache: LegoColor[] | null = null;
let bricksCache: BrickPart[] | null = null;

function findDataDir(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '../data'),
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Data directory not found');
}

export function loadColors(): LegoColor[] {
  if (colorsCache) return colorsCache;
  const dataDir = findDataDir();
  const filePath = path.join(dataDir, 'lego-colors.json');
  colorsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return colorsCache!;
}

export function loadBricks(): BrickPart[] {
  if (bricksCache) return bricksCache;
  const dataDir = findDataDir();
  const filePath = path.join(dataDir, 'lego-bricks.json');
  bricksCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return bricksCache!;
}

export function getColors(options?: {
  includeTransparent?: boolean;
  includeMetallic?: boolean;
}): LegoColor[] {
  let colors = loadColors();
  if (!options?.includeTransparent) {
    colors = colors.filter((c) => !c.isTransparent);
  }
  if (!options?.includeMetallic) {
    colors = colors.filter((c) => !c.isMetallic);
  }
  return colors;
}

export function getBricks(partType?: string): BrickPart[] {
  let bricks = loadBricks();
  if (partType) {
    bricks = bricks.filter((b) => b.partType === partType);
  }
  return bricks;
}

export function getDefaultBricks(): BrickPart[] {
  return loadBricks().filter((b) => b.isDefault);
}

export function getColorById(id: number): LegoColor | undefined {
  return loadColors().find((c) => c.bricklinkId === id);
}

export function getBrickById(id: string): BrickPart | undefined {
  return loadBricks().find((b) => b.bricklinkId === id);
}

// ==========================================
// CIEDE2000 Color Difference Algorithm
// ==========================================

interface Lab {
  L: number;
  a: number;
  b: number;
}

/** Convert sRGB [0-255] to CIE Lab */
export function rgbToLab(r: number, g: number, b: number): Lab {
  // sRGB to linear RGB
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // Linear RGB to XYZ (D65)
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  // XYZ to Lab (D65 reference white)
  x /= 0.95047;
  y /= 1.00000;
  z /= 1.08883;

  const fx = x > 0.008856 ? Math.cbrt(x) : (903.3 * x + 16) / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : (903.3 * y + 16) / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : (903.3 * z + 16) / 116;

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIEDE2000 color difference */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * (Math.PI / 180));

  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hp - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hp) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hp + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * hp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const RT =
    -2 *
    Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7))) *
    Math.sin(((60 * Math.exp(-Math.pow((hp - 275) / 25, 2))) * Math.PI) / 180);

  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );

  return dE;
}

/** Find nearest LEGO color to an RGB value using CIEDE2000 */
export function findNearestColor(
  r: number,
  g: number,
  b: number,
  palette?: number[]
): { color: LegoColor; distance: number } {
  const targetLab = rgbToLab(r, g, b);
  let colors = loadColors().filter((c) => !c.isTransparent && !c.isMetallic);

  if (palette && palette.length > 0) {
    colors = colors.filter((c) => palette.includes(c.bricklinkId));
  }

  let bestColor = colors[0];
  let bestDistance = Infinity;

  for (const color of colors) {
    const colorLab = rgbToLab(color.rgb[0], color.rgb[1], color.rgb[2]);
    const distance = ciede2000(targetLab, colorLab);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestColor = color;
    }
  }

  return { color: bestColor, distance: bestDistance };
}
