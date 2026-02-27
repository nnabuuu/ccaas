<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageSidebar from '../components/PageSidebar.vue'
import { BaseModal } from '../components/layout'
import { lessonPlanApi, gradeApi, favoriteApi, shareApi, userApi } from '../api/index'
import type { FavoriteItem, ShareItem } from '../api/index'
import toast from '../utils/toast'
import type { LessonPlan, Grade, LessonPlanQuery, User } from '@/types'

interface GradeOption {
  value: string | number
  label: string
}

interface LessonPlanItem {
  id: number
  title: string
  tags: string[]
  author: string
  org: string
  time: string
  status: string | null
  favorited: boolean
}

interface LessonPlanWithExtras extends LessonPlan {
  createByName?: string
  authorName?: string
  deptName?: string
  organizationName?: string
  gradeName?: string
  name?: string
  textbookVersion?: string
  semester?: number
  chapter?: string
}

const router = useRouter()

const activeSidebarIndex = ref(0)
const loading = ref(false)
const searchKeyword = ref('')
const selectedGrade = ref<string | number>('')
const selectedSubject = ref('')
const grades = ref<GradeOption[]>([])

// Favorites state
const favoritedIds = ref<Set<string>>(new Set())
const favorites = ref<FavoriteItem[]>([])

// Shares state
const shares = ref<ShareItem[]>([])

// Share modal state
const showShareModal = ref(false)
const sharingPlanId = ref<number | null>(null)
const sharingPlanTitle = ref('')
const shareToUser = ref('')
const sharing = ref(false)

// User search state
const userSearchQuery = ref('')
const userSearchResults = ref<User[]>([])
const showUserDropdown = ref(false)
const highlightedIndex = ref(-1)
const userSearching = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lessonPlanSearchTimer: ReturnType<typeof setTimeout> | null = null

// Confirm modal state
const confirmAction = ref<{ type: 'publish' | 'delete'; id: number; title: string } | null>(null)

// Tab loading state
const tabLoading = ref(false)

// Recent share targets (computed from shares)
const recentTargets = computed(() => {
  const seen = new Set<string>()
  const targets: string[] = []
  for (const s of shares.value) {
    if (!seen.has(s.sharedTo)) {
      seen.add(s.sharedTo)
      targets.push(s.sharedTo)
    }
    if (targets.length >= 5) break
  }
  return targets
})

const searchUsers = (query: string) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  userSearchQuery.value = query
  highlightedIndex.value = -1
  if (!query.trim()) {
    userSearchResults.value = []
    showUserDropdown.value = false
    userSearching.value = false
    return
  }
  userSearching.value = true
  showUserDropdown.value = true
  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await userApi.search({ nickName: query.trim(), pageSize: 10 })
      const data = res as { data?: { rows?: User[] }; rows?: User[] }
      userSearchResults.value = data.data?.rows || data.rows || []
      showUserDropdown.value = true
    } catch (error) {
      console.error('Failed to search users:', error)
      userSearchResults.value = []
    } finally {
      userSearching.value = false
    }
  }, 300)
}

const selectUser = (user: User) => {
  shareToUser.value = user.userName
  userSearchQuery.value = user.nickName
  showUserDropdown.value = false
  highlightedIndex.value = -1
}

const selectRecentTarget = (name: string) => {
  shareToUser.value = name
  userSearchQuery.value = name
  showUserDropdown.value = false
}

const handleSearchKeydown = (e: KeyboardEvent) => {
  if (!showUserDropdown.value || userSearchResults.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, userSearchResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (e.key === 'Enter' && highlightedIndex.value >= 0) {
    e.preventDefault()
    selectUser(userSearchResults.value[highlightedIndex.value])
  } else if (e.key === 'Escape') {
    showUserDropdown.value = false
    highlightedIndex.value = -1
  }
}

const handleSearchBlur = () => {
  setTimeout(() => {
    showUserDropdown.value = false
    highlightedIndex.value = -1
  }, 150)
}

const sidebarItems = [
  { label: '全部教案', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { label: '我的收藏', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { label: '我的分享', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' }
]

const lessonPlans = ref<LessonPlanItem[]>([])

const hasActiveFilter = computed(() =>
  searchKeyword.value || selectedGrade.value || selectedSubject.value
)

const subjects = [
  { value: '', label: '全部学科' },
  { value: '语文', label: '语文' },
  { value: '数学', label: '数学' },
  { value: '英语', label: '英语' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' },
  { value: '生物', label: '生物' },
  { value: '历史', label: '历史' },
  { value: '地理', label: '地理' }
]

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\//g, '.')
}

const buildTags = (item: LessonPlanWithExtras) => {
  const tags: string[] = []
  if (item.textbookVersion) tags.push(item.textbookVersion)
  if (item.subject) tags.push(item.subject)
  if (item.gradeName) tags.push(item.gradeName)
  if (item.semester) tags.push(item.semester === 1 ? '上册' : '下册')
  if (item.chapter) tags.push(item.chapter)
  return tags
}

const fetchFavorites = async () => {
  try {
    const list = await favoriteApi.list()
    favorites.value = list
    favoritedIds.value = new Set(list.map(f => f.lessonPlanId))
  } catch (error) {
    console.error('Failed to fetch favorites:', error)
  }
}

const fetchShares = async () => {
  try {
    shares.value = await shareApi.listByMe()
  } catch (error) {
    console.error('Failed to fetch shares:', error)
  }
}

const fetchLessonPlans = async () => {
  loading.value = true
  try {
    const params: LessonPlanQuery = {
      pageNum: 1,
      pageSize: 20
    }
    if (searchKeyword.value) params.title = searchKeyword.value
    if (selectedGrade.value) params.gradeLevel = Number(selectedGrade.value)
    if (selectedSubject.value) params.subject = selectedSubject.value

    const response = await lessonPlanApi.getList(params)
    const data = response as { data?: { rows?: LessonPlanWithExtras[] }; rows?: LessonPlanWithExtras[] }
    lessonPlans.value = (data.data?.rows || data.rows || []).map((item: LessonPlanWithExtras) => ({
      id: item.id,
      title: item.title || item.name || '',
      tags: buildTags(item),
      author: item.createByName || item.authorName || '未知',
      org: item.deptName || item.organizationName || '',
      time: formatDate(item.createTime),
      status: String(item.status) === '1' ? 'published' : null,
      favorited: favoritedIds.value.has(String(item.id))
    }))
  } catch (error) {
    console.error('Failed to fetch lesson plans:', error)
  } finally {
    loading.value = false
  }
}

interface GradeWithName extends Grade {
  name?: string
}

const fetchGrades = async () => {
  try {
    const response = await gradeApi.getList({ pageSize: 100 })
    const data = response as { data?: { rows?: GradeWithName[] }; rows?: GradeWithName[] }
    grades.value = [
      { value: '', label: '全部年级' },
      ...(data.data?.rows || data.rows || []).map((g: GradeWithName) => ({
        value: g.id,
        label: g.name || g.gradeName
      }))
    ]
  } catch (error) {
    console.error('Failed to fetch grades:', error)
    grades.value = [{ value: '', label: '全部年级' }]
  }
}

const handleSidebarSelect = async (index: number) => {
  activeSidebarIndex.value = index
  if (index === 1) {
    tabLoading.value = true
    await fetchFavorites()
    tabLoading.value = false
  } else if (index === 2) {
    tabLoading.value = true
    await fetchShares()
    tabLoading.value = false
  }
}

const toggleFavorite = async (item: LessonPlanItem) => {
  const planId = String(item.id)
  try {
    if (item.favorited) {
      await favoriteApi.remove(planId)
      favoritedIds.value.delete(planId)
      item.favorited = false
      toast.success('已取消收藏')
    } else {
      await favoriteApi.add(planId)
      favoritedIds.value.add(planId)
      item.favorited = true
      toast.success('已收藏')
    }
    // Refresh favorites list if on favorites tab
    if (activeSidebarIndex.value === 1) {
      await fetchFavorites()
    }
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to toggle favorite:', err)
    toast.error('操作失败：' + err.message)
  }
}

const openShareModal = async (item: LessonPlanItem) => {
  sharingPlanId.value = item.id
  sharingPlanTitle.value = item.title
  shareToUser.value = ''
  userSearchQuery.value = ''
  userSearchResults.value = []
  showUserDropdown.value = false
  highlightedIndex.value = -1
  showShareModal.value = true
  // Preload shares for recent targets
  if (shares.value.length === 0) {
    await fetchShares()
  }
}

const closeShareModal = () => {
  showShareModal.value = false
  sharingPlanId.value = null
  sharingPlanTitle.value = ''
  shareToUser.value = ''
  userSearchQuery.value = ''
  userSearchResults.value = []
  showUserDropdown.value = false
  highlightedIndex.value = -1
}

const handleShare = async () => {
  if (!sharingPlanId.value || !shareToUser.value.trim()) return
  sharing.value = true
  try {
    await shareApi.share({
      lessonPlanId: String(sharingPlanId.value),
      sharedTo: shareToUser.value.trim()
    })
    toast.success('分享成功')
    closeShareModal()
    // Refresh shares list if on shares tab
    if (activeSidebarIndex.value === 2) {
      await fetchShares()
    }
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to share:', err)
    toast.error('分享失败：' + err.message)
  } finally {
    sharing.value = false
  }
}

const revokeShare = async (shareId: string) => {
  try {
    await shareApi.revoke(shareId)
    toast.success('已撤销分享')
    await fetchShares()
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to revoke share:', err)
    toast.error('撤销失败：' + err.message)
  }
}

const removeFavorite = async (lessonPlanId: string) => {
  try {
    await favoriteApi.remove(lessonPlanId)
    favoritedIds.value.delete(lessonPlanId)
    toast.success('已取消收藏')
    await fetchFavorites()
    // Also update main list if visible
    const plan = lessonPlans.value.find(p => String(p.id) === lessonPlanId)
    if (plan) plan.favorited = false
  } catch (error: unknown) {
    const err = error as Error
    console.error('Failed to remove favorite:', err)
    toast.error('操作失败：' + err.message)
  }
}

const requestPublish = (item: LessonPlanItem) => {
  confirmAction.value = { type: 'publish', id: item.id, title: item.title }
}

const requestDelete = (item: LessonPlanItem) => {
  confirmAction.value = { type: 'delete', id: item.id, title: item.title }
}

const executeConfirm = async () => {
  if (!confirmAction.value) return
  const { type, id } = confirmAction.value
  confirmAction.value = null
  if (type === 'publish') {
    try {
      await lessonPlanApi.update({ id, status: 1 } as Parameters<typeof lessonPlanApi.update>[0])
      toast.success('发布成功')
      await fetchLessonPlans()
    } catch (error: unknown) {
      const err = error as Error
      console.error('Failed to publish lesson plan:', err)
      toast.error('发布失败：' + err.message)
    }
  } else {
    try {
      await lessonPlanApi.delete(id)
      toast.success('删除成功')
      await fetchLessonPlans()
    } catch (error: unknown) {
      const err = error as Error
      console.error('Failed to delete lesson plan:', err)
      toast.error('删除失败：' + err.message)
    }
  }
}

const cancelConfirm = () => {
  confirmAction.value = null
}

const handleEdit = (id: number) => {
  router.push(`/lesson-plan/${id}`)
}

const handleCreate = () => {
  router.push('/lesson-plan/new')
}

const clearFilters = () => {
  searchKeyword.value = ''
  selectedGrade.value = ''
  selectedSubject.value = ''
  fetchLessonPlans()
}

watch([selectedGrade, selectedSubject], () => {
  fetchLessonPlans()
})

watch(searchKeyword, () => {
  if (lessonPlanSearchTimer) clearTimeout(lessonPlanSearchTimer)
  lessonPlanSearchTimer = setTimeout(() => fetchLessonPlans(), 300)
})

onMounted(async () => {
  await fetchFavorites()
  fetchLessonPlans()
  fetchGrades()
})
</script>

<template>
  <div class="page-container">
    <div class="page-content">
      <PageSidebar
        :items="sidebarItems"
        :active-index="activeSidebarIndex"
        @select="handleSidebarSelect"
      />

      <main class="page-main">
        <!-- Tab 0: All Lesson Plans -->
        <template v-if="activeSidebarIndex === 0">
          <!-- Filters -->
          <div class="filter-bar">
            <div class="filter-group">
              <select class="form-select" v-model="selectedGrade">
                <option v-for="grade in grades" :key="grade.value" :value="grade.value">
                  {{ grade.label }}
                </option>
              </select>
              <select class="form-select" v-model="selectedSubject">
                <option v-for="subject in subjects" :key="subject.value" :value="subject.value">
                  {{ subject.label }}
                </option>
              </select>
              <div class="search-box">
                <input
                  type="text"
                  class="form-input"
                  placeholder="搜索教案..."
                  v-model="searchKeyword"
                  style="padding-right: 2.5rem;"
                >
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="fetchLessonPlans" style="cursor: pointer;">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
            </div>
            <button class="btn btn-primary" @click="handleCreate">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              创建教案
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="loading-state">
            <span>加载中...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="lessonPlans.length === 0" class="empty-state">
            <template v-if="hasActiveFilter">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <p>未找到匹配的教案</p>
              <button class="btn-text" @click="clearFilters">清除筛选条件</button>
            </template>
            <template v-else>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p>暂无教案数据</p>
            </template>
          </div>

          <!-- List -->
          <div v-else class="list-container">
            <div v-for="item in lessonPlans" :key="item.id" class="list-card" @click="router.push(`/lesson-plan/${item.id}`)">
              <div class="card-header">
                <h3 class="card-title">
                  <router-link :to="`/lesson-plan/${item.id}`" @click.stop>{{ item.title }}</router-link>
                </h3>
                <div class="card-actions">
                  <button
                    class="action-btn favorite-btn"
                    :class="{ active: item.favorited }"
                    :aria-label="item.favorited ? '取消收藏' : '收藏'"
                    @click.stop="toggleFavorite(item)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" :fill="item.favorited ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                  <button class="action-btn" @click.stop="openShareModal(item)">分享</button>
                  <button v-if="item.status !== 'published'" class="action-btn" @click.stop="requestPublish(item)">发布</button>
                  <button class="action-btn" @click.stop="handleEdit(item.id)">编辑</button>
                  <button class="action-btn danger" @click.stop="requestDelete(item)">删除</button>
                </div>
              </div>
              <div class="card-tags">
                <span v-for="(tag, index) in item.tags" :key="index" class="tag-text">
                  {{ tag }}
                  <span v-if="index < item.tags.length - 1" class="tag-divider">|</span>
                </span>
                <span v-if="item.status === 'published'" class="status-badge published">已发布</span>
              </div>
              <div class="card-footer">
                <div class="author-info">
                  <div class="author-avatar"></div>
                  <span class="author-name">{{ item.author }}</span>
                  <span v-if="item.org" class="author-org">{{ item.org }}</span>
                </div>
                <span class="card-time">{{ item.time }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Tab 1: My Favorites -->
        <template v-if="activeSidebarIndex === 1">
          <div v-if="tabLoading" class="loading-state">
            <span>加载中...</span>
          </div>
          <div v-else-if="favorites.length === 0" class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <p>暂无收藏的教案</p>
          </div>
          <div v-else class="list-container">
            <div v-for="fav in favorites" :key="fav.id" class="list-card" @click="router.push(`/lesson-plan/${fav.lessonPlanId}`)">
              <div class="card-header">
                <h3 class="card-title">
                  <router-link :to="`/lesson-plan/${fav.lessonPlanId}`" @click.stop>{{ fav.title || '未命名教案' }}</router-link>
                </h3>
                <div class="card-actions">
                  <button class="action-btn danger" @click.stop="removeFavorite(fav.lessonPlanId)">取消收藏</button>
                </div>
              </div>
              <div class="card-tags">
                <span v-if="fav.subject" class="tag-text">{{ fav.subject }}</span>
                <span v-if="fav.status === 'PUBLISHED'" class="status-badge published">已发布</span>
              </div>
              <div class="card-footer">
                <span class="card-time">收藏于 {{ formatDate(fav.createTime) }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Tab 2: My Shares -->
        <template v-if="activeSidebarIndex === 2">
          <div v-if="tabLoading" class="loading-state">
            <span>加载中...</span>
          </div>
          <div v-else-if="shares.length === 0" class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <p>暂无分享记录</p>
          </div>
          <div v-else class="list-container">
            <div v-for="share in shares" :key="share.id" class="list-card">
              <div class="card-header">
                <h3 class="card-title">
                  <router-link :to="`/lesson-plan/${share.lessonPlanId}`" @click.stop>{{ share.title || '未命名教案' }}</router-link>
                </h3>
                <div class="card-actions">
                  <button class="action-btn danger" @click.stop="revokeShare(share.id)">撤销</button>
                </div>
              </div>
              <div class="card-tags">
                <span class="tag-text">分享给: {{ share.sharedTo }}</span>
                <span class="tag-divider">|</span>
                <span class="tag-text">权限: {{ share.permission === 'view' ? '查看' : '编辑' }}</span>
              </div>
              <div class="card-footer">
                <span class="card-time">分享于 {{ formatDate(share.createTime) }}</span>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- Share Modal -->
    <BaseModal
      v-model:visible="showShareModal"
      title="分享教案"
      size="md"
      @close="closeShareModal"
    >
      <p class="modal-hint">将「{{ sharingPlanTitle }}」分享给：</p>

      <!-- Recent share targets -->
      <div v-if="recentTargets.length > 0" class="recent-targets">
        <label class="form-label">最近分享</label>
        <div class="target-chips" role="group" aria-label="最近分享的用户">
          <button
            v-for="target in recentTargets"
            :key="target"
            class="target-chip"
            :class="{ active: shareToUser === target }"
            :aria-pressed="shareToUser === target"
            @click="selectRecentTarget(target)"
          >
            {{ target }}
          </button>
        </div>
      </div>

      <!-- Divider between sections -->
      <div v-if="recentTargets.length > 0" class="section-divider"></div>

      <!-- User search -->
      <div class="form-group">
        <label class="form-label" for="share-user-search">搜索用户</label>
        <div class="user-search-wrapper">
          <svg class="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="share-user-search"
            type="text"
            class="form-input search-input-with-icon"
            :value="userSearchQuery"
            placeholder="输入姓名搜索..."
            role="combobox"
            :aria-expanded="showUserDropdown"
            aria-haspopup="listbox"
            aria-controls="user-search-listbox"
            aria-autocomplete="list"
            :aria-activedescendant="highlightedIndex >= 0 ? `user-option-${highlightedIndex}` : undefined"
            @input="searchUsers(($event.target as HTMLInputElement).value)"
            @focus="showUserDropdown = userSearchResults.length > 0 || userSearching"
            @blur="handleSearchBlur"
            @keydown="handleSearchKeydown"
          />
          <div
            v-if="showUserDropdown"
            id="user-search-listbox"
            class="user-dropdown"
            role="listbox"
            aria-label="搜索结果"
          >
            <!-- Loading state -->
            <div v-if="userSearching && userSearchResults.length === 0" class="dropdown-empty">
              搜索中...
            </div>
            <!-- Empty state -->
            <div v-else-if="!userSearching && userSearchResults.length === 0" class="dropdown-empty">
              未找到匹配用户
            </div>
            <!-- Results -->
            <div
              v-for="(user, index) in userSearchResults"
              :id="`user-option-${index}`"
              :key="user.userId"
              class="dropdown-item"
              :class="{ highlighted: index === highlightedIndex }"
              role="option"
              :aria-selected="index === highlightedIndex"
              @mousedown.prevent="selectUser(user)"
              @mouseenter="highlightedIndex = index"
            >
              <span class="dropdown-nick">{{ user.nickName }}</span>
              <span class="dropdown-username">({{ user.userName }})</span>
              <span v-if="user.deptName" class="dropdown-dept">{{ user.deptName }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Selected user hint -->
      <div v-if="shareToUser" class="selected-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        将分享给: <strong>{{ shareToUser }}</strong>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="closeShareModal">取消</button>
        <button class="btn-primary" @click="handleShare" :disabled="!shareToUser.trim() || sharing">
          {{ sharing ? '分享中...' : '确认分享' }}
        </button>
      </template>
    </BaseModal>

    <!-- Confirm Modal (Publish/Delete) -->
    <BaseModal
      :visible="!!confirmAction"
      :title="confirmAction?.type === 'publish' ? '确认发布' : '确认删除'"
      size="sm"
      @close="cancelConfirm"
    >
      <p v-if="confirmAction?.type === 'publish'" class="modal-hint">
        确定要发布「{{ confirmAction.title }}」吗？发布后所有人可见。
      </p>
      <p v-else-if="confirmAction?.type === 'delete'" class="modal-hint confirm-delete-hint">
        确定要删除「{{ confirmAction?.title }}」吗？此操作无法撤销。
      </p>
      <template #footer>
        <button class="btn-secondary" @click="cancelConfirm">取消</button>
        <button
          :class="confirmAction?.type === 'delete' ? 'btn-danger' : 'btn-primary'"
          @click="executeConfirm"
        >
          {{ confirmAction?.type === 'publish' ? '确认发布' : '确认删除' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

.page-content {
  display: flex;
  gap: 24px;
}

.page-main {
  flex: 1;
  min-width: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}

.list-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
}

.card-title a {
  color: #3b82f6;
}

.card-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.action-btn {
  padding: 4px 8px;
  background: none;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:hover {
  color: #3b82f6;
  background: #f0f5ff;
}

.action-btn.danger:hover {
  color: #ef4444;
  background: #fef2f2;
}

.favorite-btn {
  display: flex;
  align-items: center;
  color: #9ca3af;
}

.favorite-btn:hover,
.favorite-btn.active {
  color: #f59e0b;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tag-text {
  font-size: 14px;
  color: #4b5563;
}

.tag-divider {
  color: #d1d5db;
  margin: 0 4px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f59e0b;
}

.author-name,
.author-org {
  padding: 4px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 14px;
  color: #4b5563;
}

.card-time {
  font-size: 14px;
  color: #9ca3af;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #9ca3af;
  gap: 16px;
}

.empty-state svg {
  color: #d1d5db;
}

.empty-state p {
  font-size: 16px;
}

/* Modal styles */
.modal-hint {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.recent-targets {
  margin-bottom: 0;
}

.target-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.target-chip {
  padding: 6px 14px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1.4;
}

.target-chip:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.target-chip:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.target-chip.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.section-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 16px 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.user-search-wrapper {
  position: relative;
}

.search-input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
  z-index: 1;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

.search-input-with-icon {
  padding-left: 34px;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.user-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s ease;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: #eff6ff;
}

.dropdown-nick {
  color: #111827;
  font-weight: 500;
}

.dropdown-username {
  color: #6b7280;
  font-size: 13px;
}

.dropdown-dept {
  color: #9ca3af;
  font-size: 12px;
  margin-left: auto;
}

.dropdown-empty {
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}

.selected-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px 0 0 0;
  padding: 8px 12px;
  font-size: 13px;
  color: #1d4ed8;
  background: #eff6ff;
  border-radius: 6px;
}

.selected-hint svg {
  color: #3b82f6;
  flex-shrink: 0;
}

.btn-secondary {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  padding: 8px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: white;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.published {
  background: #dcfce7;
  color: #166534;
}

.btn-text {
  padding: 4px 8px;
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
}

.btn-text:hover {
  text-decoration: underline;
}

.btn-danger {
  padding: 8px 16px;
  background: #ef4444;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: white;
  cursor: pointer;
}

.btn-danger:hover {
  background: #dc2626;
}

.confirm-delete-hint {
  color: #dc2626;
}

@media (max-width: 768px) {
  .page-content {
    flex-direction: column;
  }
}
</style>
