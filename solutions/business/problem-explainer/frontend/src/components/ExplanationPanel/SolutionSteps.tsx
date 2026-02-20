import { SolutionStep } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface SolutionStepsProps {
  steps: SolutionStep[];
  hasFormula: boolean;
}

export default function SolutionSteps({ steps, hasFormula }: SolutionStepsProps) {
  if (steps.length === 0) {
    return <span className="text-gray-400 italic">暂无步骤</span>;
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div
          key={step.stepNumber || index}
          className="relative pl-8 pb-4 border-l-2 border-blue-200 last:border-transparent"
        >
          {/* Step number circle */}
          <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
            {step.stepNumber || index + 1}
          </div>

          {/* Step content */}
          <div className="space-y-2">
            {/* Description */}
            <h4 className="font-medium text-gray-800">{step.description}</h4>

            {/* Formula (if any) */}
            {step.formula && hasFormula && (
              <div className="bg-gray-50 p-3 rounded-md overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {`$$${step.formula}$$`}
                </ReactMarkdown>
              </div>
            )}
            {step.formula && !hasFormula && (
              <div className="bg-gray-50 p-3 rounded-md">
                <code className="text-sm">{step.formula}</code>
              </div>
            )}

            {/* Explanation */}
            <p className="text-sm text-gray-600">{step.explanation}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
