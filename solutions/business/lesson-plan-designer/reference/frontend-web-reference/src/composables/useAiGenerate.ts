/**
 * AI Content Generation Composable
 *
 * Provides AI content generation functionality for lesson plan sections.
 * Communicates with the agentic backend to trigger content generation
 * and updates the form state via formStateSynchronizer.
 *
 * @example
 * ```ts
 * const { generateSection, generating, generatingSection } = useAiGenerate()
 *
 * // Generate content for a specific section
 * await generateSection('textbookAnalysis')
 * ```
 */

import { ref, inject, computed } from 'vue'
import { formStateSynchronizer } from '../agent/form-state-synchronizer'
import { useAuthStore } from '../stores/core/authStore'
import toast from '../utils/toast'

/**
 * Section names that support AI generation
 * Note: courseRequirements uses API matching, not LLM generation
 */
export type GeneratableSectionName =
  | 'textbookAnalysis'
  | 'learningObjectives'
  | 'studentAnalysis'
  | 'preClassPreparation'
  | 'learningProcess'
  | 'homeworkAssessment'

/**
 * Chinese display names for sections
 */
export const sectionDisplayNames: Record<GeneratableSectionName, string> = {
  textbookAnalysis: '教材分析',
  learningObjectives: '学习目标',
  studentAnalysis: '学情分析',
  preClassPreparation: '课前准备',
  learningProcess: '学习过程',
  homeworkAssessment: '作业检测',
}

/**
 * Check if a section name is generatable by AI
 */
export function isGeneratableSection(sectionName: string): sectionName is GeneratableSectionName {
  return sectionName in sectionDisplayNames
}

/**
 * AI Generate composable return type
 */
export interface UseAiGenerateReturn {
  /** Whether any section is currently generating */
  generating: ReturnType<typeof ref<boolean>>
  /** The section currently being generated (null if none) */
  generatingSection: ReturnType<typeof ref<GeneratableSectionName | null>>
  /** Generate content for a specific section */
  generateSection: (sectionName: GeneratableSectionName) => Promise<boolean>
  /** Generate all sections at once */
  generateAll: () => Promise<boolean>
  /** Refine existing content with feedback */
  refineSection: (sectionName: GeneratableSectionName, feedback: string) => Promise<boolean>
  /** Check if a specific section is generating */
  isGenerating: (sectionName: string) => boolean
}

/**
 * Create AI generation composable
 */
export function useAiGenerate(): UseAiGenerateReturn {
  const generating = ref(false)
  const generatingSection = ref<GeneratableSectionName | null>(null)

  // Get client ID from AgentListener
  const clientId = inject('agentClientId', ref(''))
  const isConnected = inject('agentConnected', ref(false))

  // Auth store for token
  const authStore = useAuthStore()

  /**
   * Send a message to the agent backend
   */
  async function sendToAgent(message: string): Promise<{ success: boolean; text?: string; error?: string }> {
    if (!clientId.value) {
      console.warn('[useAiGenerate] Not connected to agent backend')
      return { success: false, error: '未连接到 AI 服务' }
    }

    try {
      const response = await fetch('http://localhost:3001/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          clientId: clientId.value,
          authToken: authStore.token,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return { success: true, text: data.text }
    } catch (error) {
      console.error('[useAiGenerate] Error sending to agent:', error)
      return { success: false, error: (error as Error).message || '请求失败' }
    }
  }

  /**
   * Generate content for a specific section
   */
  async function generateSection(sectionName: GeneratableSectionName): Promise<boolean> {
    if (generating.value) {
      toast.warning('正在生成中，请稍候')
      return false
    }

    if (!isConnected.value) {
      toast.error('未连接到 AI 服务')
      return false
    }

    generating.value = true
    generatingSection.value = sectionName

    try {
      const displayName = sectionDisplayNames[sectionName]
      toast.info(`正在生成${displayName}...`)

      // Send request to agent - it will use the fill-lesson-plan skill
      const result = await sendToAgent(`请帮我生成${displayName}`)

      if (!result.success) {
        toast.error(`生成${displayName}失败：${result.error}`)
        return false
      }

      toast.success(`${displayName}生成完成`)
      return true
    } catch (error) {
      console.error('[useAiGenerate] Error generating section:', error)
      toast.error(`生成失败：${(error as Error).message || '未知错误'}`)
      return false
    } finally {
      generating.value = false
      generatingSection.value = null
    }
  }

  /**
   * Generate all sections at once
   */
  async function generateAll(): Promise<boolean> {
    if (generating.value) {
      toast.warning('正在生成中，请稍候')
      return false
    }

    if (!isConnected.value) {
      toast.error('未连接到 AI 服务')
      return false
    }

    generating.value = true

    try {
      toast.info('正在生成所有内容...')

      // Send request to agent
      const result = await sendToAgent('请帮我生成所有教案内容')

      if (!result.success) {
        toast.error(`生成失败：${result.error}`)
        return false
      }

      toast.success('内容生成完成')
      return true
    } catch (error) {
      console.error('[useAiGenerate] Error generating all:', error)
      toast.error(`生成失败：${(error as Error).message || '未知错误'}`)
      return false
    } finally {
      generating.value = false
      generatingSection.value = null
    }
  }

  /**
   * Refine existing content with feedback
   */
  async function refineSection(sectionName: GeneratableSectionName, feedback: string): Promise<boolean> {
    if (generating.value) {
      toast.warning('正在生成中，请稍候')
      return false
    }

    if (!isConnected.value) {
      toast.error('未连接到 AI 服务')
      return false
    }

    if (!feedback.trim()) {
      toast.warning('请输入修改意见')
      return false
    }

    generating.value = true
    generatingSection.value = sectionName

    try {
      const displayName = sectionDisplayNames[sectionName]
      toast.info(`正在优化${displayName}...`)

      // Send request to agent
      const result = await sendToAgent(`请根据以下意见优化${displayName}：${feedback}`)

      if (!result.success) {
        toast.error(`优化${displayName}失败：${result.error}`)
        return false
      }

      toast.success(`${displayName}优化完成`)
      return true
    } catch (error) {
      console.error('[useAiGenerate] Error refining section:', error)
      toast.error(`优化失败：${(error as Error).message || '未知错误'}`)
      return false
    } finally {
      generating.value = false
      generatingSection.value = null
    }
  }

  /**
   * Check if a specific section is currently generating
   */
  function isGenerating(sectionName: string): boolean {
    return generating.value && generatingSection.value === sectionName
  }

  return {
    generating,
    generatingSection,
    generateSection,
    generateAll,
    refineSection,
    isGenerating,
  }
}
