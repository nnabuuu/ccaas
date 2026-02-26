import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, OutputUpdate, SyncField, AgentStatusEvent, TextDeltaEvent, ToolActivityEvent, ContentBlock, ToolActivity } from '../types';

// Simple ID generator (uses crypto.randomUUID if available, falls back to timestamp)
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Use relative URL - proxied by Vite to CCAAS backend
const SOCKET_URL = '/';

interface UseProblemSessionOptions {
  sessionId?: string;
  onOutputUpdate?: (update: OutputUpdate) => void;
  tenantId?: string;
  enabledSkillSlugs?: string[];
}

interface UseProblemSessionReturn {
  messages: Message[];
  isConnected: boolean;
  isThinking: boolean;
  error: string | null;
  sendMessage: (content: string, attachments?: { type: string; path: string }[]) => Promise<void>;
  sessionId: string;
}

export function useProblemSession(options: UseProblemSessionOptions = {}): UseProblemSessionReturn {
  const { tenantId = 'problem-explainer', enabledSkillSlugs } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate sessionId locally (like lesson-plan-designer)
  const sessionIdRef = useRef<string>(options.sessionId || `pe_${generateId()}`);
  const socketRef = useRef<Socket | null>(null);
  const contentBlocksRef = useRef<ContentBlock[]>([]);
  const clientIdRef = useRef<string | null>(null);

  // Connect to Socket.io immediately (session is created on first completion request)
  useEffect(() => {

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected, socket.id:', socket.id);
      setIsConnected(true);
      setError(null);
      console.log('[Socket] Joining session:', sessionIdRef.current);
      socket.emit('session:join', { sessionId: sessionIdRef.current });
    });

    socket.on('client_id', (data: { clientId: string }) => {
      console.log('Received client ID:', data.clientId);
      clientIdRef.current = data.clientId;
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected, reason:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connect error:', err.message, err);
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    });

    // Handle text streaming (using TextDeltaEvent from @kedge-agentic/common)
    socket.on('text_delta', (data: TextDeltaEvent) => {
      console.log('[Socket] text_delta received, length:', data.delta?.length, 'preview:', data.delta?.substring(0, 50));
      const blocks = contentBlocksRef.current;
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'text') {
        last.text += data.delta;
      } else {
        blocks.push({ type: 'text', text: data.delta });
      }

      // Derive content string for backward compatibility
      const content = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('');

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
          lastMsg.content = content;
          lastMsg.contentBlocks = [...blocks];
          return [...newMessages];
        }
        return prev;
      });
    });

    // Handle agent status changes (using AgentStatusEvent from @kedge-agentic/common)
    // Valid statuses: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error'
    socket.on('agent_status', (data: AgentStatusEvent) => {
      console.log('[Socket] agent_status received:', data.status, 'context:', data.context);
      if (data.status === 'thinking' || data.status === 'running' || data.status === 'exploring' || data.status === 'executing') {
        setIsThinking(true);
        // Note: streaming message is already created in sendMessage
      } else if (data.status === 'complete' || data.status === 'error') {
        setIsThinking(false);
        // Finalize streaming message
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg?.isStreaming) {
            lastMsg.isStreaming = false;
          }
          return [...newMessages];
        });
      }
      // 'idle' status is ignored (initial state)
    });

    // Handle tool activity for inline tool cards
    socket.on('tool_activity', (data: ToolActivityEvent) => {
      console.log('[Socket] tool_activity:', data);
      const { payload } = data;
      if (!payload) return;

      const toolActivity: ToolActivity = {
        toolName: payload.toolName,
        toolId: payload.toolId || `tool-${Date.now()}`,
        phase: payload.phase,
        timestamp: new Date(),
        duration: payload.duration,
        success: payload.success,
        description: payload.description,
        toolInput: payload.toolInput,
        toolOutput: payload.toolOutput,
        toolError: payload.toolError,
      };

      const blocks = contentBlocksRef.current;
      if (payload.phase === 'start') {
        blocks.push({ type: 'tool', tool: toolActivity });
      } else if (payload.phase === 'end') {
        for (let i = blocks.length - 1; i >= 0; i--) {
          const b = blocks[i];
          if (b.type === 'tool' && b.tool.toolId === toolActivity.toolId) {
            b.tool = toolActivity;
            break;
          }
        }
      }

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
          lastMsg.contentBlocks = [...blocks];
          return [...newMessages];
        }
        return prev;
      });
    });

    // Handle output updates from write_output tool
    // Backend emits: { type: 'output_update', payload: { data, status } }
    // data can be: { field, value, preview } OR content blocks [{ type: "text", text: "{JSON}" }]
    socket.on('output_update', (event: { payload?: { data?: unknown } }) => {
      console.log('[Socket] output_update RAW event:', JSON.stringify(event, null, 2));

      if (!options.onOutputUpdate || !event.payload?.data) {
        console.warn('[Socket] output_update IGNORED - no callback or no data');
        return;
      }

      let parsed: { field?: string; value?: unknown; preview?: string } | null = null;

      const rawData = event.payload.data;

      // Case 1: direct object with field
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData) && (rawData as any).field) {
        parsed = rawData as any;
      }

      // Case 2: content blocks array [{ type: "text", text: "{JSON}" }]
      if (!parsed && Array.isArray(rawData)) {
        for (const block of rawData) {
          if (block.type === 'text' && typeof block.text === 'string') {
            try {
              const obj = JSON.parse(block.text);
              // The JSON may be wrapped: { status, data: { field, value, preview } }
              if (obj.data?.field) {
                parsed = obj.data;
              } else if (obj.field) {
                parsed = obj;
              }
            } catch {
              console.warn('[Socket] output_update failed to parse content block text');
            }
            if (parsed) break;
          }
        }
      }

      if (parsed?.field) {
        console.log('[Socket] output_update calling onOutputUpdate with field:', parsed.field);
        options.onOutputUpdate({
          field: parsed.field as SyncField,
          value: parsed.value,
          preview: parsed.preview || '',
          timestamp: Date.now(),
        });
      } else {
        console.warn('[Socket] output_update could not extract field from data:', rawData);
      }
    });

    // Handle tool events (for output_update detection)
    // Tool name can be in MCP format: mcp__problem-explainer-tools__write_output
    socket.on('tool_event', (data: { toolName: string; input?: any; output?: any }) => {
      console.log('[Socket] tool_event received:', data.toolName, 'input:', data.input, 'output:', data.output);

      if (data.toolName.endsWith('write_output')) {
        console.log('[Socket] write_output tool_event detected');

        if (!options.onOutputUpdate) {
          console.warn('[Socket] write_output tool_event IGNORED - no onOutputUpdate callback');
          return;
        }

        // The field, value, preview are in data.input (tool arguments)
        const input = data.input;
        if (input && input.field) {
          console.log('[Socket] write_output using input.field:', input.field, 'value type:', typeof input.value);
          options.onOutputUpdate({
            field: input.field as SyncField,
            value: input.value,
            preview: input.preview || '',
            timestamp: Date.now(),
          });
        } else {
          console.log('[Socket] write_output input missing field, trying output fallback');
          // Fallback: try to parse from output if input is not available
          try {
            const output = typeof data.output === 'string' ? JSON.parse(data.output) : data.output;
            console.log('[Socket] write_output parsed output:', output);
            if (output?.data?.field) {
              console.log('[Socket] write_output using output.data.field:', output.data.field);
              options.onOutputUpdate({
                field: output.data.field as SyncField,
                value: output.data.value,
                preview: output.data.preview || '',
                timestamp: Date.now(),
              });
            } else {
              console.warn('[Socket] write_output output has no data.field');
            }
          } catch (e) {
            console.error('[Socket] Failed to parse write_output event:', e, data);
          }
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.onOutputUpdate]);

  // Send message via REST API (response streams via WebSocket)
  const sendMessage = useCallback(
    async (content: string, attachments?: { type: string; path: string }[]) => {
      console.log('[sendMessage] Called with content:', content.substring(0, 100), 'attachments:', attachments);
      console.log('[sendMessage] sessionId:', sessionIdRef.current, 'clientId:', clientIdRef.current);

      if (!sessionIdRef.current || !clientIdRef.current) {
        console.error('[sendMessage] Not connected - missing sessionId or clientId');
        setError('Not connected');
        return;
      }

      // Add user message to list
      const userMessage: Message = {
        id: `msg-${generateId()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Create placeholder for assistant message
      const assistantMessage: Message = {
        id: `msg-${generateId()}`,
        role: 'assistant',
        content: '',
        contentBlocks: [],
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      contentBlocksRef.current = [];
      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(true);

      // Build chat payload
      const chatPayload: Record<string, unknown> = {
        clientId: clientIdRef.current,
        message: content,
        tenantId,
      };

      // Use session template for server-side resolution of mcpServers/skillPath
      chatPayload.templateName = 'problem-analysis';

      // Include enabled skill slugs (for tenant skill filtering)
      if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
        chatPayload.enabledSkillSlugs = enabledSkillSlugs;
        console.log('Sending with enabled skills:', enabledSkillSlugs);
      }

      // Include attachments if provided
      if (attachments && attachments.length > 0) {
        chatPayload.attachments = attachments;
      }

      try {
        // Send via RESTful API: POST /api/v1/sessions/{sessionId}/completion
        const url = `/api/v1/sessions/${sessionIdRef.current}/completion`;
        console.log('[sendMessage] POST', url);
        console.log('[sendMessage] Payload:', JSON.stringify(chatPayload, null, 2));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload),
        });

        console.log('[sendMessage] Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[sendMessage] Error response:', errorData);
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        console.log('[sendMessage] Request completed successfully');
      } catch (err) {
        console.error('[sendMessage] Failed to send message:', err);
        setError(`发送失败: ${err instanceof Error ? err.message : err}`);
        setIsThinking(false);
      }
    },
    [tenantId, enabledSkillSlugs]
  );

  return {
    messages,
    isConnected,
    isThinking,
    error,
    sendMessage,
    sessionId: sessionIdRef.current,
  };
}
