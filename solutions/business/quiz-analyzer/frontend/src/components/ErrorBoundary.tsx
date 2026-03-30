/**
 * Error Boundary Component
 *
 * Catches React errors and displays a user-friendly fallback UI
 */

import { Component, ReactNode } from 'react'
import { Warning, ArrowCounterClockwise } from '@phosphor-icons/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ck-bg2 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-ck-bg1 rounded-ck-lg shadow-composer-hover p-8 text-center">
            <Warning weight="regular" className="w-16 h-16 text-ck-danger-t mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-ck-t1 mb-2">出错了</h1>
            <p className="text-ck-t2 mb-6">
              应用遇到了一个意外错误。请尝试刷新页面。
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-ck-t3 hover:text-ck-t2">
                  查看错误详情
                </summary>
                <pre className="mt-2 p-3 bg-ck-bg2 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 justify-center w-full bg-ck-accent text-white py-3 rounded-ck font-medium hover:bg-ck-accent-hover transition-colors duration-200 ease-claude"
            >
              <ArrowCounterClockwise weight="regular" className="w-5 h-5" />
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
