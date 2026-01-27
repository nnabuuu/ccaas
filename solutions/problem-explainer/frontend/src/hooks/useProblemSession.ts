import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, OutputUpdate, SyncField, AgentStatusEvent, TextDeltaEvent } from '../types';

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
  const currentMessageRef = useRef<string>('');
  const clientIdRef = useRef<string | null>(null);

  // Connect to Socket.io immediately (session is created on first completion request)
  useEffect(() => {

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socket.emit('session:join', { sessionId: sessionIdRef.current });
    });

    socket.on('client_id', (data: { clientId: string }) => {
      console.log('Received client ID:', data.clientId);
      clientIdRef.current = data.clientId;
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    });

    // Handle text streaming (using TextDeltaEvent from @ccaas/shared)
    socket.on('text_delta', (data: TextDeltaEvent) => {
      currentMessageRef.current += data.text;
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
          lastMsg.content = currentMessageRef.current;
          return [...newMessages];
        }
        return prev;
      });
    });

    // Handle agent status changes (using AgentStatusEvent from @ccaas/shared)
    // Valid statuses: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error'
    socket.on('agent_status', (data: AgentStatusEvent) => {
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

    // Handle output updates from write_output tool
    socket.on('output_update', (data: { field: string; value: unknown; preview: string }) => {
      if (options.onOutputUpdate) {
        options.onOutputUpdate({
          field: data.field as SyncField,
          value: data.value,
          preview: data.preview,
          timestamp: Date.now(),
        });
      }
    });

    // Handle tool events (for output_update detection)
    socket.on('tool_event', (data: { toolName: string; input?: any; output?: any }) => {
      if (data.toolName === 'write_output' && data.output) {
        try {
          const result = typeof data.output === 'string' ? JSON.parse(data.output) : data.output;
          if (result.status === 'success' && result.data && options.onOutputUpdate) {
            options.onOutputUpdate({
              field: result.data.field as SyncField,
              value: result.data.value,
              preview: result.data.preview,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          console.error('Failed to parse tool output:', e);
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
      if (!sessionIdRef.current || !clientIdRef.current) {
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
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      currentMessageRef.current = '';
      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(true);

      // Build chat payload
      const chatPayload: Record<string, unknown> = {
        clientId: clientIdRef.current,
        message: content,
        tenantId,
      };

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
        const response = await fetch(`/api/v1/sessions/${sessionIdRef.current}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }
      } catch (err) {
        console.error('Failed to send message:', err);
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
