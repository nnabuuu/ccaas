import type { WidgetComponentProps } from '@/types/widget'

interface TreeItem {
  id: string
  label?: string
  name?: string
  children?: TreeItem[]
}

interface MiniOutlineProps {
  items: TreeItem[]
  selected_id?: string
}

function getLabel(item: TreeItem): string {
  return item.label ?? item.name ?? item.id
}

function OutlineNode({ item, selectedId, depth }: { item: TreeItem; selectedId?: string; depth: number }) {
  const isSelected = item.id === selectedId
  return (
    <>
      <div
        className={isSelected ? 'text-ck-t1 font-medium' : ''}
        style={{ paddingLeft: depth > 0 ? `${depth * 14}px` : undefined, paddingTop: '3px', paddingBottom: '3px' }}
      >
        {getLabel(item)}{isSelected ? ' (已选)' : ''}
      </div>
      {item.children?.map(child => (
        <OutlineNode key={child.id} item={child} selectedId={selectedId} depth={depth + 1} />
      ))}
    </>
  )
}

export function MiniOutline({ props }: WidgetComponentProps<MiniOutlineProps>) {
  const items = props.items ?? []

  return (
    <div className="text-xs text-ck-t2 pl-3 border-l-2 border-ck-b1">
      {items.map(item => (
        <OutlineNode key={item.id} item={item} selectedId={props.selected_id} depth={0} />
      ))}
      {items.length === 0 && (
        <div className="text-ck-t3 py-2">无大纲数据</div>
      )}
    </div>
  )
}
