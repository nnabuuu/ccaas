/**
 * Loading Spinner Component
 *
 * Reusable loading indicator with optional message
 */

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4',
  }

  return (
    <div className="text-center py-12">
      <div
        className={`inline-block animate-spin rounded-full border-blue-500 border-t-transparent ${sizeClasses[size]}`}
      />
      {message && <p className="mt-4 text-slate-600">{message}</p>}
    </div>
  )
}
