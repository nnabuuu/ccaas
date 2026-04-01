import type { FileBlock } from '@/types/chat'

interface FileCardProps {
  file: FileBlock
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/markdown': '.md',
}

/** Map file extension to semantic color classes per file-card-actions.html prototype */
function getFileColors(ext: string): { bg: string; text: string } {
  switch (ext) {
    case '.docx': return { bg: 'bg-ck-info-bg', text: 'text-ck-info-t' }
    case '.pdf':  return { bg: 'bg-ck-coral-bg', text: 'text-ck-coral-t' }
    case '.pptx': return { bg: 'bg-ck-teal-bg', text: 'text-ck-teal-t' }
    case '.xlsx': return { bg: 'bg-ck-purple-bg', text: 'text-ck-purple-t' }
    default:      return { bg: 'bg-ck-info-bg', text: 'text-ck-info-t' }
  }
}

export function FileCard({ file }: FileCardProps) {
  const ext = FILE_ICONS[file.fileType] ?? ('.' + (file.fileName.split('.').pop() ?? 'file'))
  const colors = getFileColors(ext)

  return (
    <div className="flex items-center gap-3 px-3.5 py-3 border-[0.5px] border-ck-b1 rounded-ck my-1.5 text-[13px] bg-ck-bg1 cursor-pointer transition-all duration-150 hover:bg-ck-bg2 hover:border-[rgba(0,0,0,0.18)]">
      <div className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0 ${colors.bg} ${colors.text}`}>
        {ext}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] truncate">{file.fileName}</div>
        {file.description && (
          <div className="text-[11px] text-ck-t2 truncate mt-0.5">{file.description}</div>
        )}
      </div>
      {file.downloadUrl && (
        <a
          href={file.downloadUrl}
          className="text-[11px] text-ck-t3 flex-shrink-0 no-underline hover:text-ck-t2 transition-colors"
          download
          onClick={e => e.stopPropagation()}
        >
          下载
        </a>
      )}
    </div>
  )
}
