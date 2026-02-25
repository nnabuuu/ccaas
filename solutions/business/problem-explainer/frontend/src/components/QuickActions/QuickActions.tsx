import {
  Play,
  ArrowRight,
  Question,
  ArrowsClockwise,
  ChatCircle,
  Lightbulb,
  Presentation,
} from '@phosphor-icons/react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { IconProps } from '@phosphor-icons/react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

const actions: { id: string; label: string; icon: React.ComponentType<IconProps>; primary?: boolean }[] = [
  { id: 'start', label: '开始讲解', icon: Play, primary: true },
  { id: 'next', label: '下一步', icon: ArrowRight },
  { id: 'detail', label: '更详细', icon: Question },
  { id: 'example', label: '举一反三', icon: ArrowsClockwise },
  { id: 'why', label: '为什么', icon: ChatCircle },
  { id: 'alternative', label: '其他解法', icon: Lightbulb },
  { id: 'ppt', label: '生成PPT', icon: Presentation },
];

function MagneticButton({
  children,
  onClick,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const translateX = useTransform(x, [-50, 50], [-6, 6]);
  const translateY = useTransform(y, [-30, 30], [-3, 3]);

  return (
    <motion.button
      style={{ x: translateX, y: translateY }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - rect.left - rect.width / 2);
        y.set(e.clientY - rect.top - rect.height / 2);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export default function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="p-4 border-t">
      <h3 className="text-xs font-medium text-zinc-500 mb-2">快捷指令</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <MagneticButton
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={disabled}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                ${
                  action.primary
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <Icon className="w-3.5 h-3.5" weight="regular" />
              {action.label}
            </MagneticButton>
          );
        })}
      </div>
    </div>
  );
}
