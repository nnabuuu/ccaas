import { useState } from 'react'
import { useT, type Locale } from '../../../i18n'
import { ImageCaptureButton } from './ImageCaptureButton'

interface ImageGalleryProps {
  images: string[]
  maxImages: number
  onAdd: (dataUri: string) => void
  onRemove: (index: number) => void
  disabled?: boolean
  locale?: Locale
}

export function ImageGallery({ images, maxImages, onAdd, onRemove, disabled, locale }: ImageGalleryProps) {
  const t = useT(locale)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  return (
    <>
      <div className="ic-gallery">
        {images.map((src, i) => (
          <div key={i} className="ic-thumb-wrap">
            <img src={src} alt={t('gallery.imageAlt', { n: i + 1 })} onClick={() => setLightboxIdx(i)} />
            {!disabled && (
              <button className="ic-thumb-remove" onClick={() => onRemove(i)} aria-label={t('gallery.remove')}>×</button>
            )}
          </div>
        ))}
        {!disabled && images.length < maxImages && (
          <ImageCaptureButton onCapture={onAdd} disabled={disabled} variant="button" />
        )}
      </div>
      {images.length > 0 && (
        <div className="ic-count">{t('gallery.count', { n: images.length, max: maxImages })}</div>
      )}

      {lightboxIdx !== null && (
        <div className="ic-lightbox" onClick={() => setLightboxIdx(null)}>
          <img src={images[lightboxIdx]} alt={t('gallery.preview')} />
        </div>
      )}
    </>
  )
}
