<script setup lang="ts">
/**
 * AppFooter - Application footer displaying branding and ICP information
 *
 * @example
 * <AppFooter />
 */
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand">
        <span class="footer-logo">LOGO</span>
        <span class="footer-name">师范生发展平台</span>
      </div>
      <span class="footer-info">Kedge Normal Student System</span>
    </div>
    <div class="footer-icp">京ICP备14XXXXXXX号-1</div>
  </footer>
</template>

<style scoped>
.footer {
  background: var(--white);
  border-top: 1px solid var(--gray-200);
  padding: var(--space-4) var(--space-6);
}

.footer-content {
  max-width: var(--max-width-wide, 1200px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.footer-logo {
  font-size: var(--text-lg);
  font-weight: 700;
  font-style: italic;
  color: var(--gray-400);
}

.footer-name {
  font-size: var(--text-sm);
  color: var(--gray-500);
}

.footer-info {
  font-size: var(--text-sm);
  color: var(--gray-400);
}

.footer-icp {
  font-size: var(--text-xs);
  color: var(--gray-400);
  text-align: center;
  margin-top: var(--space-3);
}

@media (max-width: 768px) {
  .footer-content {
    flex-direction: column;
    gap: var(--space-2);
    text-align: center;
  }
}
</style>
