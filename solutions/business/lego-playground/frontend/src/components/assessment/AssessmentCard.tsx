import React from 'react';
import { Warning, Lightbulb } from '@phosphor-icons/react';
import type { LLMAssessment } from '../../types';
import { scoreToPercent, scoreColor } from '../../utils/colors';

interface AssessmentCardProps {
  assessment: LLMAssessment;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const percent = scoreToPercent(score);
  const color = scoreColor(score);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-zinc-600 w-8 text-right">{percent}%</span>
    </div>
  );
}

export default function AssessmentCard({ assessment }: AssessmentCardProps) {
  const overallPercent = scoreToPercent(assessment.overallScore);
  const overallColor = scoreColor(assessment.overallScore);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-700">Quality Assessment</span>
        <span
          className="text-lg font-bold"
          style={{ color: overallColor }}
        >
          {overallPercent}%
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        <ScoreBar label="Color" score={assessment.colorAccuracy} />
        <ScoreBar label="Structure" score={assessment.structuralIntegrity} />
        <ScoreBar label="Visual" score={assessment.visualAppeal} />
      </div>

      {assessment.summary && (
        <p className="text-xs text-zinc-600 mb-2">{assessment.summary}</p>
      )}

      {assessment.issues.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-zinc-400 mb-0.5">Issues:</p>
          <ul className="text-xs text-zinc-600 space-y-0.5">
            {assessment.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <Warning size={14} weight="regular" className="text-yellow-500 shrink-0 mt-0.5" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.suggestions.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-400 mb-0.5">Suggestions:</p>
          <ul className="text-xs text-zinc-600 space-y-0.5">
            {assessment.suggestions.map((sug, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-blue-400 shrink-0 text-[10px] bg-blue-50 px-1 rounded">
                  {sug.priority}
                </span>
                {sug.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
