/**
 * Pinia store for conversation persistence with localStorage
 * Stores chat history and enables resuming conversations across page reloads
 */
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'agent_conversation'
const MAX_MESSAGES = 100

export const useConversationStore = defineStore('conversation', () => {
  // State
  const messages = ref([])
  const traceIds = ref([])
  const clientId = ref('')
  const lastUpdated = ref(null)

  // Load from localStorage on init
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        messages.value = data.messages || []
        traceIds.value = data.traceIds || []
        clientId.value = data.clientId || ''
        lastUpdated.value = data.lastUpdated || null
        console.log('[ConversationStore] Loaded from localStorage:', messages.value.length, 'messages')
      }
    } catch (error) {
      console.error('[ConversationStore] Failed to load from localStorage:', error)
    }
  }

  // Save to localStorage
  function saveToStorage() {
    try {
      const data = {
        messages: messages.value.slice(-MAX_MESSAGES), // Keep last N messages
        traceIds: traceIds.value.slice(-50), // Keep last 50 trace IDs
        clientId: clientId.value,
        lastUpdated: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('[ConversationStore] Failed to save to localStorage:', error)
    }
  }

  // Watch for changes and auto-save
  watch([messages, traceIds], () => {
    saveToStorage()
  }, { deep: true })

  // Actions
  function addUserMessage(content) {
    messages.value.push({
      type: 'user',
      content,
      timestamp: new Date().toISOString(),
    })
    lastUpdated.value = new Date().toISOString()
  }

  function addAgentMessage(content) {
    messages.value.push({
      type: 'agent',
      content,
      timestamp: new Date().toISOString(),
    })
    lastUpdated.value = new Date().toISOString()
  }

  function addToolCalls(toolCalls) {
    messages.value.push({
      type: 'tools',
      toolCalls,
      timestamp: new Date().toISOString(),
    })
    lastUpdated.value = new Date().toISOString()
  }

  function addErrorMessage(content) {
    messages.value.push({
      type: 'error',
      content,
      timestamp: new Date().toISOString(),
    })
    lastUpdated.value = new Date().toISOString()
  }

  function addTraceId(traceId) {
    if (!traceIds.value.includes(traceId)) {
      traceIds.value.push(traceId)
    }
  }

  function setClientId(id) {
    clientId.value = id
    saveToStorage()
  }

  function clearConversation() {
    messages.value = []
    traceIds.value = []
    lastUpdated.value = null
    localStorage.removeItem(STORAGE_KEY)
    console.log('[ConversationStore] Conversation cleared')
  }

  // Get messages formatted for display
  function getDisplayMessages() {
    return messages.value.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  }

  // Check if there's a previous conversation to resume
  function hasPreviousConversation() {
    return messages.value.length > 0
  }

  // Initialize on store creation
  loadFromStorage()

  return {
    // State
    messages,
    traceIds,
    clientId,
    lastUpdated,
    // Getters
    getDisplayMessages,
    hasPreviousConversation,
    // Actions
    addUserMessage,
    addAgentMessage,
    addToolCalls,
    addErrorMessage,
    addTraceId,
    setClientId,
    clearConversation,
    loadFromStorage,
    saveToStorage,
  }
})
