/**
 * Ant Design Vue Plugin
 *
 * Registers only the components we need for responsive layouts.
 * Ant Design Vue 4.x uses CSS-in-JS, no separate CSS imports needed.
 */
import type { App } from 'vue'
import { Row, Col } from 'ant-design-vue'

export function setupAntd(app: App): void {
  // Register grid components globally
  app.component('ARow', Row)
  app.component('ACol', Col)
}
