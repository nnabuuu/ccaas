# Frontend Coding Guidelines

This document establishes coding standards and architectural patterns for the frontend-web-refactor project. All contributors (human and AI) should follow these guidelines for consistency.

## Quick Reference

| Type | Naming | Example |
|------|--------|---------|
| Components | PascalCase.vue | `SectionCard.vue` |
| Views | PascalCaseView.vue | `LessonPlanDetailView.vue` |
| Composables | useCamelCase.ts | `useLessonPlanParser.ts` |
| Stores | camelCaseStore.ts | `lessonPlanStore.ts` |
| API modules | index.ts | `api/index.ts` |
| Types | camelCase.ts | `types/entities.ts` |
| CSS classes | kebab-case (BEM) | `.section-card__header--active` |

---

## 1. Component Structure

Use this order within `<script setup>`:

```vue
<script setup>
// 1. Imports (external first, then internal)
import { ref, computed } from 'vue'
import { useStore } from '@/stores/exampleStore'

// 2. Props & Emits
const props = defineProps({
  modelValue: { type: String, default: '' },
  options: {
    type: Array,
    required: true,
    validator: (arr) => arr.every(opt => 'value' in opt)
  }
})
const emit = defineEmits(['update:modelValue', 'save'])

// 3. Composables & Stores
const store = useStore()

// 4. Local State
const isEditing = ref(false)

// 5. Computed Properties
const displayValue = computed(() => props.modelValue || 'Empty')

// 6. Methods (event handlers, then business logic)
const handleClick = () => { /* ... */ }

// 7. Lifecycle Hooks
onMounted(() => { /* ... */ })
</script>
```

### Component Documentation

Add a JSDoc header to every component:

```vue
<script setup>
/**
 * InlineEditText - Click-to-edit text field with auto-save
 *
 * @example
 * <InlineEditText
 *   v-model="title"
 *   @save="handleSave"
 *   placeholder="Enter title"
 * />
 */
</script>
```

---

## 2. v-model Convention

**Always use the standard v-model pattern:**

```javascript
// Props
const props = defineProps({
  modelValue: { type: String, default: '' }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Usage
emit('update:modelValue', newValue)
```

**Avoid legacy patterns:**
```javascript
// DON'T use these
props: { value: String }  // Old Vue 2 style
emit('input', value)      // Old Vue 2 style
emit('change', value)     // Ambiguous
```

---

## 3. Prop Validation

Always add validators for complex props:

```javascript
const props = defineProps({
  // Simple - type is sufficient
  title: String,
  count: { type: Number, default: 0 },

  // Complex - add validator
  options: {
    type: Array,
    required: true,
    validator: (arr) => arr.every(opt => 'value' in opt && 'label' in opt)
  },

  status: {
    type: String,
    default: 'pending',
    validator: (val) => ['pending', 'active', 'completed'].includes(val)
  }
})
```

---

## 4. Store Architecture

### Store Organization

Stores are organized into two directories:

```
src/stores/
├── core/           # Cross-cutting concerns (max 4 stores)
│   ├── authStore.js      # Authentication state
│   ├── uiStore.js        # Navigation, loading, modals
│   └── configStore.js    # Feature flags, constants
└── domain/         # One store per backend controller
    ├── lessonPlanStore.js    # Maps to LessonPlanController
    ├── scheduleStore.js      # Maps to ScheduleController
    ├── schoolStore.js        # Maps to SchoolController
    └── ...
```

### Store-per-Controller Rule

Each backend controller MUST have a corresponding domain store:
- Store file: `stores/domain/{entity}Store.js`
- Controller: `{Entity}Controller`
- 1:1 mapping ensures clear ownership

### Mutation Pattern Documentation

All async store methods MUST document their pattern using `@pattern` JSDoc tag:

```javascript
/**
 * Fetch item by ID
 * @pattern pessimistic - Waits for server response before updating state
 * @param {number} id
 */
async function fetchById(id) { /* ... */ }

/**
 * Update a single field (Tier 1 inline edit)
 * @pattern optimistic - Updates local state immediately, syncs to server
 * @param {string} field
 * @param {*} value
 */
async function updateField(field, value) { /* ... */ }

/**
 * Save entity changes
 * @pattern hybrid - Shows pending indicator, updates on success
 * @param {Object} data
 */
async function save(data) { /* ... */ }
```

**Three patterns:**
- `@pattern pessimistic` - Wait for server, then update state (fetch operations)
- `@pattern optimistic` - Update local immediately, rollback on failure (inline edits)
- `@pattern hybrid` - Show saving state, update on success (form submissions)

### Store Pattern (Composition API)

```javascript
// stores/exampleStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { exampleApi } from '@/api'

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  // Actions
  async function fetchItems(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await exampleApi.getList(params)
      items.value = response.data?.rows || []
    } catch (err) {
      error.value = err.response?.data?.msg || 'Failed to load'
      throw err
    } finally {
      loading.value = false
    }
  }

  function reset() {
    items.value = []
    loading.value = false
    error.value = null
  }

  // Return everything explicitly
  return { items, loading, error, isEmpty, fetchItems, reset }
})
```

---

## 5. API Module Pattern

```javascript
// api/example.js
import request from './request'

const BASE_URL = '/normal/example'

export const exampleApi = {
  getList: (params) => request.get(`${BASE_URL}/list`, { params }),
  getById: (id) => request.get(`${BASE_URL}/${id}`),
  create: (data) => request.post(BASE_URL, data),
  update: (data) => request.put(BASE_URL, data),
  delete: (id) => request.delete(`${BASE_URL}/${id}`)
}
```

---

## 6. Composable Pattern

```javascript
// composables/useExample.js
import { ref, computed, onUnmounted } from 'vue'

/**
 * useExample - Description
 * @param {Object} options
 * @returns {Object} { value, isValid, submit, reset }
 */
export function useExample(options = {}) {
  const { initialValue = '' } = options

  // State
  const value = ref(initialValue)
  const error = ref(null)

  // Computed
  const isValid = computed(() => value.value.length > 0)

  // Methods
  function reset() {
    value.value = initialValue
    error.value = null
  }

  // Cleanup
  onUnmounted(() => { /* cleanup */ })

  return { value, error, isValid, reset }
}
```

---

## 7. UX Patterns

### Tiered Edit Pattern

| Tier | Use Case | Behavior | Example |
|------|----------|----------|---------|
| 1 | Single field | Click → Edit inline → Auto-save on blur | Title, date, dropdown |
| 2 | Related fields | Edit button → Section form → Explicit save | Lesson plan section |
| 3 | Complex creation | Button → Modal → Full form | New project wizard |

### Error Handling

```javascript
// In store - log and propagate
async function fetchItem(id) {
  try {
    const response = await api.getById(id)
    item.value = response.data
  } catch (err) {
    console.error('[Store] Failed:', err)
    error.value = 'Failed to load'
    throw err  // Let component handle UI
  }
}

// In component - handle UI feedback
const handleSave = async () => {
  try {
    await store.updateItem(data)
    toast.success('保存成功')
  } catch (err) {
    toast.error(err.response?.data?.msg || '保存失败')
    // Don't rethrow - error is handled
  }
}

// In inline-edit - throw for rollback
const handleSave = async () => {
  try {
    await props.onSave(value)
    toast.success('已保存', { duration: 2000 })
  } catch (err) {
    toast.error('保存失败')
    throw err  // Triggers UI rollback
  }
}
```

### Loading States

```vue
<template>
  <div v-if="loading" class="loading-state">加载中...</div>
  <div v-else-if="error" class="error-state">
    {{ error }}
    <button @click="retry">重试</button>
  </div>
  <div v-else-if="isEmpty" class="empty-state">暂无数据</div>
  <div v-else><!-- Content --></div>
</template>
```

---

## 8. CSS Guidelines

### Use CSS Custom Properties

```css
/* Use design tokens */
.component {
  color: var(--color-text);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
}

/* Avoid magic numbers */
.bad { padding: 16px; }  /* DON'T */
.good { padding: var(--spacing-md); }  /* DO */
```

### BEM Naming

```css
.section-card { }                    /* Block */
.section-card__header { }            /* Element */
.section-card__header--expanded { }  /* Modifier */
```

### Scoped Styles

```vue
<style scoped>
/* Only component-specific styles */
.my-component { /* ... */ }
</style>
```

### Responsive Layouts with Ant Design Vue

We use Ant Design Vue's 24-column grid system for responsive page centering. The `PageContainer` component wraps page content with consistent responsive behavior.

**Available variants:**

| Variant | Use Case | Column widths at xl/lg/md/sm/xs |
|---------|----------|--------------------------------|
| `narrow` | Forms, creation views | 12/14/16/20/24 |
| `medium` | Detail views | 16/18/20/22/24 |
| `wide` | List views, wide content | 18/20/22/24/24 |
| `extra-wide` | Chat interfaces, dashboards | 20/22/24/24/24 |

**Usage:**

```vue
<script setup>
import PageContainer from '@/components/layout/PageContainer.vue'
</script>

<template>
  <PageContainer variant="medium">
    <!-- Page content automatically centered and responsive -->
    <h1>Page Title</h1>
    <div class="content">...</div>
  </PageContainer>
</template>
```

**Breakpoints (Ant Design):**
- xs: <576px (mobile)
- sm: ≥576px (tablet portrait)
- md: ≥768px (tablet landscape)
- lg: ≥992px (desktop)
- xl: ≥1200px (large desktop)

**DON'T use hardcoded widths for page centering:**
```css
/* DON'T */
.page { max-width: 1024px; margin: 0 auto; }

/* DO: Use PageContainer component */
```

### Modal Dialogs with BaseModal

We use a standardized `BaseModal` component for all modal dialogs. This ensures consistent styling, accessibility, and animations.

**Size variants:**

| Size | Max-width | Use Case |
|------|-----------|----------|
| `sm` | 400px | Confirmation dialogs, small forms |
| `md` | 500px | Standard forms, selectors |
| `lg` | 600px | Complex forms, evaluation forms |
| `xl` | 700px | Full-featured editors, multi-tab content |

**Usage:**

```vue
<script setup>
import { BaseModal } from '@/components/layout'

const showModal = ref(false)
</script>

<template>
  <BaseModal
    v-model:visible="showModal"
    title="Modal Title"
    size="md"
    @close="handleClose"
  >
    <p>Modal body content here</p>

    <template #footer>
      <button class="btn-secondary" @click="showModal = false">Cancel</button>
      <button class="btn-primary" @click="handleSave">Save</button>
    </template>
  </BaseModal>
</template>
```

**Props:**
- `visible` (Boolean): Controls visibility via v-model
- `title` (String): Header title
- `size` (String): 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `closable` (Boolean): Show close button (default: true)
- `closeOnOverlay` (Boolean): Close when clicking backdrop (default: true)
- `closeOnEscape` (Boolean): Close on Escape key (default: true)

**Features:**
- Teleports to `<body>` to avoid z-index issues
- Focus trap for accessibility
- ARIA attributes (`role="dialog"`, `aria-modal="true"`)
- Fade + scale animation
- Keyboard navigation (Escape to close, Tab to cycle focus)

**DON'T create inline modal overlays:**
```vue
<!-- DON'T -->
<div class="modal-overlay">
  <div class="modal-content">...</div>
</div>

<!-- DO: Use BaseModal component -->
<BaseModal v-model:visible="showModal" title="Title">...</BaseModal>
```

---

## 9. Performance

### Dynamic Imports for Heavy Components

```javascript
import { defineAsyncComponent } from 'vue'

const RichTextEditor = defineAsyncComponent(() =>
  import('@/components/RichTextEditor.vue')
)
```

### Avoid in Templates

```vue
<!-- DON'T: Inline functions -->
<button @click="() => handleClick(item.id)">

<!-- DO: Method reference -->
<button @click="handleItemClick(item.id)">

<!-- DON'T: Complex expressions -->
<div v-if="items.filter(i => i.active).length > 0">

<!-- DO: Computed property -->
<div v-if="hasActiveItems">
```

---

## 10. File Organization & Component Classification

### Directory Structure

```
src/
├── api/                    # HTTP services
│   ├── request.js          # Axios instance
│   └── index.js            # All API modules (barrel export)
│
├── components/             # Presentational components (NO store imports)
│   ├── common/             # Generic UI
│   ├── layout/             # Page layout wrappers (PageContainer)
│   ├── inline-edit/        # Edit components
│   ├── lesson-plan/        # Domain components
│   └── attention-feed/     # Domain components
│
├── components/smart/       # Store-connected exceptions (max 5)
│   ├── NavigationConsumer.vue    # Justification required
│   └── NavigationDebugPanel.vue
│
├── composables/            # Reusable hooks
│   └── use{Feature}.js
│
├── stores/
│   ├── core/               # Cross-cutting (max 4)
│   │   ├── authStore.js
│   │   ├── uiStore.js
│   │   └── configStore.js
│   └── domain/             # One per controller
│       ├── lessonPlanStore.js
│       ├── scheduleStore.js
│       └── ...
│
├── views/                  # Page-level smart components
│   └── {Feature}View.vue   # Can access stores
│
├── router/                 # Vue Router
│   └── index.js
│
├── styles/                 # Global styles
│   └── variables.css       # CSS custom properties
│
└── utils/                  # Utilities
    └── toast.js
```

### Component Classification Rules

| Location | Store Access | Purpose |
|----------|--------------|---------|
| `views/` | Allowed | Page-level, connected to router |
| `components/` | NOT allowed | Presentational, props-in/events-out |
| `components/smart/` | Allowed | Exceptions with documented justification |

### API Ownership Rule

**Components MUST NOT import from `api/` directly. All API access goes through stores.**

```javascript
// WRONG - component calls API directly
import { lessonPlanApi } from '@/api'
const data = await lessonPlanApi.getById(id)

// CORRECT - component uses store
import { useLessonPlanStore } from '@/stores/domain/lessonPlanStore'
const store = useLessonPlanStore()
await store.fetchLessonPlan(id)
```

### Smart Component Justification

Components in `smart/` MUST have a justification comment:

```vue
<script setup>
/**
 * MySmartComponent - Description
 *
 * SMART COMPONENT JUSTIFICATION:
 * - [Why store access is needed]
 * - [Why it can't be made presentational]
 * - [What stores it depends on]
 *
 * Store dependencies: uiStore, someStore
 */
</script>
```

---

## 11. Do's and Don'ts

### DO

- Use Composition API with `<script setup>`
- Add JSDoc to exported functions
- Use v-model pattern for two-way binding
- Add prop validators for complex types
- Handle loading/error/empty states
- Use CSS custom properties
- Write semantic component names

### DON'T

- Mix Options API and Composition API
- Use legacy v-model patterns (value/input)
- Omit error handling in async functions
- Use magic numbers in CSS
- Create components without documentation
- Nest callbacks deeply (use async/await)
- Import entire libraries when you need one function

---

## References

- [Vue 3 Style Guide](https://vuejs.org/style-guide/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- Project: `FRONTEND_DOCUMENTATION.md`
- OpenSpec: `openspec/changes/establish-frontend-standards/`

---

## 12. AI Coding & Troubleshooting Principles

These principles are critical for AI agents and developers to avoid common "invisible" UI bugs and race conditions.

### CSS Namespacing & Collisions
**Problem**: Generic class names like `.modal-overlay` or `.card` often collide with global frameworks or legacy styles, causing elements to be hidden (`opacity: 0`, `visibility: hidden`) or styled incorrectly.
- **DO**: Prefix critical component classes (e.g., `.standards-modal-overlay`).
- **DO**: Explicitly set `visibility` and `opacity` when implementing custom overlays if global animations might interfere.
- **DON'T**: Assume global styles are clean.

### Vue Reactivity & Watcher Timing
**Problem**: Using `{ immediate: true }` in `watch`ers can trigger callbacks *before* the component is fully initialized, leading to `ReferenceError` if the watcher calls a function defined later in the `<script setup>`.
- **DO**: Define all functions *before* using them in watchers.
- **DO**: Be careful with `immediate: true` when relying on hoisted variables.

### Event Propagation
**Problem**: Click events on buttons inside cards or list items can bubble up and trigger parent handlers (e.g., selecting the row instead of the specific action).
- **DO**: Use `.stop` modifier on action buttons: `@click.stop="handleAction"`.

### Modal Visibility Logic
**Problem**: Modals kept in the DOM with `v-show` or CSS hiding can retain stale state (loading spinners, error messages, old selections).
- **DO**: Use `v-if` on the modal component itself to ensure a fresh mount and clean state on every open: `<MyModal v-if="isOpen" v-model:visible="isOpen" />`.

---

## 13. TypeScript Guidelines

The codebase uses TypeScript with `strictNullChecks` enabled. All new code should be written in TypeScript.

### Type Organization

```
src/
├── types/                    # Shared type definitions
│   ├── index.ts              # Barrel export - import from here
│   ├── entities.ts           # Domain models (mirrors backend entities)
│   └── api.ts                # API request/response types
│
├── api/
│   └── index.ts              # Typed API functions (single file)
│
├── stores/                   # Can use .ts or .js with JSDoc
│   └── domain/
│       └── lessonPlanStore.ts
│
└── views/                    # Vue SFCs with <script setup lang="ts">
    └── ProjectDetailView.vue
```

### When to Create Types

| Location | When to Use |
|----------|-------------|
| `types/entities.ts` | Domain models that match backend entities |
| `types/api.ts` | API request/response shapes, query params |
| `types/index.ts` | Re-export everything from above |
| Inline in component | Component-specific types (props, local state) |
| In composable file | Composable return types |

**Rule**: Types used by 3+ files belong in `types/`. Single-use types stay inline.

### Import Patterns

```typescript
// CORRECT - import types from barrel
import type { Project, LessonPlan, PageResult } from '@/types'

// CORRECT - import runtime type guards (not type-only)
import { isProject, isLessonPlan } from '@/types'

// WRONG - import from specific file
import type { Project } from '@/types/entities'  // Use barrel instead
```

### Vue Component Typing

```vue
<script setup lang="ts">
import type { Project } from '@/types'

// Props - use generic syntax for type-only definitions
defineProps<{
  project: Project
  readonly?: boolean
}>()

// Props with defaults
withDefaults(defineProps<{
  title: string
  count?: number
}>(), {
  count: 0
})

// Emits - tuple syntax for payload types
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': [data: Project]
  'cancel': []
}>()

// Refs - explicit type for complex/nullable refs
const project = ref<Project | null>(null)
const items = ref<Project[]>([])

// Template refs
const inputRef = ref<HTMLInputElement | null>(null)
</script>
```

### Null Safety Patterns

With `strictNullChecks` enabled, handle null/undefined explicitly:

```typescript
// Pattern 1: Early return guard
const saveProject = async () => {
  if (!project.value) return  // Guard clause
  await projectApi.update(project.value)
}

// Pattern 2: Optional chaining
const title = project.value?.title ?? 'Untitled'

// Pattern 3: Nullish coalescing for defaults
const items = response.data ?? []

// Pattern 4: Type narrowing
if (project.value && project.value.status === 'draft') {
  // project.value is narrowed to non-null here
}
```

### API Layer Typing

```typescript
// types/api.ts
export interface PageResult<T> {
  rows: T[]
  total: number
  code: number
  msg: string
}

// api/index.ts
import type { Project, PageResult, ProjectQuery } from '@/types'

export const projectApi = {
  getList(params?: ProjectQuery): Promise<PageResult<Project>> {
    return request.get('/normal/project/list', { params })
  },

  getById(id: number): Promise<{ data: Project }> {
    return request.get(`/normal/project/${id}`)
  },

  create(data: ProjectCreateRequest): Promise<{ data: Project }> {
    return request.post('/normal/project', data)
  }
}
```

### Runtime Type Guards

Use type guards at API boundaries to catch backend schema changes:

```typescript
// types/entities.ts
export function isProject(data: unknown): data is Project {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    typeof (data as Project).id === 'number' &&
    typeof (data as Project).title === 'string'
  )
}

// Usage in component
const response = await projectApi.getById(id)
if (!isProject(response.data)) {
  throw new Error('Invalid project data from API')
}
```

### Store Typing

```typescript
// stores/domain/projectStore.ts
import { defineStore } from 'pinia'
import type { Project } from '@/types'

export const useProjectStore = defineStore('project', () => {
  // Typed state
  const item = ref<Project | null>(null)
  const items = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Typed actions
  async function fetchById(id: number): Promise<Project | null> {
    loading.value = true
    try {
      const response = await projectApi.getById(id)
      item.value = response.data
      return response.data
    } catch (err) {
      error.value = 'Failed to load project'
      return null
    } finally {
      loading.value = false
    }
  }

  return { item, items, loading, error, fetchById }
})
```

### Type Inference

Let TypeScript infer when possible:

```typescript
// UNNECESSARY - TypeScript infers number
const count: number = ref<number>(0)

// BETTER - let inference work
const count = ref(0)

// NECESSARY - complex or ambiguous types
const items = ref<Project[]>([])
const user = ref<User | null>(null)
```

### Common Pitfalls

```typescript
// WRONG: null vs undefined mismatch
const id: number | undefined = someValue ?? null  // Error!
// CORRECT
const id: number | undefined = someValue ?? undefined

// WRONG: Accessing possibly undefined
const name = items[0].name  // Error if array empty
// CORRECT
const name = items[0]?.name ?? 'Unknown'

// WRONG: Not handling API response correctly
const data = response.data  // Could be undefined
// CORRECT
const data = response.data ?? []
```

### Migration Notes

- Views use `<script setup lang="ts">`
- Stores can remain `.js` with JSDoc types (incremental migration)
- Test files can remain `.js`
- Config files (`vite.config.ts`, `tsconfig.json`) are TypeScript
