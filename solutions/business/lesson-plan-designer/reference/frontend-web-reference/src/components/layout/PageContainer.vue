<script setup lang="ts">
/**
 * PageContainer - Responsive centering wrapper using Ant Design Vue grid
 *
 * Provides automatic responsive column widths based on Ant Design breakpoints:
 * - xs (<576px): Full width
 * - sm (>=576px): Slightly narrower
 * - md (>=768px): Medium width
 * - lg (>=992px): Narrower
 * - xl (>=1200px): Narrowest
 *
 * Usage:
 *   <PageContainer variant="medium">
 *     <YourContent />
 *   </PageContainer>
 *
 * Props:
 *   variant: 'narrow' | 'medium' | 'wide' | 'extra-wide' (default: 'medium')
 */

defineProps({
  variant: {
    type: String,
    default: 'medium',
    validator: (value: string) => ['narrow', 'medium', 'wide', 'extra-wide', 'fluid'].includes(value)
  }
})

// Responsive column configurations for each variant
// Based on Ant Design 24-column grid system
const presets: Record<string, { xs: number; sm: number; md: number; lg: number; xl: number }> = {
  // Forms, creation views - narrower content
  narrow: {
    xs: 24,
    sm: 20,
    md: 16,
    lg: 14,
    xl: 12
  },
  // Detail views - medium width content
  medium: {
    xs: 24,
    sm: 22,
    md: 20,
    lg: 18,
    xl: 16
  },
  // List views, wide content
  wide: {
    xs: 24,
    sm: 24,
    md: 22,
    lg: 20,
    xl: 18
  },
  // Chat interfaces, dashboards - extra wide content
  'extra-wide': {
    xs: 24,
    sm: 24,
    md: 24,
    lg: 22,
    xl: 20
  },
  // Full width content (fluid)
  fluid: {
    xs: 24,
    sm: 24,
    md: 24,
    lg: 24,
    xl: 24
  }
}
</script>

<template>
  <a-row type="flex" justify="center" class="page-container">
    <a-col
      :xs="presets[variant].xs"
      :sm="presets[variant].sm"
      :md="presets[variant].md"
      :lg="presets[variant].lg"
      :xl="presets[variant].xl"
    >
      <slot />
    </a-col>
  </a-row>
</template>

<style scoped>
.page-container {
  width: 100%;
  padding: var(--space-4) var(--space-4);
}

@media (min-width: 768px) {
  .page-container {
    padding: var(--space-6) var(--space-6);
  }
}
</style>
