import { useState, useEffect, useCallback } from 'react';
import { useProblemSession } from './hooks/useProblemSession';
import { useExplanationSync } from './hooks/useExplanationSync';
import ProblemInput from './components/ProblemInput/ProblemInput';
import ExplanationPanel from './components/ExplanationPanel/ExplanationPanel';
import ChatPanel from './components/ChatPanel/ChatPanel';
import QuickActions from './components/QuickActions/QuickActions';
import { Subject } from './types';
import { fetchSubjects } from './utils/api';

const TENANT_ID = 'problem-explainer';

function App() {
  // State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('math');
  const [selectedGrade, setSelectedGrade] = useState<string>('9');
  const [problemContent, setProblemContent] = useState('');
  const [problemImagePath, setProblemImagePath] = useState<string | null>(null);
  const [studentAnswerImagePath, setStudentAnswerImagePath] = useState<string | null>(null);

  // Sync hook
  const {
    explanation,
    pendingUpdates,
    modifiedFields,
    handleOutputUpdate,
    syncToForm,
    syncAllToForm,
    dismissUpdate,
    undoSync,
    canUndo,
    resetExplanation,
  } = useExplanationSync();

  // Debug: log explanation changes
  useEffect(() => {
    console.log('[App] explanation state updated:', explanation);
  }, [explanation]);

  // Wrap handleOutputUpdate with logging
  const handleOutputUpdateWithLogging = useCallback((update: any) => {
    console.log('[App] onOutputUpdate callback invoked:', update);
    handleOutputUpdate(update);
  }, [handleOutputUpdate]);

  // Session hook
  const {
    messages,
    isConnected,
    isThinking,
    error: sessionError,
    sendMessage,
    sessionId,
  } = useProblemSession({
    tenantId: TENANT_ID,
    enabledSkillSlugs: ['problem-explainer'],
    onOutputUpdate: handleOutputUpdateWithLogging,
  });

  // Debug: log session state
  useEffect(() => {
    console.log('[App] Session initialized:', { sessionId, isConnected });
  }, [sessionId, isConnected]);

  // Load subjects
  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch((err) => console.error('Failed to load subjects:', err));
  }, []);

  // Build attachments array for image files uploaded to workspace
  const buildAttachments = useCallback(() => {
    const attachments: { type: string; path: string }[] = [];
    if (problemImagePath) attachments.push({ type: 'image', path: problemImagePath });
    if (studentAnswerImagePath) attachments.push({ type: 'image', path: studentAnswerImagePath });
    return attachments.length > 0 ? attachments : undefined;
  }, [problemImagePath, studentAnswerImagePath]);

  // Handle quick action
  const handleQuickAction = useCallback(
    (action: string) => {
      let prompt = '';
      switch (action) {
        case 'start': {
          const hasText = !!problemContent;
          const hasImage = !!problemImagePath;
          const hasStudentAnswer = !!studentAnswerImagePath;

          if (hasText && hasImage) {
            prompt = '请讲解这道题（题目文本 + 图片已附上）：\n\n' + problemContent;
          } else if (hasText) {
            prompt = '请讲解这道题：\n\n' + problemContent;
          } else if (hasImage) {
            prompt = '请讲解附件中的题目图片';
          } else {
            prompt = '请开始讲解';
          }
          if (hasStudentAnswer) {
            prompt += '\n\n同时，我上传了学生的答案图片，请一并分析。';
          }
          break;
        }
        case 'next':
          prompt = '请继续讲解下一步';
          break;
        case 'detail':
          prompt = '请更详细地解释这一步';
          break;
        case 'practice':
          prompt = '请给我一道类似的变式练习题';
          break;
        case 'ppt':
          prompt = problemContent
            ? `请使用 NotebookLM 为这道题生成讲题PPT课件：\n\n${problemContent}`
            : '请使用 NotebookLM 生成讲题PPT课件';
          break;
        default:
          return;
      }
      sendMessage(prompt, buildAttachments());
    },
    [problemContent, problemImagePath, studentAnswerImagePath, sendMessage, buildAttachments]
  );

  // Handle send message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (problemContent && messages.length === 0) {
        sendMessage('题目：\n' + problemContent + '\n\n' + content, buildAttachments());
      } else {
        sendMessage(content);
      }
    },
    [problemContent, messages.length, sendMessage, buildAttachments]
  );

  // Handle new problem
  const handleNewProblem = useCallback(() => {
    setProblemContent('');
    setProblemImagePath(null);
    setStudentAnswerImagePath(null);
    resetExplanation();
  }, [resetExplanation]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800">讲题专家</h1>
          <div className="flex items-center space-x-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {['7', '8', '9', '10', '11', '12'].map((g) => (
                <option key={g} value={g}>
                  {g}年级
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span
              className={'w-2 h-2 rounded-full ' + (isConnected ? 'bg-green-500' : 'bg-red-500')}
            />
            <span className="text-sm text-gray-500">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
          {pendingUpdates.size > 0 && (
            <button
              onClick={syncAllToForm}
              className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600"
            >
              同步全部 ({pendingUpdates.size})
            </button>
          )}
          <button
            onClick={handleNewProblem}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
          >
            新题目
          </button>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Problem Input */}
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
          <ProblemInput
            content={problemContent}
            imagePath={problemImagePath}
            onContentChange={setProblemContent}
            onImageUpload={setProblemImagePath}
            studentAnswerImagePath={studentAnswerImagePath}
            onStudentAnswerUpload={setStudentAnswerImagePath}
            sessionId={sessionId}
          />
        </div>

        {/* Center Panel - Explanation */}
        <div className="flex-1 overflow-auto p-4">
          <ExplanationPanel
            explanation={explanation}
            pendingUpdates={pendingUpdates}
            modifiedFields={modifiedFields}
            onSync={syncToForm}
            onDismiss={dismissUpdate}
            onUndo={undoSync}
            canUndo={canUndo}
            hasFormula={subjects.find((s) => s.id === selectedSubject)?.hasFormula ?? false}
          />
        </div>

        {/* Right Panel - Chat */}
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            onSendMessage={handleSendMessage}
          />
          <QuickActions onAction={handleQuickAction} disabled={isThinking || !isConnected} />
        </div>
      </div>

      {/* Error Toast */}
      {sessionError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
          {sessionError}
        </div>
      )}
    </div>
  );
}

export default App;
