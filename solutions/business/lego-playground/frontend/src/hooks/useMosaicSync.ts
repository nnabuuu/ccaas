import { useCallback } from 'react';
import {
  useAgentConnection,
  useAgentChat,
  type OutputUpdate,
  type UseAgentConnectionReturn,
  type UseAgentChatReturn,
} from '@kedge-agentic/react-sdk';
import { useMosaicStore } from './useStore';

const TENANT_ID = 'lego-playground';

// IMPORTANT: Must use absolute URL to backend, NOT relative path or empty string
// See MEMORY.md: "Empty string causes SDK to use current origin (frontend port)"
const SERVER_URL = 'http://localhost:3001'; // Core CCAAS backend

/**
 * Upload a file to CCAAS workspace via /api/v1/files/upload
 * Returns the workspace-relative path for use as attachment.
 */
async function uploadFileToCCAAS(
  serverUrl: string,
  file: File,
  sessionId: string,
  targetPath: string = 'images/',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', sessionId);
  formData.append('tenantId', TENANT_ID);
  formData.append('targetPath', targetPath);

  const response = await fetch(`${serverUrl}/api/v1/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Upload failed: ${err.message || response.statusText}`);
  }

  const result = await response.json();
  return result.originalPath || result.path;
}

export interface UseMosaicSyncReturn {
  sendMessage: (content: string) => Promise<void>;
  connection: UseAgentConnectionReturn;
  chat: UseAgentChatReturn;
}

export function useMosaicSync(sessionId: string | null): UseMosaicSyncReturn {
  const handleSyncField = useMosaicStore((s) => s.handleSyncField);

  const onOutputUpdate = useCallback(
    (update: OutputUpdate) => {
      if (update.field && update.value !== undefined) {
        handleSyncField(update.field, update.value);
      }
    },
    [handleSyncField],
  );

  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    sessionPrefix: 'lego',
    transport: 'sse',
    autoConnect: !!sessionId,
  });

  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    sessionTemplate: 'mosaic-designer',
    onOutputUpdate,
  });

  /**
   * Send a message to the AI agent.
   * If there's a source image in the store that hasn't been uploaded yet,
   * upload it first and attach it to the message.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) {
        console.error('[MosaicSync] Not connected - missing sessionId');
        return;
      }

      // Check if there's a source image to attach
      const sourceImage = useMosaicStore.getState().sourceImage;
      let attachments: { type: string; path: string }[] | undefined;

      if (sourceImage) {
        try {
          console.log('[MosaicSync] Uploading image to CCAAS workspace...');
          const imagePath = await uploadFileToCCAAS(
            connection.serverUrl,
            sourceImage,
            connection.sessionId,
          );
          attachments = [{ type: 'image', path: imagePath }];
          console.log('[MosaicSync] Image uploaded:', imagePath);
        } catch (err) {
          console.error('[MosaicSync] Failed to upload image:', err);
        }
      }

      await chat.sendMessage(content, { attachments });
    },
    [sessionId, connection.serverUrl, connection.sessionId, chat],
  );

  return { sendMessage, connection, chat };
}
