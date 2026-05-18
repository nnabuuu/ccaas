import { useState, useRef, useCallback } from 'react'
import { Camera } from '@phosphor-icons/react'
import { compressImage } from '../../../utils/compress-image'
import { useCamera } from './useCamera'
import { CameraModal } from './CameraModal'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ImageCaptureButtonProps {
  onCapture: (dataUri: string) => void
  disabled?: boolean
  variant?: 'button' | 'icon'
}

export function ImageCaptureButton({ onCapture, disabled, variant = 'button' }: ImageCaptureButtonProps) {
  const { hasCamera, permission, facing, requestPermission, switchFacing } = useCamera()
  const [showCamera, setShowCamera] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCameraClick = useCallback(async () => {
    if (!hasCamera || permission === 'unavailable') {
      fileRef.current?.click()
      return
    }
    if (permission === 'denied') {
      setShowCamera(true) // show denied message
      return
    }
    if (permission === 'prompt') {
      const granted = await requestPermission()
      if (!granted) {
        fileRef.current?.click()
        return
      }
    }
    setShowCamera(true)
  }, [hasCamera, permission, requestPermission])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_FILE_SIZE) return
    setCompressing(true)
    try {
      const compressed = await compressImage(file)
      onCapture(compressed)
    } catch { /* ignore corrupt files */ }
    finally { setCompressing(false) }
  }, [onCapture])

  if (variant === 'icon') {
    return (
      <>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <button
          className="sd-camera-btn"
          onClick={handleCameraClick}
          disabled={disabled || compressing}
          title="拍照"
          aria-label="拍照"
        >
          <Camera size={20} />
        </button>
        {showCamera && (
          <CameraModal
            facing={facing}
            permission={permission}
            onCapture={onCapture}
            onClose={() => setShowCamera(false)}
            onSwitchFacing={switchFacing}
          />
        )}
      </>
    )
  }

  return (
    <div className="ic-capture-btn">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <button
        className="stu-btn sec"
        onClick={handleCameraClick}
        disabled={disabled || compressing}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {compressing ? '压缩中...' : <><Camera size={18} /> 拍照/上传</>}
      </button>
      {hasCamera && permission !== 'unavailable' && (
        <button className="ic-file-link" onClick={() => fileRef.current?.click()} disabled={disabled || compressing}>
          选择文件
        </button>
      )}
      {showCamera && (
        <CameraModal
          facing={facing}
          permission={permission}
          onCapture={onCapture}
          onClose={() => setShowCamera(false)}
          onSwitchFacing={switchFacing}
        />
      )}
    </div>
  )
}
