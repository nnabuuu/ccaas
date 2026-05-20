const MAX_DIM = 1024
const QUALITY = 0.7

let _mime: string | null = null
function getOutputMime(): string {
  if (!_mime) {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    _mime = c.toDataURL('image/webp').startsWith('data:image/webp')
      ? 'image/webp' : 'image/jpeg'
  }
  return _mime
}

function resizeToCanvas(img: HTMLImageElement): string {
  let w = img.width, h = img.height
  if (w > MAX_DIM || h > MAX_DIM) {
    if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM }
    else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(getOutputMime(), QUALITY)
}

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try { resolve(resizeToCanvas(img)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/** Compress a data URI (e.g. from WebRTC getScreenshot) */
export function compressDataUri(dataUri: string): Promise<string> {
  if (!dataUri.startsWith('data:image/')) {
    return Promise.reject(new Error('Expected a data URI with image/* MIME type'))
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try { resolve(resizeToCanvas(img)) } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUri
  })
}
