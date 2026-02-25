import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, AlertCircle, Loader2, FileX } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useFileContent } from '@/hooks/use-file-content'
import { formatFileSize } from '@/lib/file-utils'
import type { FileTreeNode } from '@/types/workspace'

interface FileViewerPanelProps {
  sessionId: string
  file: FileTreeNode | null
  onClose: () => void
}

/**
 * FileViewerPanel - Inline dialog for viewing workspace file content
 *
 * Displays text file content in a scrollable panel.
 * Shows a message for binary or oversized files.
 */
export function FileViewerPanel({ sessionId, file, onClose }: FileViewerPanelProps) {
  const { loading, error, data, fetchContent, clear } = useFileContent({ sessionId })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (file) {
      fetchContent(file.path)
    } else {
      clear()
    }
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback(async () => {
    if (!data?.content) return
    await navigator.clipboard.writeText(data.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data?.content])

  const displayContent = useCallback(() => {
    if (!data?.content) return data?.content ?? null
    if (data.mimeType === 'application/json') {
      try {
        return JSON.stringify(JSON.parse(data.content), null, 2)
      } catch {
        return data.content
      }
    }
    return data.content
  }, [data])

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="font-mono text-sm truncate flex-1">
              {file?.path ?? ''}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {data && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {formatFileSize(data.size)}
                </Badge>
              )}
              {data?.content && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading file...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            </div>
          )}

          {!loading && !error && data?.isBinary && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <FileX className="h-10 w-10" />
              <p className="text-sm">Binary file — content not displayable</p>
              <p className="text-xs">{data.mimeType}</p>
            </div>
          )}

          {!loading && !error && data && !data.isBinary && (
            <ScrollArea className="h-full">
              <pre className="font-mono text-sm p-6 whitespace-pre-wrap break-words">
                {displayContent()}
              </pre>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
