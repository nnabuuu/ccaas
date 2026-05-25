/**
 * ProjectChangeNotice — stacked banner UI for agent-runtime change events.
 *
 * Renders the most recent N un-dismissed events from `useProjectChanges`
 * with color coding:
 *   - conflict_agent_wins  → red    (agent overrode your edit)
 *   - source=agent updated → yellow (agent edited a file)
 *   - source=agent deleted → orange (agent deleted a file)
 *
 * Per-notice actions:
 *   - [Reload] button shown when `currentlyEditingPath` matches the
 *     notice's path — calls `onReload(path)`. The parent (typically
 *     `ProjectEditorPage`) is responsible for actually re-fetching
 *     and resetting editor state.
 *   - [Dismiss] always shown; calls `onDismiss(eventKey)`.
 *
 * Visible stack capped at MAX_VISIBLE; older notices collapsed into
 * a "+N more" badge that expands inline on click.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, FileEdit, FileX, RotateCcw, X } from 'lucide-react';

import type { ChangeEvent } from '../hooks/useProjectChanges';

const MAX_VISIBLE = 3;

interface ProjectChangeNoticeProps {
  events: ReadonlyArray<ChangeEvent>;
  /** Path of the file the operator is currently editing; reload button only shown for matching path. */
  currentlyEditingPath?: string | null;
  onReload(path: string): void;
  /** Called with the stable event key (at + path); parent maintains dismissed set. */
  onDismiss(eventKey: string): void;
  /** Stable keys of events the operator has dismissed; filtered out of display. */
  dismissed: ReadonlySet<string>;
}

export default function ProjectChangeNotice(props: ProjectChangeNoticeProps) {
  const { events, currentlyEditingPath, onReload, onDismiss, dismissed } = props;
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    // Newest events at the bottom of the array; show them first (reversed).
    return events
      .filter((e) => !dismissed.has(eventKey(e)))
      .slice()
      .reverse();
  }, [events, dismissed]);

  if (visible.length === 0) return null;

  const shown = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hiddenCount = visible.length - shown.length;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-2 border-b border-gray-200 bg-gray-50">
      {shown.map((event) => (
        <Notice
          key={eventKey(event)}
          event={event}
          currentlyEditingPath={currentlyEditingPath}
          onReload={onReload}
          onDismiss={() => onDismiss(eventKey(event))}
        />
      ))}
      {hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="self-start text-xs text-gray-500 hover:text-gray-700 underline"
        >
          +{hiddenCount} more
        </button>
      )}
      {expanded && visible.length > MAX_VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
          className="self-start text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Collapse
        </button>
      )}
    </div>
  );
}

interface NoticeProps {
  event: ChangeEvent;
  currentlyEditingPath?: string | null;
  onReload(path: string): void;
  onDismiss(): void;
}

function Notice({ event, currentlyEditingPath, onReload, onDismiss }: NoticeProps) {
  const variant = noticeVariant(event);
  const Icon = variant.Icon;
  const canReload = currentlyEditingPath === event.path && event.kind !== 'deleted';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${variant.classes}`}
    >
      <Icon size={14} className={variant.iconClass} />
      <span className="flex-1 truncate">
        <strong>{variant.title}</strong>
        {event.path && (
          <span className="ml-1 font-mono text-[11px] opacity-75">{event.path}</span>
        )}
      </span>
      {canReload && (
        <button
          onClick={() => onReload(event.path)}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-current hover:bg-opacity-80 font-medium"
          title="Discard your unsaved changes and reload this file from disk"
        >
          <RotateCcw size={11} />
          Reload
        </button>
      )}
      <button
        onClick={onDismiss}
        className="p-0.5 rounded hover:bg-white hover:bg-opacity-50"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

interface Variant {
  title: string;
  classes: string;
  iconClass: string;
  Icon: typeof AlertTriangle;
}

function noticeVariant(event: ChangeEvent): Variant {
  if (event.actor === 'conflict-agent-wins') {
    return {
      title: 'Agent overrode your edit',
      classes: 'bg-red-50 border-red-300 text-red-800',
      iconClass: 'text-red-600',
      Icon: AlertTriangle,
    };
  }
  if (event.kind === 'deleted') {
    return {
      title: 'Agent deleted',
      classes: 'bg-orange-50 border-orange-300 text-orange-800',
      iconClass: 'text-orange-600',
      Icon: FileX,
    };
  }
  // default: updated / created by agent
  return {
    title: 'Agent edited',
    classes: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    iconClass: 'text-yellow-700',
    Icon: FileEdit,
  };
}

/**
 * Stable identity per event for the dismissed set. `at` is server-emitted
 * ISO timestamp at ms granularity; including `actor` distinguishes
 * `conflict-agent-wins` from a plain `updated` event for the same
 * (at, path, kind) tuple (rare collision possible at sub-ms scheduling).
 */
function eventKey(event: ChangeEvent): string {
  return `${event.at}|${event.path}|${event.kind}|${event.actor ?? ''}`;
}
