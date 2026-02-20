import {
  Play,
  ArrowRight,
  HelpCircle,
  RefreshCw,
  MessageCircle,
  Lightbulb,
  Presentation,
} from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

const actions = [
  { id: 'start', label: '开始讲解', icon: Play, primary: true },
  { id: 'next', label: '下一步', icon: ArrowRight },
  { id: 'detail', label: '更详细', icon: HelpCircle },
  { id: 'example', label: '举一反三', icon: RefreshCw },
  { id: 'why', label: '为什么', icon: MessageCircle },
  { id: 'alternative', label: '其他解法', icon: Lightbulb },
  { id: 'ppt', label: '生成PPT', icon: Presentation },
];

export default function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="p-4 border-t">
      <h3 className="text-xs font-medium text-gray-500 mb-2">快捷指令</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={disabled}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
              transition-colors duration-200
              ${
                action.primary
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
