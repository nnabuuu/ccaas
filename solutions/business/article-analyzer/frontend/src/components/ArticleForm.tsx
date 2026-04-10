import { useState } from 'react';
import { createArticle, type ArticleResponse } from '../api';

interface ArticleFormProps {
  onCreated: (article: ArticleResponse) => void;
  onCancel: () => void;
}

interface FormErrors {
  title?: string;
  initialInput?: string;
}

export default function ArticleForm({ onCreated, onCancel }: ArticleFormProps) {
  const [title, setTitle] = useState('');
  const [inputType, setInputType] = useState<'topic' | 'draft'>('topic');
  const [initialInput, setInitialInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const wordCount = initialInput.trim()
    ? initialInput.trim().split(/\s+/).length
    : 0;
  const charCount = initialInput.length;

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    }
    if (!initialInput.trim()) {
      errs.initialInput = 'Content is required';
    } else if (initialInput.trim().length < 10) {
      errs.initialInput = 'Content must be at least 10 characters';
    }
    return errs;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const article = await createArticle({ title, inputType, initialInput });
      onCreated(article);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create article');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        New Article
      </h3>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="article-title"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Title
          </label>
          <input
            id="article-title"
            type="text"
            placeholder="Article title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              errors.title
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-600'
                : 'border-slate-300 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-slate-600'
            }`}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="inputType"
                value="topic"
                checked={inputType === 'topic'}
                onChange={() => setInputType('topic')}
                className="accent-primary-600"
              />
              Topic
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="inputType"
                value="draft"
                checked={inputType === 'draft'}
                onChange={() => setInputType('draft')}
                className="accent-primary-600"
              />
              Draft
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="article-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {inputType === 'topic' ? 'Topic' : 'Draft Content'}
          </label>
          <textarea
            id="article-input"
            placeholder={
              inputType === 'topic'
                ? 'Enter the article topic...'
                : 'Paste your draft article...'
            }
            value={initialInput}
            onChange={(e) => {
              setInitialInput(e.target.value);
              if (errors.initialInput)
                setErrors((prev) => ({ ...prev, initialInput: undefined }));
            }}
            rows={6}
            className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              errors.initialInput
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-600'
                : 'border-slate-300 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-slate-600'
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.initialInput ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.initialInput}
              </p>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {wordCount} words · {charCount} chars
            </span>
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {submitError}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}
