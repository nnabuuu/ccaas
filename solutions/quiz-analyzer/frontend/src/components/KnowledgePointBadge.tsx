import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, LightBulbIcon, BeakerIcon } from '@heroicons/react/24/solid';

interface KnowledgePointBadgeProps {
  name: string;
  source: 'question' | 'solution' | 'both';
  note?: string;
  confidence?: number;
  onInfo?: () => void;
}

const sourceConfig = {
  question: {
    label: '题型',
    className: 'badge-question',
    Icon: CheckCircleIcon,
    description: '从题干识别的知识点',
  },
  solution: {
    label: '方法',
    className: 'badge-solution',
    Icon: LightBulbIcon,
    description: '从答案/解题过程识别的知识点',
  },
  both: {
    label: '综合',
    className: 'badge-both',
    Icon: BeakerIcon,
    description: '题型和方法都需要的知识点',
  },
};

export default function KnowledgePointBadge({
  name,
  source,
  note,
  confidence,
  onInfo,
}: KnowledgePointBadgeProps) {
  const config = sourceConfig[source];
  const { Icon, className } = config;

  return (
    <div className="group relative">
      <div
        className={`${className} ${onInfo ? 'cursor-pointer' : ''}`}
        onClick={onInfo}
      >
        <Icon className="w-4 h-4" />
        <span className="font-medium">{name}</span>
        {note && (
          <InformationCircleIcon
            className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
            title="查看说明"
          />
        )}
        {confidence !== undefined && confidence < 0.8 && (
          <span className="text-xs opacity-70">({Math.round(confidence * 100)}%)</span>
        )}
      </div>

      {/* Tooltip on hover */}
      {(note || confidence !== undefined) && (
        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-10 shadow-lg">
          <div className="font-medium mb-1">{config.description}</div>
          {note && <div className="text-slate-300 text-xs mt-2">{note}</div>}
          {confidence !== undefined && (
            <div className="text-slate-400 text-xs mt-2">
              置信度: {Math.round(confidence * 100)}%
            </div>
          )}
          {/* Arrow */}
          <div className="absolute left-4 top-full w-2 h-2 bg-slate-800 transform rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}
