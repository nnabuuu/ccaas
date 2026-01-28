import { useState, useCallback } from 'react';

interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export function useFileUpload(sessionId: string | null) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, directory = 'images/'): Promise<UploadResult> => {
      if (!sessionId) {
        return { success: false, error: 'No session ID' };
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        formData.append('targetPath', directory);

        const response = await fetch('/api/v1/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Upload failed');
        }

        const data = await response.json();
        return {
          success: true,
          path: data.originalPath || data.path,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setUploadError(message);
        return { success: false, error: message };
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId]
  );

  return {
    uploadFile,
    isUploading,
    uploadError,
  };
}
