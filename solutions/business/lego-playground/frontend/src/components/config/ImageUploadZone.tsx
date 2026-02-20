import React, { useCallback, useRef, useState } from 'react';
import { useMosaicStore } from '../../hooks/useStore';

export default function ImageUploadZone() {
  const sourceImage = useMosaicStore((s) => s.sourceImage);
  const sourceImageUrl = useMosaicStore((s) => s.sourceImageUrl);
  const setSourceImage = useMosaicStore((s) => s.setSourceImage);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) {
        alert('Image must be under 10MB');
        return;
      }
      setSourceImage(file);
    },
    [setSourceImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  if (sourceImage && sourceImageUrl) {
    return (
      <div className="relative">
        <img
          src={sourceImageUrl}
          alt="Source"
          className="w-full rounded-lg border border-gray-200 object-cover"
          style={{ maxHeight: '160px' }}
        />
        <button
          onClick={() => setSourceImage(null)}
          className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/80"
        >
          ×
        </button>
        <p className="text-[10px] text-gray-400 mt-1 truncate">{sourceImage.name}</p>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 bg-gray-50'
      }`}
    >
      <div className="text-2xl mb-1">🖼️</div>
      <p className="text-xs text-gray-500">Drop image here or click</p>
      <p className="text-[10px] text-gray-400 mt-0.5">JPEG, PNG, WebP (max 10MB)</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />
    </div>
  );
}
