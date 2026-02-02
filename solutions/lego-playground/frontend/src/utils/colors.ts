import type { LegoColor, BillItem } from '../types';

export function getColorHex(colorId: number, colors: LegoColor[]): string {
  const color = colors.find((c) => c.bricklinkId === colorId);
  return color?.hex || '#CCCCCC';
}

export function getColorName(colorId: number, colors: LegoColor[]): string {
  const color = colors.find((c) => c.bricklinkId === colorId);
  return color?.name || `Color ${colorId}`;
}

export function formatBrickCount(count: number): string {
  return count.toLocaleString();
}

export function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

export function scoreColor(score: number): string {
  if (score >= 0.9) return '#22c55e'; // green
  if (score >= 0.7) return '#eab308'; // yellow
  if (score >= 0.5) return '#f97316'; // orange
  return '#ef4444'; // red
}
