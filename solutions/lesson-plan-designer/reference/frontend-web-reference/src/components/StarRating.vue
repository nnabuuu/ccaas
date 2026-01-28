<script setup lang="ts">
/**
 * StarRating - Interactive or read-only star rating component with configurable size
 *
 * @example
 * <StarRating v-model="rating" :max="5" size="medium" />
 * <StarRating :modelValue="4.5" :max="5" :readonly="true" size="small" />
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 5
  },
  readonly: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'medium' // small, medium, large
  }
})

const emit = defineEmits(['update:modelValue'])

const stars = computed(() => {
  return Array.from({ length: props.max }, (_, i) => i + 1)
})

const setStar = (value: number) => {
  if (props.readonly) return
  emit('update:modelValue', value)
}

const sizeClass = computed(() => `star-rating--${props.size}`)
</script>

<template>
  <div :class="['star-rating', sizeClass, { readonly }]">
    <button
      v-for="star in stars"
      :key="star"
      type="button"
      :class="['star', { filled: modelValue >= star }]"
      @click="setStar(star)"
      :disabled="readonly"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    </button>
    <span v-if="!readonly" class="score-text">{{ modelValue || '-' }}/{{ max }}</span>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-rating.readonly {
  gap: 1px;
}

.star {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #d1d5db;
  transition: color 0.1s, transform 0.1s;
}

.star:disabled {
  cursor: default;
}

.star:not(:disabled):hover {
  transform: scale(1.1);
}

.star.filled {
  color: #fbbf24;
}

.star svg {
  display: block;
}

/* Size variants */
.star-rating--small .star svg {
  width: 16px;
  height: 16px;
}

.star-rating--medium .star svg {
  width: 24px;
  height: 24px;
}

.star-rating--large .star svg {
  width: 32px;
  height: 32px;
}

.score-text {
  margin-left: 8px;
  font-size: 14px;
  color: #6b7280;
  min-width: 36px;
}

.star-rating--small .score-text {
  font-size: 12px;
  margin-left: 6px;
}

.star-rating--large .score-text {
  font-size: 16px;
  margin-left: 12px;
}
</style>
