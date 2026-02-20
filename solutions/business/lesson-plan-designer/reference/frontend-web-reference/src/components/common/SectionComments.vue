<script setup lang="ts">
/**
 * SectionComments - Reusable threaded comment section for any target entity
 *
 * @example
 * <SectionComments
 *   targetType="project_content"
 *   :targetId="contentId"
 *   :allowReply="true"
 * />
 */
import { ref, computed, onMounted, watch } from 'vue'
import { commentApi } from '@/api'
import type { CommentTreeNode } from '@/types'

const props = defineProps({
  targetType: {
    type: String,
    required: true
  },
  targetId: {
    type: Number,
    required: true
  },
  allowReply: {
    type: Boolean,
    default: true
  }
})

// State
const comments = ref<CommentTreeNode[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const newComment = ref('')
const submitting = ref(false)
const replyingTo = ref<number | null>(null)
const replyContent = ref('')

// Computed
const hasComments = computed(() => comments.value.length > 0)
const totalCount = computed(() => {
  let count = 0
  const countReplies = (nodes: CommentTreeNode[]) => {
    for (const node of nodes) {
      count++
      if (node.replies && node.replies.length > 0) {
        countReplies(node.replies)
      }
    }
  }
  countReplies(comments.value)
  return count
})

// Methods
async function fetchComments() {
  if (!props.targetId) return

  loading.value = true
  error.value = null

  try {
    const response = await commentApi.getThreaded(props.targetType, props.targetId)
    comments.value = response.data || []
  } catch (err) {
    console.error('[SectionComments] Failed to fetch comments:', err)
    error.value = '加载评论失败'
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return

  submitting.value = true
  try {
    await commentApi.create({
      targetType: props.targetType,
      targetId: props.targetId,
      content: newComment.value.trim()
    })
    newComment.value = ''
    await fetchComments()
  } catch (err) {
    console.error('[SectionComments] Failed to submit comment:', err)
    error.value = '发送评论失败'
  } finally {
    submitting.value = false
  }
}

async function submitReply(parentId: number) {
  if (!replyContent.value.trim()) return

  submitting.value = true
  try {
    await commentApi.create({
      targetType: props.targetType,
      targetId: props.targetId,
      content: replyContent.value.trim(),
      parentId
    })
    replyContent.value = ''
    replyingTo.value = null
    await fetchComments()
  } catch (err) {
    console.error('[SectionComments] Failed to submit reply:', err)
    error.value = '发送回复失败'
  } finally {
    submitting.value = false
  }
}

function startReply(commentId: number) {
  replyingTo.value = commentId
  replyContent.value = ''
}

function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

function formatTime(time: string | undefined): string {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Less than 1 minute
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  }
  // Less than 1 day
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  }
  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  }
  // Otherwise show date
  return date.toLocaleDateString('zh-CN')
}

// Lifecycle
onMounted(() => {
  fetchComments()
})

// Watch for targetId changes
watch(() => props.targetId, () => {
  fetchComments()
})
</script>

<template>
  <div class="section-comments">
    <div class="comments-header">
      <h4 class="comments-title">
        评论
        <span v-if="totalCount > 0" class="comment-count">({{ totalCount }})</span>
      </h4>
    </div>

    <!-- New comment input -->
    <div class="new-comment">
      <textarea
        v-model="newComment"
        placeholder="写下你的评论..."
        rows="2"
        class="comment-input"
        :disabled="submitting"
      ></textarea>
      <div class="comment-actions">
        <button
          class="btn btn-primary btn-sm"
          :disabled="!newComment.trim() || submitting"
          @click="submitComment"
        >
          {{ submitting ? '发送中...' : '发送' }}
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="comments-loading">
      加载中...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="comments-error">
      {{ error }}
      <button class="retry-btn" @click="fetchComments">重试</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!hasComments" class="comments-empty">
      暂无评论，快来发表第一条评论吧
    </div>

    <!-- Comments list -->
    <div v-else class="comments-list">
      <div v-for="comment in comments" :key="comment.id" class="comment-item">
        <div class="comment-avatar">
          {{ (comment.userName || '用户').charAt(0) }}
        </div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-author">{{ comment.userName || '用户' }}</span>
            <span class="comment-time">{{ formatTime(comment.createTime) }}</span>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
          <div v-if="allowReply" class="comment-footer">
            <button class="reply-btn" @click="startReply(comment.id)">
              回复
            </button>
          </div>

          <!-- Reply input for this comment -->
          <div v-if="replyingTo === comment.id" class="reply-input-wrapper">
            <textarea
              v-model="replyContent"
              placeholder="写下你的回复..."
              rows="2"
              class="comment-input reply-input"
              :disabled="submitting"
            ></textarea>
            <div class="reply-actions">
              <button class="btn btn-text btn-sm" @click="cancelReply">取消</button>
              <button
                class="btn btn-primary btn-sm"
                :disabled="!replyContent.trim() || submitting"
                @click="submitReply(comment.id)"
              >
                {{ submitting ? '发送中...' : '回复' }}
              </button>
            </div>
          </div>

          <!-- Nested replies -->
          <div v-if="comment.replies && comment.replies.length > 0" class="comment-replies">
            <div v-for="reply in comment.replies" :key="reply.id" class="comment-item reply-item">
              <div class="comment-avatar reply-avatar">
                {{ (reply.userName || '用户').charAt(0) }}
              </div>
              <div class="comment-body">
                <div class="comment-meta">
                  <span class="comment-author">{{ reply.userName || '用户' }}</span>
                  <span class="comment-time">{{ formatTime(reply.createTime) }}</span>
                </div>
                <div class="comment-content">{{ reply.content }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-comments {
  padding: 16px 0;
}

.comments-header {
  margin-bottom: 16px;
}

.comments-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.comment-count {
  color: #6b7280;
  font-weight: normal;
}

.new-comment {
  margin-bottom: 20px;
}

.comment-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.comment-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.comment-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.comment-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-text {
  background: none;
  color: #6b7280;
}

.btn-text:hover {
  color: #374151;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
}

.comments-loading,
.comments-error,
.comments-empty {
  text-align: center;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}

.comments-error {
  color: #dc2626;
}

.retry-btn {
  margin-left: 8px;
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  text-decoration: underline;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  display: flex;
  gap: 12px;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  flex-shrink: 0;
}

.reply-avatar {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.comment-time {
  font-size: 12px;
  color: #9ca3af;
}

.comment-content {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-footer {
  margin-top: 8px;
}

.reply-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.reply-btn:hover {
  color: #3b82f6;
}

.reply-input-wrapper {
  margin-top: 12px;
}

.reply-input {
  min-height: 50px;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.comment-replies {
  margin-top: 12px;
  padding-left: 12px;
  border-left: 2px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reply-item {
  padding: 0;
}
</style>
