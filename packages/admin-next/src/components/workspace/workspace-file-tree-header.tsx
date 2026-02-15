import { Search, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface WorkspaceFileTreeHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: 'name' | 'size' | 'type'
  onSortChange: (sortBy: 'name' | 'size' | 'type') => void
  onRefresh: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

/**
 * WorkspaceFileTreeHeader - Toolbar with search, sort, and action buttons
 */
export function WorkspaceFileTreeHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onRefresh,
  onExpandAll,
  onCollapseAll,
}: WorkspaceFileTreeHeaderProps) {
  return (
    <div className="space-y-3 pb-3 border-b">
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as 'name' | 'size' | 'type')}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh Button */}
        <Button variant="outline" size="icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Expand/Collapse All Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandAll}
          className="flex-1"
        >
          <ChevronDown className="mr-2 h-4 w-4" />
          Expand All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCollapseAll}
          className="flex-1"
        >
          <ChevronRight className="mr-2 h-4 w-4" />
          Collapse All
        </Button>
      </div>
    </div>
  )
}
