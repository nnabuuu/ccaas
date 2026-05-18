import { useState } from 'react'
import { ImageCaptureButton } from './ImageCaptureButton'

interface ImageGalleryProps {
  images: string[]
  maxImages: number
  onAdd: (dataUri: string) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

export function ImageGallery({ images, maxImages, onAdd, onRemove, disabled }: ImageGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  return (
    <>
      <div className="ic-gallery">
        {images.map((src, i) => (
          <div key={i} className="ic-thumb-wrap">
            <img src={src} alt={`图片 ${i + 1}`} onClick={() => setLightboxIdx(i)} />
            {!disabled && (
              <button className="ic-thumb-remove" onClick={() => onRemove(i)} aria-label="删除">×</button>
            )}
          </div>
        ))}
        {!disabled && images.length < maxImages && (
          <ImageCaptureButton onCapture={onAdd} disabled={disabled} variant="button" />
        )}
      </div>
      {images.length > 0 && (
        <div className="ic-count">{images.length}/{maxImages} 张图片</div>
      )}

      {lightboxIdx !== null && (
        <div className="ic-lightbox" onClick={() => setLightboxIdx(null)}>
          <img src={images[lightboxIdx]} alt="预览" />
        </div>
      )}
    </>
  )
}
