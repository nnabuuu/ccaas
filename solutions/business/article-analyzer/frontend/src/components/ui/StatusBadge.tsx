import clsx from 'clsx';

type Status = 'draft' | 'running' | 'completed' | 'failed';

interface StatusBadgeProps {
  status: string;
}

const CONFIG: Record<Status, { bg: string; text: string; icon: string }> = {
  draft: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    icon: '○',
  },
  running: {
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    text: 'text-blue-700 dark:text-blue-300',
    icon: '●',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/50',
    text: 'text-green-700 dark:text-green-300',
    icon: '✓',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/50',
    text: 'text-red-700 dark:text-red-300',
    icon: '✕',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = CONFIG[status as Status] ?? CONFIG.draft;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        status === 'running' && 'animate-pulse-slow',
      )}
    >
      <span className="text-[10px]">{config.icon}</span>
      {status}
    </span>
  );
}
