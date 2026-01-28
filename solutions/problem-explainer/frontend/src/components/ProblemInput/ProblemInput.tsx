import { useCallback } from 'react';
import ImageDropzone from './ImageDropzone';

interface ProblemInputProps {
  content: string;
  onContentChange: (content: string) => void;
  imagePath: string | null;
  onImageUpload: (path: string | null) => void;
  studentAnswerImagePath: string | null;
  onStudentAnswerUpload: (path: string | null) => void;
  sessionId: string | null;
}

export default function ProblemInput({
  content,
  onContentChange,
  imagePath,
  onImageUpload,
  studentAnswerImagePath,
  onStudentAnswerUpload,
  sessionId,
}: ProblemInputProps) {
  const handleClear = useCallback(() => {
    onContentChange('');
    onImageUpload(null);
    onStudentAnswerUpload(null);
  }, [onContentChange, onImageUpload, onStudentAnswerUpload]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-medium text-gray-700">题目</h2>
        {(content || imagePath || studentAnswerImagePath) && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            清空
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">
        {/* Text input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">题目文本</label>
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="在此输入题目内容..."
            className="w-full h-32 p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">或上传图片</label>
          <ImageDropzone
            imagePath={imagePath}
            onUpload={onImageUpload}
            sessionId={sessionId}
          />
        </div>

        {/* Student answer upload */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">学生答案</label>
          <ImageDropzone
            imagePath={studentAnswerImagePath}
            onUpload={onStudentAnswerUpload}
            sessionId={sessionId}
            label="拖拽/粘贴学生答案图片"
            inputId="student-answer-upload"
            targetPath="student-answers/"
          />
        </div>

        {/* Tips */}
        <div className="mt-auto pt-4 border-t">
          <h3 className="text-xs font-medium text-gray-500 mb-2">使用提示</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• 直接输入题目文字</li>
            <li>• 或拖拽/粘贴题目图片</li>
            <li>• 点击右侧"开始讲解"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
