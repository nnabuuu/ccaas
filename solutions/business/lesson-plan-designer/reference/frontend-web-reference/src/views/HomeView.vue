<script setup lang="ts">
/**
 * HomeView - Main dashboard page with attention feed and sidebar widgets
 *
 * Displays:
 * - AttentionFeed: Work-focused items requiring user attention
 * - RecentlyEdited: Quick access to recently edited lesson plans and courses
 * - QuickActions: Shortcuts to common actions
 */
import AttentionFeed from '../components/attention-feed/AttentionFeed.vue'
import RecentlyEdited from '../components/home/RecentlyEdited.vue'
import QuickActions from '../components/home/QuickActions.vue'
</script>

<template>
  <div class="home-page">
    <div class="home-content">
      <!-- Feed Section -->
      <section class="feed-section">
        <AttentionFeed />
      </section>

      <!-- Sidebar -->
      <aside class="home-sidebar">
        <RecentlyEdited />
        <QuickActions />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  padding: var(--space-6);
  width: 100%;
  box-sizing: border-box;
}

.home-content {
  display: flex;
  gap: var(--space-6);
}

.feed-section {
  flex: 1;
  min-width: 0;
}

.home-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .home-content {
    flex-direction: column;
  }

  .home-sidebar {
    width: 100%;
  }
}
</style>
