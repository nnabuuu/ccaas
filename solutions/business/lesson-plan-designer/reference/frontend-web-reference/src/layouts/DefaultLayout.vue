<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="default-layout">
    <AppHeader />
    <main class="main-content" :class="{ 'full-width': route.meta?.fullWidth }">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);
}

.main-content {
  flex: 1;
}
</style>
