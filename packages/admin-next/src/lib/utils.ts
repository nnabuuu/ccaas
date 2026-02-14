import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Note: formatNumber, formatCost, and formatTokens have been moved to lib/format.ts
// to consolidate all formatting utilities in one place
