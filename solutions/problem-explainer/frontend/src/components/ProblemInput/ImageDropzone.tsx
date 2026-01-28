import { useCallback, useState } from 'react';
import { Upload, X, Image } from 'lucide-react';

interface ImageDropzoneProps {
  imagePath: string | null;
  onUpload: (path: string | null) => void;
  sessionId: string | null;
  label?: string;
  inputId?: string;
  targetPath?: string;
}

export default function ImageDropzone({
  imagePath,
  onUpload,
  sessionId,
  label = 'Drag, paste or click to upload',
  inputId = 'image-upload',
  targetPath = 'images/',
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      if (!sessionId) {
        // If no session yet, just show preview, actual upload happens on message send
        onUpload(`pending:${file.name}`);
        return;
      }

      // Upload to CCAAS
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        formData.append('targetPath', targetPath);

        const response = await fetch('/api/v1/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();
        onUpload(result.originalPath || result.path);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            break;
          }
        }
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onUpload(null);
  }, [onUpload]);

  // Show uploaded image
  if (imagePath || previewUrl) {
    return (
      <div className="relative">
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Uploaded problem"
              className="w-full h-32 object-contain"
            />
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-gray-400">
              <Image className="w-8 h-8" />
            </div>
          )}
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-sm text-gray-500">uploading...</div>
          </div>
        )}
      </div>
    );
  }

  // Show dropzone
  const dropzoneClasses = isDragging 
    ? 'border-blue-500 bg-blue-50' 
    : 'border-gray-300 hover:border-gray-400';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dropzoneClasses}`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        id={inputId}
      />
      <label htmlFor={inputId} className="cursor-pointer">
        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
        <p className="text-xs text-gray-500">{label}</p>
      </label>
    </div>
  );
}
