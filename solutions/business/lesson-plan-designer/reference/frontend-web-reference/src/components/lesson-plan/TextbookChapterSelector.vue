<script setup lang="ts">
/**
 * TextbookChapterSelector - Cascading selector for textbook chapters
 *
 * 4-step cascading selection: Subject → Grade → Publisher → Volume
 * Then displays chapter tree for single-selection.
 * Only leaf nodes are selectable.
 *
 * @example
 * <TextbookChapterSelector v-model:visible="modalVisible" @confirm="handleConfirm" />
 */
import { ref, computed, watch, nextTick, type PropType } from 'vue'
import { textbookEditionApi } from '../../api/index'
import type { TextbookChapter, TextbookOptionsDTO } from '@/types'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Pre-selected chapter ID (single selection) */
  initialChapterId: { type: Number as PropType<number | null>, default: null },
  /** Pre-selected subject to auto-select in cascade */
  initialSubject: { type: String, default: '' },
  /** Pre-selected grade to auto-select in cascade */
  initialGrade: { type: Number, default: null }
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [payload: { chapterId: number | null; chapterTitle: string | null; subject: string; grade: number }]
  'cancel': []
}>()

// Cascading selector state
const subjects = ref<string[]>([])
const grades = ref<number[]>([])
const publishers = ref<string[]>([])
const volumes = ref<TextbookOptionsDTO[]>([])
const chapterTree = ref<TextbookChapter[]>([])

// Selected values in cascade
const selectedSubject = ref('')
const selectedGrade = ref<number | null>(null)
const selectedPublisher = ref('')
const selectedVolumeId = ref<number | null>(null)

// Chapter selection state (single selection)
const localSelectedId = ref<number | null>(props.initialChapterId)

// Loading states
const loading = ref(false)
const loadingChapters = ref(false)

// Template refs for keyboard navigation
const gradeSelectRef = ref<HTMLSelectElement | null>(null)
const publisherSelectRef = ref<HTMLSelectElement | null>(null)
const volumeSelectRef = ref<HTMLSelectElement | null>(null)

// API calls (defined before watches to avoid temporal dead zone)
const fetchSubjects = async () => {
  loading.value = true
  try {
    const res = await textbookEditionApi.getSubjects()
    subjects.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch subjects:', error)
  } finally {
    loading.value = false
  }
}

const fetchGrades = async (subject: string) => {
  loading.value = true
  try {
    const res = await textbookEditionApi.getGrades(subject)
    grades.value = res.data || []
    // Auto-select if singleton and focus next field
    if (grades.value.length === 1) {
      selectedGrade.value = grades.value[0]
    } else if (grades.value.length > 1) {
      // Focus grade select for manual selection
      await nextTick()
      gradeSelectRef.value?.focus()
    }
  } catch (error) {
    console.error('Failed to fetch grades:', error)
  } finally {
    loading.value = false
  }
}

const fetchPublishers = async (subject: string, grade: number, preservePublisher?: string) => {
  loading.value = true
  try {
    const res = await textbookEditionApi.getPublishers(subject, grade)
    publishers.value = res.data || []
    // If preserving publisher and it exists in new list, keep it
    if (preservePublisher && publishers.value.includes(preservePublisher)) {
      selectedPublisher.value = preservePublisher
    } else if (publishers.value.length === 1) {
      // Auto-select if singleton
      selectedPublisher.value = publishers.value[0]
    } else if (publishers.value.length > 1) {
      // Focus publisher select for manual selection
      await nextTick()
      publisherSelectRef.value?.focus()
    }
  } catch (error) {
    console.error('Failed to fetch publishers:', error)
  } finally {
    loading.value = false
  }
}

const fetchVolumes = async (subject: string, grade: number, publisher: string) => {
  loading.value = true
  try {
    const res = await textbookEditionApi.getVolumesByPublisher(subject, grade, publisher)
    volumes.value = res.data || []
    // Auto-select first volume if any exist (show chapters immediately)
    if (volumes.value.length >= 1) {
      selectedVolumeId.value = volumes.value[0].id
    }
  } catch (error) {
    console.error('Failed to fetch volumes:', error)
  } finally {
    loading.value = false
  }
}

const fetchChapterTree = async (editionId: number) => {
  loadingChapters.value = true
  try {
    const res = await textbookEditionApi.getChapterTree(editionId)
    chapterTree.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch chapter tree:', error)
  } finally {
    loadingChapters.value = false
  }
}

// Watches (defined after API functions to avoid temporal dead zone)

// Sync local state when props change
watch(() => props.initialChapterId, (val) => {
  localSelectedId.value = val
})

// Fetch subjects and auto-select initial values when modal opens
watch(() => props.visible, async (visible) => {
  if (visible) {
    await fetchSubjects()
    // Auto-select initial subject if provided and available
    if (props.initialSubject && subjects.value.includes(props.initialSubject)) {
      selectedSubject.value = props.initialSubject
      // Grade will be auto-fetched and selected via the cascade watches
    }
  }
}, { immediate: true })

// Auto-select initial grade after grades are fetched
watch(grades, (newGrades) => {
  if (props.initialGrade !== null && newGrades.includes(props.initialGrade)) {
    selectedGrade.value = props.initialGrade
  }
})

// Cascade: fetch grades when subject changes
watch(selectedSubject, async (subject) => {
  selectedGrade.value = null
  selectedPublisher.value = ''
  selectedVolumeId.value = null
  publishers.value = []
  volumes.value = []
  chapterTree.value = []
  if (subject) {
    await fetchGrades(subject)
  }
})

// Cascade: fetch publishers when grade changes (preserve publisher if still valid)
watch(selectedGrade, async (grade) => {
  const previousPublisher = selectedPublisher.value
  selectedPublisher.value = ''
  selectedVolumeId.value = null
  volumes.value = []
  chapterTree.value = []
  if (grade !== null && selectedSubject.value) {
    await fetchPublishers(selectedSubject.value, grade, previousPublisher || undefined)
  }
})

// Cascade: fetch volumes when publisher changes
watch(selectedPublisher, async (publisher) => {
  selectedVolumeId.value = null
  chapterTree.value = []
  if (publisher && selectedGrade.value !== null && selectedSubject.value) {
    await fetchVolumes(selectedSubject.value, selectedGrade.value, publisher)
  }
})

// Fetch chapter tree when volume changes
watch(selectedVolumeId, async (volumeId) => {
  chapterTree.value = []
  if (volumeId !== null) {
    await fetchChapterTree(volumeId)
  }
})

// Check if a chapter is a leaf (no children)
const isLeafChapter = (chapter: TextbookChapter): boolean => {
  return !chapter.children || chapter.children.length === 0
}

// Select chapter (only for leaf nodes, single selection)
const toggleChapter = (chapter: TextbookChapter) => {
  if (!isLeafChapter(chapter)) return
  // Toggle: if already selected, deselect; otherwise select this one
  if (localSelectedId.value === chapter.id) {
    localSelectedId.value = null
  } else {
    localSelectedId.value = chapter.id
  }
}

// Check if chapter is selected
const isChapterSelected = (id: number): boolean => {
  return localSelectedId.value === id
}

// Whether a chapter is selected
const hasSelection = computed(() => localSelectedId.value !== null)

// Empty state detection for dropdowns
const isGradesEmpty = computed(() => Boolean(selectedSubject.value) && !loading.value && grades.value.length === 0)
const isPublishersEmpty = computed(() => selectedGrade.value !== null && !loading.value && publishers.value.length === 0)
const isVolumesEmpty = computed(() => Boolean(selectedPublisher.value) && !loading.value && volumes.value.length === 0)

// Find selected chapter title from tree
const selectedChapterTitle = computed(() => {
  if (localSelectedId.value === null) return null

  const findChapter = (chapters: TextbookChapter[]): string | null => {
    for (const chapter of chapters) {
      if (chapter.id === localSelectedId.value) {
        return chapter.title
      }
      if (chapter.children && chapter.children.length > 0) {
        const found = findChapter(chapter.children)
        if (found) return found
      }
    }
    return null
  }

  return findChapter(chapterTree.value)
})

// Modal actions
const handleClose = () => {
  emit('cancel')
  emit('update:visible', false)
}

const handleConfirm = () => {
  emit('confirm', {
    chapterId: localSelectedId.value,
    chapterTitle: selectedChapterTitle.value,
    subject: selectedSubject.value,
    grade: selectedGrade.value || 0
  })
  emit('update:visible', false)
}

const handleReset = () => {
  localSelectedId.value = null
}

// Grade display helper
const getGradeLabel = (grade: number): string => {
  if (grade <= 6) return `${grade}年级`
  if (grade <= 9) return `${grade - 6}年级（初中）`
  return `${grade - 9}年级（高中）`
}
</script>

<template>
  <div class="textbook-chapter-selector-wrapper">
  <Teleport to="body">
    <div v-if="visible" class="chapter-selector-overlay" @click.self="handleClose">
      <div class="chapter-selector-container">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">选择教材章节</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- Cascading Selectors -->
        <div class="cascade-selectors">
          <!-- Subject -->
          <div class="selector-group">
            <label class="selector-label">学科</label>
            <select v-model="selectedSubject" class="selector-input" :disabled="loading">
              <option value="">请选择学科</option>
              <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <!-- Grade -->
          <div class="selector-group">
            <label class="selector-label">年级</label>
            <select ref="gradeSelectRef" v-model="selectedGrade" class="selector-input" :disabled="!selectedSubject || loading || isGradesEmpty">
              <option v-if="isGradesEmpty" :value="null">暂无数据</option>
              <option v-else :value="null">请选择年级</option>
              <option v-for="g in grades" :key="g" :value="g">{{ getGradeLabel(g) }}</option>
            </select>
          </div>

          <!-- Publisher -->
          <div class="selector-group">
            <label class="selector-label">出版社</label>
            <select ref="publisherSelectRef" v-model="selectedPublisher" class="selector-input" :disabled="selectedGrade === null || loading || isPublishersEmpty">
              <option v-if="isPublishersEmpty" value="">暂无数据</option>
              <option v-else value="">请选择出版社</option>
              <option v-for="p in publishers" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <!-- Volume -->
          <div class="selector-group">
            <label class="selector-label">册别</label>
            <select ref="volumeSelectRef" v-model="selectedVolumeId" class="selector-input" :disabled="!selectedPublisher || loading || isVolumesEmpty">
              <option v-if="isVolumesEmpty" :value="null">暂无数据</option>
              <option v-else :value="null">请选择册别</option>
              <option v-for="v in volumes" :key="v.id" :value="v.id">{{ v.label }}</option>
            </select>
          </div>
        </div>

        <!-- Chapter Tree -->
        <div class="modal-body">
          <div v-if="loadingChapters" class="loading">加载章节中...</div>
          <div v-else-if="!selectedVolumeId" class="empty-state">
            请先选择学科、年级、出版社和册别
          </div>
          <div v-else-if="chapterTree.length === 0" class="empty-state">
            暂无章节数据
          </div>
          <div v-else class="chapter-tree">
            <!-- Render chapter tree with flat list + indentation -->
            <template v-for="chapter in chapterTree" :key="chapter.id">
              <div
                :class="['chapter-item', { 'is-leaf': isLeafChapter(chapter), 'is-selected': isChapterSelected(chapter.id), 'is-parent': !isLeafChapter(chapter) }]"
                @click="toggleChapter(chapter)"
              >
                <span v-if="isLeafChapter(chapter)" class="radio"></span>
                <span class="chapter-code">{{ chapter.chapterCode }}</span>
                <span class="chapter-title">{{ chapter.title }}</span>
              </div>
              <!-- Level 2 -->
              <template v-if="chapter.children">
                <template v-for="child in chapter.children" :key="child.id">
                  <div
                    :class="['chapter-item', 'level-1', { 'is-leaf': isLeafChapter(child), 'is-selected': isChapterSelected(child.id), 'is-parent': !isLeafChapter(child) }]"
                    @click="toggleChapter(child)"
                  >
                    <span v-if="isLeafChapter(child)" class="radio"></span>
                    <span class="chapter-code">{{ child.chapterCode }}</span>
                    <span class="chapter-title">{{ child.title }}</span>
                  </div>
                  <!-- Level 3 -->
                  <template v-if="child.children">
                    <template v-for="grandchild in child.children" :key="grandchild.id">
                      <div
                        :class="['chapter-item', 'level-2', { 'is-leaf': isLeafChapter(grandchild), 'is-selected': isChapterSelected(grandchild.id), 'is-parent': !isLeafChapter(grandchild) }]"
                        @click="toggleChapter(grandchild)"
                      >
                        <span v-if="isLeafChapter(grandchild)" class="radio"></span>
                        <span class="chapter-code">{{ grandchild.chapterCode }}</span>
                        <span class="chapter-title">{{ grandchild.title }}</span>
                      </div>
                      <!-- Level 4 -->
                      <template v-if="grandchild.children">
                        <div
                          v-for="greatgrandchild in grandchild.children"
                          :key="greatgrandchild.id"
                          :class="['chapter-item', 'level-3', { 'is-leaf': isLeafChapter(greatgrandchild), 'is-selected': isChapterSelected(greatgrandchild.id), 'is-parent': !isLeafChapter(greatgrandchild) }]"
                          @click="toggleChapter(greatgrandchild)"
                        >
                          <span v-if="isLeafChapter(greatgrandchild)" class="radio"></span>
                          <span class="chapter-code">{{ greatgrandchild.chapterCode }}</span>
                          <span class="chapter-title">{{ greatgrandchild.title }}</span>
                        </div>
                      </template>
                    </template>
                  </template>
                </template>
              </template>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div class="selection-summary">
            <template v-if="hasSelection">
              <span class="selection-label">已选择：</span>
              <span class="selection-title">{{ selectedChapterTitle }}</span>
              <button class="btn-clear" @click="handleReset">清除</button>
            </template>
            <span v-else class="no-selection">请在上方列表中选择一个章节</span>
          </div>
          <div class="footer-actions">
            <button class="btn-secondary" @click="handleClose">取消</button>
            <button class="btn-primary" @click="handleConfirm">确认选择</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<style scoped>
.chapter-selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.chapter-selector-container {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #0f172a;
}

.cascade-selectors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.selector-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selector-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.selector-input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.selector-input:disabled {
  background: #f1f5f9;
  cursor: not-allowed;
}

.selector-input:focus {
  outline: none;
  border-color: #2563eb;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  min-height: 300px;
}

.loading,
.empty-state {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
}

.chapter-tree {
  display: flex;
  flex-direction: column;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.chapter-item.level-1 { padding-left: 32px; }
.chapter-item.level-2 { padding-left: 52px; }
.chapter-item.level-3 { padding-left: 72px; }

.chapter-item:hover {
  background: #f8fafc;
}

.chapter-item.is-parent {
  font-weight: 600;
  color: #0f172a;
  cursor: default;
}

.chapter-item.is-parent:hover {
  background: transparent;
}

.chapter-item.is-leaf {
  cursor: pointer;
}

.chapter-item.is-selected {
  background: #eff6ff;
}

.radio {
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.radio::after {
  content: '';
  width: 0;
  height: 0;
  border-radius: 50%;
  background: #2563eb;
  transition: all 0.15s ease;
}

.chapter-item.is-selected .radio {
  border-color: #2563eb;
}

.chapter-item.is-selected .radio::after {
  width: 8px;
  height: 8px;
}

.chapter-code {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
}

.chapter-title {
  font-size: 14px;
  color: #334155;
}

.chapter-item.is-parent .chapter-title {
  color: #0f172a;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selection-summary {
  font-size: 14px;
  color: #64748b;
}

.selection-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.selection-label {
  color: #64748b;
  flex-shrink: 0;
}

.selection-title {
  color: #0f172a;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.btn-clear {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.btn-clear:hover {
  background: #fef2f2;
}

.selection-summary .no-selection {
  color: #9ca3af;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-text {
  background: none;
  border: none;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
}

.btn-text:hover {
  color: #ef4444;
}

.btn-primary {
  padding: 10px 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  padding: 10px 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f8fafc;
}

@media (max-width: 768px) {
  .cascade-selectors {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
