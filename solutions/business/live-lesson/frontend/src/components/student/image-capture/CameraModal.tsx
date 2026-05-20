import { useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { X, ArrowsClockwise } from '@phosphor-icons/react'
import { compressDataUri } from '../../../utils/compress-image'
import { useT, type Locale } from '../../../i18n'
import type { CameraPermission } from './useCamera'

interface CameraModalProps {
  facing: 'user' | 'environment'
  permission: CameraPermission
  onCapture: (dataUri: string) => void
  onClose: () => void
  onSwitchFacing: () => void
  locale?: Locale
}

export function CameraModal({ facing, permission, onCapture, onClose, onSwitchFacing, locale }: CameraModalProps) {
  const t = useT(locale)
  const webcamRef = useRef<Webcam>(null)
  const capturingRef = useRef(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleShutter = useCallback(async () => {
    if (capturingRef.current) return
    capturingRef.current = true
    const screenshot = webcamRef.current?.getScreenshot()
    if (!screenshot) { capturingRef.current = false; return }
    const compressed = await compressDataUri(screenshot)
    onCapture(compressed)
    onClose()
  }, [onCapture, onClose])

  if (permission === 'denied') {
    return (
      <div className="ic-overlay">
        <div className="ic-denied-msg">
          <div>{t('camera.permDenied')}</div>
          <div>{t('camera.permMsg')}</div>
          <button onClick={onClose}>{t('camera.close')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ic-overlay">
      <div className="ic-video-wrap">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: facing }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="ic-controls">
        <button className="ic-ctrl-btn" onClick={onClose} aria-label={t('camera.close')}>
          <X size={22} />
        </button>
        <button className="ic-shutter" onClick={handleShutter} aria-label={t('camera.shutter')} />
        <button className="ic-ctrl-btn" onClick={onSwitchFacing} aria-label={t('camera.switchCam')}>
          <ArrowsClockwise size={22} />
        </button>
      </div>
    </div>
  )
}
