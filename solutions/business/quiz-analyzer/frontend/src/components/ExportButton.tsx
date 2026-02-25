/**
 * ExportButton - Export analysis results
 *
 * Supports:
 * - JSON export (machine-readable)
 * - Markdown export (human-readable)
 * - Copy to clipboard
 */

import { useState } from 'react'
import { DownloadSimple, ClipboardText, Check } from '@phosphor-icons/react'

interface ExportButtonProps {
  onExportJSON: () => void
  onExportMarkdown: () => void
  onCopyToClipboard: () => Promise<boolean>
  disabled?: boolean
}

export default function ExportButton({
  onExportJSON,
  onExportMarkdown,
  onCopyToClipboard,
  disabled = false,
}: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await onCopyToClipboard()
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200"
      >
        <DownloadSimple weight="regular" className="w-5 h-5" />
        导出分析
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-20 overflow-hidden">
            <button
              onClick={() => {
                onExportJSON()
                setShowMenu(false)
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 flex items-center gap-3"
            >
              <DownloadSimple weight="regular" className="w-5 h-5 text-slate-600" />
              <div>
                <div className="text-sm font-medium text-slate-800">导出 JSON</div>
                <div className="text-xs text-slate-500">机器可读格式</div>
              </div>
            </button>

            <button
              onClick={() => {
                onExportMarkdown()
                setShowMenu(false)
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 flex items-center gap-3 border-t border-slate-100"
            >
              <DownloadSimple weight="regular" className="w-5 h-5 text-slate-600" />
              <div>
                <div className="text-sm font-medium text-slate-800">导出 Markdown</div>
                <div className="text-xs text-slate-500">人类可读格式</div>
              </div>
            </button>

            <button
              onClick={handleCopy}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 flex items-center gap-3 border-t border-slate-100"
            >
              {copied ? (
                <Check weight="regular" className="w-5 h-5 text-green-600" />
              ) : (
                <ClipboardText weight="regular" className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {copied ? '已复制！' : '复制到剪贴板'}
                </div>
                <div className="text-xs text-slate-500">Markdown 格式</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
