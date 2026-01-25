/**
 * Drop Zone
 *
 * Empty state placeholder with drag-drop upload hint.
 */

interface DropZoneProps {
  isEmpty: boolean
}

export function DropZone({ isEmpty }: DropZoneProps) {
  if (!isEmpty) return null

  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-2">
      <span className="text-4xl mb-3">📂</span>
      <p className="text-sm font-medium">No files yet</p>
      <p className="text-xs mt-2 text-center px-4">
        Files created by the AI will appear here.
        <br />
        Drag and drop files to upload.
      </p>
    </div>
  )
}
