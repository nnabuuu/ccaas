<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { skillsApi } from '@/api/admin'
import type { Skill, SkillVersion } from '@/types/admin'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  RollbackOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const publishing = ref(false)
const skill = ref<Skill | null>(null)
const versions = ref<SkillVersion[]>([])
const showVersions = ref(false)

const idOrSlug = computed(() => route.params.idOrSlug as string)

onMounted(() => {
  loadSkill()
})

async function loadSkill() {
  loading.value = true
  try {
    const [skillResponse, versionsData] = await Promise.all([
      axios.get<Skill>(`/api/v1/skills/${idOrSlug.value}`, {
        headers: authStore.getAuthHeaders()
      }),
      skillsApi.getVersions(idOrSlug.value)
    ])
    skill.value = skillResponse.data
    versions.value = versionsData
  } catch (error) {
    message.error('Failed to load skill')
    console.error(error)
    router.push('/skills')
  } finally {
    loading.value = false
  }
}

async function saveSkill() {
  if (!skill.value) return

  saving.value = true
  try {
    await axios.put(`/api/v1/skills/${skill.value.id}`, {
      name: skill.value.name,
      description: skill.value.description,
      content: skill.value.content,
      createVersion: true
    }, {
      headers: authStore.getAuthHeaders()
    })
    message.success('Skill saved')
    loadSkill()
  } catch (error) {
    message.error('Failed to save skill')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function publishSkill() {
  if (!skill.value) return

  Modal.confirm({
    title: 'Publish Skill',
    content: 'Are you sure you want to publish this skill? It will become active for all users.',
    okText: 'Publish',
    async onOk() {
      publishing.value = true
      try {
        await skillsApi.publish(idOrSlug.value)
        message.success('Skill published')
        loadSkill()
      } catch (error) {
        message.error('Failed to publish skill')
      } finally {
        publishing.value = false
      }
    }
  })
}

async function rollbackToVersion(version: string) {
  Modal.confirm({
    title: 'Rollback to Version',
    content: `Are you sure you want to rollback to version ${version}? This will replace the current content.`,
    okText: 'Rollback',
    async onOk() {
      try {
        await skillsApi.rollback(idOrSlug.value, version)
        message.success(`Rolled back to version ${version}`)
        showVersions.value = false
        loadSkill()
      } catch (error) {
        message.error('Failed to rollback')
      }
    }
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'published': return 'green'
    case 'draft': return 'orange'
    case 'review': return 'blue'
    default: return 'default'
  }
}
</script>

<template>
  <div class="skill-editor">
    <div class="page-header">
      <div class="header-left">
        <a-button type="text" @click="router.push('/skills')">
          <ArrowLeftOutlined />
        </a-button>
        <div v-if="skill">
          <h1>{{ skill.name }}</h1>
          <div class="skill-meta">
            <code>{{ skill.slug }}</code>
            <a-tag :color="getStatusColor(skill.status)" style="margin-left: 8px;">
              {{ skill.status }}
            </a-tag>
            <span style="margin-left: 8px; color: #999;">v{{ skill.currentVersion }}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <a-button @click="showVersions = true">
          <HistoryOutlined />
          Versions
        </a-button>
        <a-button @click="saveSkill" :loading="saving">
          <SaveOutlined />
          Save
        </a-button>
        <a-button
          type="primary"
          @click="publishSkill"
          :loading="publishing"
          :disabled="skill?.status === 'published'"
        >
          <CloudUploadOutlined />
          Publish
        </a-button>
      </div>
    </div>

    <a-spin :spinning="loading">
      <div class="editor-layout" v-if="skill">
        <!-- Left: Editor -->
        <div class="editor-panel">
          <div class="card">
            <div class="card-header">
              <h3>Skill Content</h3>
            </div>
            <div class="card-body">
              <a-form layout="vertical">
                <a-form-item label="Name">
                  <a-input v-model:value="skill.name" />
                </a-form-item>

                <a-form-item label="Description">
                  <a-textarea
                    v-model:value="skill.description"
                    :rows="2"
                    placeholder="Brief description of what this skill does"
                  />
                </a-form-item>

                <a-form-item label="Content (Markdown)">
                  <a-textarea
                    v-model:value="skill.content"
                    :rows="20"
                    class="code-editor"
                    placeholder="# Skill Prompt

Enter your skill prompt here..."
                  />
                </a-form-item>
              </a-form>
            </div>
          </div>
        </div>

        <!-- Right: Info -->
        <div class="info-panel">
          <div class="card">
            <div class="card-header">
              <h3>Skill Info</h3>
            </div>
            <div class="card-body">
              <a-descriptions :column="1" size="small">
                <a-descriptions-item label="ID">
                  <code>{{ skill.id }}</code>
                </a-descriptions-item>
                <a-descriptions-item label="Type">
                  {{ skill.type }}
                </a-descriptions-item>
                <a-descriptions-item label="Status">
                  <a-tag :color="getStatusColor(skill.status)">
                    {{ skill.status }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="Version">
                  v{{ skill.currentVersion }}
                </a-descriptions-item>
                <a-descriptions-item label="Created">
                  {{ dayjs(skill.createdAt).format('YYYY-MM-DD HH:mm') }}
                </a-descriptions-item>
                <a-descriptions-item label="Updated">
                  {{ dayjs(skill.updatedAt).format('YYYY-MM-DD HH:mm') }}
                </a-descriptions-item>
                <a-descriptions-item label="Published" v-if="skill.publishedAt">
                  {{ dayjs(skill.publishedAt).format('YYYY-MM-DD HH:mm') }}
                </a-descriptions-item>
              </a-descriptions>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- Version History Drawer -->
    <a-drawer
      v-model:open="showVersions"
      title="Version History"
      placement="right"
      :width="400"
    >
      <a-timeline>
        <a-timeline-item
          v-for="version in versions"
          :key="version.id"
          :color="version.version === skill?.currentVersion ? 'green' : 'gray'"
        >
          <div class="version-item">
            <div class="version-header">
              <strong>v{{ version.version }}</strong>
              <a-tag v-if="version.version === skill?.currentVersion" color="green" size="small">
                Current
              </a-tag>
            </div>
            <div class="version-time">
              {{ dayjs(version.createdAt).format('YYYY-MM-DD HH:mm') }}
            </div>
            <div class="version-changelog" v-if="version.changelog">
              {{ version.changelog }}
            </div>
            <div class="version-actions" v-if="version.version !== skill?.currentVersion">
              <a-button
                size="small"
                @click="rollbackToVersion(version.version)"
              >
                <RollbackOutlined />
                Rollback
              </a-button>
            </div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-drawer>
  </div>
</template>

<style scoped>
.skill-editor {
  max-width: 1400px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.skill-meta {
  margin-top: 8px;
}

.skill-meta code {
  color: #666;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.editor-layout {
  display: flex;
  gap: 24px;
}

.editor-panel {
  flex: 1;
}

.info-panel {
  width: 300px;
  flex-shrink: 0;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.card-body {
  padding: 24px;
}

.code-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.version-item {
  margin-bottom: 8px;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.version-changelog {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.version-actions {
  margin-top: 8px;
}
</style>
