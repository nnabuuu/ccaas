/**
 * Toast notification utility with selectable text
 */

type ToastType = 'error' | 'success' | 'warning' | 'info'

let toastContainer: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
    `
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

function createToast(message: string, type: ToastType = 'error', duration = 0): HTMLDivElement {
  const container = ensureContainer()

  const bgColor = type === 'error' ? '#fef2f2' : type === 'success' ? '#f0fdf4' : type === 'info' ? '#eff6ff' : '#fffbeb'
  const borderColor = type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : type === 'info' ? '#bfdbfe' : '#fde68a'
  const accentColor = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : type === 'info' ? '#3b82f6' : '#f59e0b'

  const toast = document.createElement('div')
  toast.style.cssText = `
    background: ${bgColor};
    border: 1px solid ${borderColor};
    border-left: 4px solid ${accentColor};
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    animation: slideIn 0.3s ease-out;
    position: relative;
  `

  // Add animation keyframes if not exists
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style')
    style.id = 'toast-styles'
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }

  const header = document.createElement('div')
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  `

  const title = document.createElement('span')
  const titleColor = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'info' ? '#2563eb' : '#d97706'
  title.style.cssText = `
    font-weight: 600;
    font-size: 14px;
    color: ${titleColor};
  `
  title.textContent = type === 'error' ? '错误' : type === 'success' ? '成功' : type === 'info' ? '提示' : '警告'

  const closeBtn = document.createElement('button')
  closeBtn.style.cssText = `
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: #9ca3af;
    font-size: 18px;
    line-height: 1;
    margin-left: 12px;
  `
  closeBtn.innerHTML = '&times;'
  closeBtn.onclick = () => removeToast(toast)

  header.appendChild(title)
  header.appendChild(closeBtn)

  const content = document.createElement('div')
  content.style.cssText = `
    font-size: 13px;
    color: #374151;
    line-height: 1.5;
    user-select: text;
    cursor: text;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  `
  content.textContent = message

  const actions = document.createElement('div')
  actions.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 12px;
  `

  const copyBtn = document.createElement('button')
  copyBtn.style.cssText = `
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  `
  copyBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    复制
  `
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(message)
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        已复制
      `
      copyBtn.style.background = '#dcfce7'
      copyBtn.style.borderColor = '#86efac'
      copyBtn.style.color = '#16a34a'
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          复制
        `
        copyBtn.style.background = '#f3f4f6'
        copyBtn.style.borderColor = '#d1d5db'
        copyBtn.style.color = '#374151'
      }, 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  const dismissBtn = document.createElement('button')
  dismissBtn.style.cssText = `
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
  `
  dismissBtn.textContent = '关闭'
  dismissBtn.onclick = () => removeToast(toast)

  actions.appendChild(copyBtn)
  actions.appendChild(dismissBtn)

  toast.appendChild(header)
  toast.appendChild(content)
  toast.appendChild(actions)

  container.appendChild(toast)

  // Auto dismiss after duration (0 = no auto dismiss)
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration)
  }

  return toast
}

function removeToast(toast: HTMLDivElement): void {
  toast.style.animation = 'slideOut 0.3s ease-in forwards'
  setTimeout(() => {
    toast.remove()
    // Remove container if empty
    if (toastContainer && toastContainer.children.length === 0) {
      toastContainer.remove()
      toastContainer = null
    }
  }, 300)
}

interface ToastOptions {
  duration?: number
}

interface Toast {
  error(message: string, options?: ToastOptions | number): HTMLDivElement
  success(message: string, options?: ToastOptions | number): HTMLDivElement
  warning(message: string, options?: ToastOptions | number): HTMLDivElement
  info(message: string, options?: ToastOptions | number): HTMLDivElement
}

function getDuration(options?: ToastOptions | number, defaultDuration?: number): number {
  if (typeof options === 'number') return options
  if (typeof options === 'object' && options.duration !== undefined) return options.duration
  return defaultDuration ?? 0
}

export const toast: Toast = {
  error(message: string, options?: ToastOptions | number): HTMLDivElement {
    return createToast(message, 'error', getDuration(options, 0))
  },
  success(message: string, options?: ToastOptions | number): HTMLDivElement {
    return createToast(message, 'success', getDuration(options, 3000))
  },
  warning(message: string, options?: ToastOptions | number): HTMLDivElement {
    return createToast(message, 'warning', getDuration(options, 5000))
  },
  info(message: string, options?: ToastOptions | number): HTMLDivElement {
    return createToast(message, 'info', getDuration(options, 3000))
  }
}

export default toast
