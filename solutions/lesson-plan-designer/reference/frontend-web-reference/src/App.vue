<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import BlankLayout from './layouts/BlankLayout.vue'
import NavigationConsumer from './components/smart/NavigationConsumer.vue'
import AgentListener from './components/agent/AgentListener.vue'
import SplitLayout from './components/layout/SplitLayout.vue'

// Import navigation styles
import './assets/navigation.css'

const route = useRoute()

const layout = computed(() => {
  const layoutName = route.meta?.layout || 'default'
  return layoutName === 'blank' ? BlankLayout : DefaultLayout
})
</script>

<template>
  <!-- Navigation event processor (headless) -->
  <NavigationConsumer />

  <!-- Agentic Copilot components - wraps entire app for provide/inject -->
  <AgentListener>
    <!-- SplitLayout manages the AI side panel -->
    <SplitLayout>
      <component :is="layout">
        <router-view />
      </component>
    </SplitLayout>
  </AgentListener>
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
