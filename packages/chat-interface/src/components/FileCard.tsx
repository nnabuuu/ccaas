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

export function FileCard({ file }: FileCardProps) {
  const ext = FILE_ICONS[file.fileType] ?? file.fileName.split('.').pop() ?? 'file'

  return (
    <div className="flex items-center gap-[10px] px-3 py-[10px] border border-ck-b1 rounded-ck my-[6px] text-[13px]">
      <div className="w-8 h-8 rounded-[6px] bg-ck-info-bg text-ck-info-t flex items-center justify-center text-xs font-medium shrink-0">
        {ext}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{file.fileName}</div>
        {file.description && (
          <div className="text-[11px] text-ck-t2 truncate">{file.description}</div>
        )}
      </div>
      {file.downloadUrl && (
        <a
          href={file.downloadUrl}
          className="text-xs px-2 py-1 rounded-ck border border-ck-b1 text-ck-t2 hover:bg-ck-bg2 no-underline"
          download
        >
          Download
        </a>
      )}
    </div>
  )
}
