/**
 * Agent Output Renderer
 *
 * Listens to SSE events from the backend and applies data to forms.
 * This is the frontend side of the FS-Only architecture.
 *
 * Architecture (session-based):
 * Agent -> write_output -> sessions/{sessionId}/output.json -> OutputWatcher -> SSE -> Renderer -> Form
 *
 * IMPORTANT: This module is domain-agnostic.
 * The `data` field is a generic record, domain-specific rendering is handled by views.
 */

import { ref, computed, watch } from 'vue';

/**
 * Progress information
 * Domain-agnostic: uses string-based step identifiers.
 */
export interface ProgressInfo {
  totalSteps: number;
  completedSteps: number;
  currentStep?: string;
  currentStepName?: string;
  percentage: number;
}

/**
 * Agent output structure
 * Domain-agnostic: data is a generic record.
 */
export interface AgentOutput {
  version: number;
  sessionId: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  timestamp: string;
  data: Record<string, unknown>;
  progress: ProgressInfo;
  error?: string;
}

/**
 * SSE event from backend
 */
export interface OutputChangeEvent {
  type: 'init' | 'change' | 'error';
  sessionId?: string;
  data?: AgentOutput;
  error?: string;
  timestamp: string;
}

/**
 * Form setter callback - receives generic data
 */
export type FormSetter = (data: Record<string, unknown>) => void;

/**
 * Progress listener callback
 */
export type ProgressListener = (progress: ProgressInfo) => void;

/**
 * Agent Output Renderer
 *
 * Connects to SSE endpoint and applies updates to forms.
 * Domain-agnostic - passes generic data to form setters.
 */
export class AgentOutputRenderer {
  private eventSource: EventSource | null = null;
  private formSetter: FormSetter | null = null;
  private progressListeners: Set<ProgressListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private currentSessionId: string | null = null;
  private currentBaseUrl: string = '';
  private currentClientId: string | undefined = undefined;

  // Reactive state
  private _isConnected = ref(false);
  private _currentOutput = ref<AgentOutput | null>(null);
  private _error = ref<string | null>(null);
  private _sessionId = ref<string | null>(null);

  /**
   * Reactive connection status
   */
  get isConnected() {
    return this._isConnected;
  }

  /**
   * Reactive current output
   */
  get currentOutput() {
    return this._currentOutput;
  }

  /**
   * Reactive error state
   */
  get error() {
    return this._error;
  }

  /**
   * Computed: is generating
   */
  get isGenerating() {
    return computed(() => this._currentOutput.value?.status === 'generating');
  }

  /**
   * Computed: progress percentage
   */
  get progressPercentage() {
    return computed(() => this._currentOutput.value?.progress.percentage ?? 0);
  }

  /**
   * Reactive session ID
   */
  get sessionId() {
    return this._sessionId;
  }

  /**
   * Connect to the SSE endpoint for a specific session
   *
   * @param baseUrl Backend base URL (e.g., 'http://localhost:3001')
   * @param options Connection options
   * @param options.clientId Optional client ID for tracking
   * @param options.sessionId Session ID to subscribe to (required for multi-user support)
   */
  start(baseUrl: string = '', options?: { clientId?: string; sessionId?: string }): void {
    if (this.eventSource) {
      console.log('[Renderer] Already connected');
      return;
    }

    const clientId = options?.clientId;
    const sessionId = options?.sessionId || 'default';
    this.currentSessionId = sessionId;
    this.currentBaseUrl = baseUrl;
    this.currentClientId = clientId;
    this._sessionId.value = sessionId;

    // Build URL with query parameters
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('sessionId', sessionId);

    const url = `${baseUrl}/agent/output/stream?${params.toString()}`;

    console.log('[Renderer] Connecting to:', url);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[Renderer] SSE connection opened');
        this._isConnected.value = true;
        this._error.value = null;
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.eventSource.onerror = (error) => {
        console.error('[Renderer] SSE error:', error);
        this._isConnected.value = false;
        this._error.value = 'Connection lost';

        // Close and attempt reconnect
        this.eventSource?.close();
        this.eventSource = null;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[Renderer] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.start(baseUrl, { clientId, sessionId }), this.reconnectDelay);
        } else {
          this._error.value = 'Failed to connect after multiple attempts';
        }
      };
    } catch (error) {
      console.error('[Renderer] Failed to create EventSource:', error);
      this._error.value = 'Failed to connect';
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.eventSource) {
      console.log('[Renderer] Stopping SSE connection');
      this.eventSource.close();
      this.eventSource = null;
    }
    this._isConnected.value = false;
  }

  /**
   * Reconnect to a new session
   * Automatically stops existing connection and starts a new one
   *
   * @param sessionId New session ID to connect to
   */
  reconnect(sessionId: string): void {
    if (sessionId === this.currentSessionId && this.eventSource) {
      console.log('[Renderer] Same session, skipping reconnect');
      return;
    }

    console.log('[Renderer] Reconnecting to new session:', sessionId);
    this.stop();
    this.reconnectAttempts = 0;
    this.start(this.currentBaseUrl, {
      clientId: this.currentClientId,
      sessionId,
    });
  }

  /**
   * Register form setter callback
   *
   * @param setter Function to call when data changes
   */
  setFormSetter(setter: FormSetter): void {
    this.formSetter = setter;

    // Apply current data immediately if available
    if (this._currentOutput.value?.data) {
      setter(this._currentOutput.value.data);
    }
  }

  /**
   * Add progress listener
   */
  addProgressListener(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);

    // Call immediately with current progress
    if (this._currentOutput.value?.progress) {
      listener(this._currentOutput.value.progress);
    }

    // Return unsubscribe function
    return () => this.progressListeners.delete(listener);
  }

  /**
   * Handle SSE message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as OutputChangeEvent;
      console.log('[Renderer] Received event:', data.type);

      if (data.type === 'error') {
        this._error.value = data.error || 'Unknown error';
        return;
      }

      if (data.data) {
        this._currentOutput.value = data.data;
        this._error.value = null;

        // Apply to form
        if (this.formSetter && data.data.data) {
          this.formSetter(data.data.data);
        }

        // Notify progress listeners
        if (data.data.progress) {
          for (const listener of this.progressListeners) {
            listener(data.data.progress);
          }
        }
      }
    } catch (error) {
      console.error('[Renderer] Failed to parse message:', error);
    }
  }
}

// Singleton instance
let renderer: AgentOutputRenderer | null = null;

/**
 * Get the singleton renderer instance
 */
export function getRenderer(): AgentOutputRenderer {
  if (!renderer) {
    renderer = new AgentOutputRenderer();
  }
  return renderer;
}

/**
 * Vue composable for using the renderer
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgentRenderer } from '@/agent/renderer';
 *
 * const { isConnected, isGenerating, progress, start, stop, setFormSetter } = useAgentRenderer();
 *
 * onMounted(() => {
 *   // Connect to a specific session for multi-user support
 *   start('http://localhost:3001', { sessionId: 'my-session-123' });
 *   setFormSetter((data) => {
 *     formData.value = { ...formData.value, ...data };
 *   });
 * });
 *
 * onUnmounted(() => stop());
 * </script>
 * ```
 */
export function useAgentRenderer() {
  const renderer = getRenderer();

  return {
    // Reactive state
    isConnected: renderer.isConnected,
    isGenerating: renderer.isGenerating,
    progress: computed(() => renderer.currentOutput.value?.progress),
    currentOutput: renderer.currentOutput,
    error: renderer.error,
    sessionId: renderer.sessionId,

    // Methods
    start: (baseUrl?: string, options?: { clientId?: string; sessionId?: string }) =>
      renderer.start(baseUrl, options),
    stop: () => renderer.stop(),
    reconnect: (sessionId: string) => renderer.reconnect(sessionId),
    setFormSetter: (setter: FormSetter) => renderer.setFormSetter(setter),
    addProgressListener: (listener: ProgressListener) => renderer.addProgressListener(listener),
  };
}

// Legacy export alias for backward compatibility
export { AgentOutputRenderer as LessonPlanRenderer };
