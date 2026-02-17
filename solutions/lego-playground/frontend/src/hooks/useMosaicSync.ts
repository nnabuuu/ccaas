import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMosaicStore } from './useStore';

const TENANT_ID = 'lego-playground';

// MCP server config matching solution.json
const MCP_SERVERS = {
  'lego-mosaic-tools': {
    command: 'node',
    args: ['mcp-server/dist/stdio-server.js'],
    description: 'LEGO Mosaic Designer MCP tools',
  },
};

// Absolute path to the skill file
const SOLUTION_ROOT = '/Users/niex/Documents/GitHub/kedge-ccaas/solutions/lego-playground';
const SKILL_PATH = `${SOLUTION_ROOT}/skills/lego-mosaic-designer/SKILL.md`;

/**
 * Upload a file to CCAAS workspace via /api/v1/files/upload
 * Returns the workspace-relative path for use as attachment.
 */
async function uploadFileToCCAAS(
  file: File,
  sessionId: string,
  targetPath: string = 'images/',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', sessionId);
  formData.append('tenantId', TENANT_ID);
  formData.append('targetPath', targetPath);

  const response = await fetch('/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Upload failed: ${err.message || response.statusText}`);
  }

  const result = await response.json();
  // result.originalPath is the workspace-relative path, e.g. "images/photo.png"
  return result.originalPath || result.path;
}

export function useMosaicSync(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const handleSyncField = useMosaicStore((s) => s.handleSyncField);
  const addMessage = useMosaicStore((s) => s.addMessage);

  useEffect(() => {
    if (!sessionId) return;

    // Connect via Vite proxy (matches lesson-plan-designer pattern)
    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[MosaicSync] Connected to CCAAS');
    });

    // Receive client ID from CCAAS
    socket.on('client_id', (data: { clientId: string }) => {
      console.log('[MosaicSync] Received client ID:', data.clientId);
      clientIdRef.current = data.clientId;
    });

    // Handle output_update events from AI agent via write_output
    socket.on('output_update', (data: unknown) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        // Support both direct field format and nested payload format
        const inner = (parsed as any)?.payload?.data || (parsed as any)?.data || parsed;

        if (inner?.field && inner?.value !== undefined) {
          handleSyncField(inner.field, inner.value);

          if (inner.preview) {
            addMessage({
              id: `sync-${Date.now()}`,
              role: 'system',
              content: `[Sync] ${inner.field}: ${inner.preview}`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('[MosaicSync] Failed to parse output_update:', err);
      }
    });

    // Handle tool_event for write_output (alternative path)
    socket.on('tool_event', (data: { toolName: string; input?: any; output?: any }) => {
      if (data.toolName.endsWith('write_output') && data.input?.field) {
        handleSyncField(data.input.field, data.input.value);
      }
    });

    // Handle streamed text from AI (text_delta events)
    let accumulatedText = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    socket.on('text_delta', (data: unknown) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const text = (parsed as any)?.delta;
        if (typeof text === 'string') {
          accumulatedText += text;

          if (flushTimer) clearTimeout(flushTimer);
          flushTimer = setTimeout(() => {
            if (accumulatedText.trim()) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: accumulatedText,
                timestamp: new Date().toISOString(),
              });
              accumulatedText = '';
            }
          }, 300);
        }
      } catch (err) {
        console.error('[MosaicSync] Failed to parse text_delta:', err);
      }
    });

    // Handle agent status changes
    socket.on('agent_status', (data: any) => {
      const status = data?.status;
      console.log('[MosaicSync] Agent status:', status);

      if (status === 'complete' || status === 'error') {
        if (flushTimer) clearTimeout(flushTimer);
        if (accumulatedText.trim()) {
          addMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: accumulatedText,
            timestamp: new Date().toISOString(),
          });
          accumulatedText = '';
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('[MosaicSync] Disconnected');
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      socket.disconnect();
      socketRef.current = null;
      clientIdRef.current = null;
    };
  }, [sessionId, handleSyncField, addMessage]);

  /**
   * Send a message via REST completion API.
   * If there's a source image in the store that hasn't been uploaded yet,
   * upload it first and attach it to the message.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !clientIdRef.current) {
        console.error('[MosaicSync] Not connected - missing sessionId or clientId');
        return;
      }

      // Add user message to store
      useMosaicStore.getState().addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      });

      // Check if there's a source image to attach
      const sourceImage = useMosaicStore.getState().sourceImage;
      let attachments: { type: string; path: string }[] | undefined;

      if (sourceImage) {
        try {
          console.log('[MosaicSync] Uploading image to CCAAS workspace...');
          const imagePath = await uploadFileToCCAAS(sourceImage, sessionId);
          attachments = [{ type: 'image', path: imagePath }];
          console.log('[MosaicSync] Image uploaded:', imagePath);
        } catch (err) {
          console.error('[MosaicSync] Failed to upload image:', err);
          useMosaicStore.getState().addMessage({
            id: `err-${Date.now()}`,
            role: 'system',
            content: `Image upload failed: ${err instanceof Error ? err.message : err}`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Build completion payload
      const payload: Record<string, unknown> = {
        clientId: clientIdRef.current,
        message: content,
        tenantId: TENANT_ID,
        mcpServers: MCP_SERVERS,
        skillPath: SKILL_PATH,
      };

      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }

      try {
        const url = `/api/v1/sessions/${sessionId}/completion`;
        console.log('[MosaicSync] POST', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        console.log('[MosaicSync] Completion request sent successfully');
      } catch (err) {
        console.error('[MosaicSync] Failed to send message:', err);
        useMosaicStore.getState().addMessage({
          id: `err-${Date.now()}`,
          role: 'system',
          content: `Failed to send: ${err instanceof Error ? err.message : err}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [sessionId],
  );

  return { sendMessage };
}
