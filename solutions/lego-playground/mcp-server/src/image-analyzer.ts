/**
 * Image Analyzer - Extract dominant colors and composition from uploaded images
 * Uses sharp for image processing and k-means for color clustering
 */

import sharp from 'sharp';
import { rgbToLab, ciede2000, findNearestColor, loadColors } from './lego-catalog.js';
import type { ImageAnalysis, LegoColor } from './types.js';

interface PixelData {
  r: number;
  g: number;
  b: number;
}

/**
 * Simplified k-means clustering for dominant color extraction
 */
function kMeansColors(pixels: PixelData[], k: number, maxIterations = 20): PixelData[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  // Initialize centroids using k-means++ style
  const centroids: PixelData[] = [pixels[Math.floor(Math.random() * pixels.length)]];

  for (let i = 1; i < k; i++) {
    const distances = pixels.map((p) => {
      const minDist = Math.min(
        ...centroids.map(
          (c) =>
            Math.pow(p.r - c.r, 2) + Math.pow(p.g - c.g, 2) + Math.pow(p.b - c.b, 2)
        )
      );
      return minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;
    for (let j = 0; j < pixels.length; j++) {
      rand -= distances[j];
      if (rand <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }
    if (centroids.length <= i) {
      centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }
  }

  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters: PixelData[][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const dist =
          Math.pow(pixel.r - centroids[i].r, 2) +
          Math.pow(pixel.g - centroids[i].g, 2) +
          Math.pow(pixel.b - centroids[i].b, 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      clusters[bestIdx].push(pixel);
    }

    let converged = true;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      const newR = Math.round(clusters[i].reduce((s, p) => s + p.r, 0) / clusters[i].length);
      const newG = Math.round(clusters[i].reduce((s, p) => s + p.g, 0) / clusters[i].length);
      const newB = Math.round(clusters[i].reduce((s, p) => s + p.b, 0) / clusters[i].length);

      if (centroids[i].r !== newR || centroids[i].g !== newG || centroids[i].b !== newB) {
        converged = false;
      }
      centroids[i] = { r: newR, g: newG, b: newB };
    }

    if (converged) break;
  }

  return centroids;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Analyze an image and return dominant colors, composition, and recommendations
 */
export async function analyzeImage(
  imagePath: string,
  targetWidth?: number
): Promise<ImageAnalysis> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 100;
  const height = metadata.height || 100;

  // Downscale for analysis (max 100x100)
  const analysisSize = 100;
  const scale = Math.min(analysisSize / width, analysisSize / height);
  const analysisWidth = Math.max(1, Math.round(width * scale));
  const analysisHeight = Math.max(1, Math.round(height * scale));

  const { data, info } = await image
    .resize(analysisWidth, analysisHeight, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Extract pixels
  const pixels: PixelData[] = [];
  for (let i = 0; i < data.length; i += 3) {
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  // K-means clustering for dominant colors (8 clusters)
  const clusterCount = 8;
  const centroids = kMeansColors(pixels, clusterCount);

  // Calculate percentage for each cluster
  const clusterSizes = new Array(clusterCount).fill(0);
  for (const pixel of pixels) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const dist =
        Math.pow(pixel.r - centroids[i].r, 2) +
        Math.pow(pixel.g - centroids[i].g, 2) +
        Math.pow(pixel.b - centroids[i].b, 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    clusterSizes[bestIdx]++;
  }

  const totalPixels = pixels.length;

  // Map to nearest LEGO colors and build dominant colors list
  const dominantColors = centroids
    .map((c, i) => {
      const nearest = findNearestColor(c.r, c.g, c.b);
      return {
        hex: rgbToHex(c.r, c.g, c.b),
        rgb: [c.r, c.g, c.b] as [number, number, number],
        percentage: Math.round((clusterSizes[i] / totalPixels) * 100),
        nearestLegoColor: {
          id: nearest.color.bricklinkId,
          name: nearest.color.name,
          hex: nearest.color.hex,
        },
      };
    })
    .filter((c) => c.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  // Determine composition
  const aspectRatio = width / height;
  let composition: ImageAnalysis['composition'];
  if (aspectRatio > 1.3) {
    composition = 'landscape';
  } else if (aspectRatio < 0.77) {
    composition = 'portrait';
  } else {
    composition = 'symmetric';
  }

  // Determine complexity based on color variance
  const uniqueLegoColors = new Set(dominantColors.map((c) => c.nearestLegoColor.id));
  let complexity: ImageAnalysis['complexity'];
  if (uniqueLegoColors.size <= 4) {
    complexity = 'low';
  } else if (uniqueLegoColors.size <= 6) {
    complexity = 'medium';
  } else {
    complexity = 'high';
  }

  // Recommend size
  const baseSize = targetWidth || 48;
  const recommendedWidth = baseSize;
  const recommendedHeight = Math.round(baseSize / aspectRatio);
  // Clamp to valid range
  const clampedHeight = Math.max(8, Math.min(128, recommendedHeight));

  // Build suggested palette — top colors + some extras for gradients
  const suggestedPaletteIds = new Set<number>();
  for (const dc of dominantColors) {
    suggestedPaletteIds.add(dc.nearestLegoColor.id);
  }
  // Add nearby colors for smoother gradients
  const allColors = loadColors().filter((c) => !c.isTransparent && !c.isMetallic);
  for (const dc of dominantColors.slice(0, 4)) {
    const targetLab = rgbToLab(dc.rgb[0], dc.rgb[1], dc.rgb[2]);
    const nearby = allColors
      .map((c) => ({
        id: c.bricklinkId,
        dist: ciede2000(targetLab, rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2])),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
    for (const n of nearby) {
      suggestedPaletteIds.add(n.id);
    }
  }

  return {
    dominantColors,
    composition,
    complexity,
    recommendedSize: { width: recommendedWidth, height: clampedHeight },
    suggestedPalette: Array.from(suggestedPaletteIds),
    imageWidth: width,
    imageHeight: height,
  };
}
