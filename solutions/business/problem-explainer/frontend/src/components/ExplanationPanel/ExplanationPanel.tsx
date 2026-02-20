import { Explanation, OutputUpdate, SyncField, FIELD_CONFIG } from '../../types';
import SolutionSteps from './SolutionSteps';
import { Check, X, Undo2 } from 'lucide-react';

interface ExplanationPanelProps {
  explanation: Explanation;
  pendingUpdates: Map<SyncField, OutputUpdate>;
  modifiedFields: Set<SyncField>;
  onSync: (field: SyncField) => void;
  onDismiss: (field: SyncField) => void;
  onUndo: (field: SyncField) => boolean;
  canUndo: (field: SyncField) => boolean;
  hasFormula: boolean;
}

export default function ExplanationPanel({
  explanation,
  pendingUpdates,
  modifiedFields,
  onSync,
  onDismiss,
  onUndo,
  canUndo,
  hasFormula,
}: ExplanationPanelProps) {
  const renderField = (field: SyncField) => {
    const config = FIELD_CONFIG[field];
    const value = explanation[field as keyof Explanation];
    const pending = pendingUpdates.get(field);
    const isModified = modifiedFields.has(field);
    const showUndo = canUndo(field);

    // Determine display value
    let displayValue: React.ReactNode = null;
    const displayData = pending?.value ?? value;

    if (displayData !== undefined && displayData !== null) {
      if (Array.isArray(displayData)) {
        if (displayData.length === 0) {
          displayValue = <span className="text-gray-400 italic">暂无内容</span>;
        } else if (field === 'solutionSteps') {
          displayValue = <SolutionSteps steps={displayData} hasFormula={hasFormula} />;
        } else {
          displayValue = (
            <ul className="list-disc list-inside space-y-1">
              {displayData.map((item, i) => (
                <li key={i} className="text-gray-700">
                  {String(item)}
                </li>
              ))}
            </ul>
          );
        }
      } else if (field === 'difficulty') {
        const difficulty = Number(displayData);
        displayValue = (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`w-4 h-4 rounded ${
                  n <= difficulty ? 'bg-yellow-400' : 'bg-gray-200'
                }`}
              />
            ))}
            <span className="ml-2 text-sm text-gray-500">
              {difficulty === 1 && '基础'}
              {difficulty === 2 && '简单'}
              {difficulty === 3 && '中等'}
              {difficulty === 4 && '较难'}
              {difficulty === 5 && '困难'}
            </span>
          </div>
        );
      } else {
        displayValue = <p className="text-gray-700 whitespace-pre-wrap">{String(displayData)}</p>;
      }
    } else {
      displayValue = <span className="text-gray-400 italic">等待 AI 讲解...</span>;
    }

    return (
      <div
        key={field}
        className={`
          p-4 rounded-lg border transition-all
          ${pending ? 'pending-update' : ''}
          ${isModified && !pending ? 'synced-field' : ''}
          ${!pending && !isModified ? 'bg-white' : ''}
        `}
      >
        {/* Field header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </h3>
          <div className="flex items-center gap-2">
            {pending && (
              <>
                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                  {pending.preview}
                </span>
                <button
                  onClick={() => onSync(field)}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="同步"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDismiss(field)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="忽略"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            {showUndo && !pending && (
              <button
                onClick={() => onUndo(field)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1 text-xs"
                title="撤销"
              >
                <Undo2 className="w-3 h-3" />
                撤销
              </button>
            )}
          </div>
        </div>

        {/* Field content */}
        <div className="text-sm">{displayValue}</div>
      </div>
    );
  };

  // Fields to display in order
  const fields: SyncField[] = [
    'problemAnalysis',
    'keyKnowledge',
    'solutionSteps',
    'answer',
    'commonMistakes',
    'relatedProblems',
  ];

  // Check if any content exists
  const hasContent =
    explanation.problemAnalysis ||
    explanation.keyKnowledge.length > 0 ||
    explanation.solutionSteps.length > 0 ||
    explanation.answer ||
    explanation.commonMistakes.length > 0 ||
    explanation.relatedProblems.length > 0 ||
    pendingUpdates.size > 0;

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {!hasContent && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-medium text-gray-700 mb-2">准备好讲题了</h2>
            <p className="text-gray-500">
              在左侧输入题目，然后点击右侧的"开始讲解"
            </p>
          </div>
        )}

        {hasContent && fields.map(renderField)}

        {/* Optional fields shown only if they have content */}
        {(explanation.hints || pendingUpdates.has('hints')) &&
          renderField('hints')}
        {(explanation.difficulty || pendingUpdates.has('difficulty')) &&
          renderField('difficulty')}
      </div>
    </div>
  );
}
