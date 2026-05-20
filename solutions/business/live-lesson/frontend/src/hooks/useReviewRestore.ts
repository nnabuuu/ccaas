import { useState, useRef, useEffect } from 'react'
import type { CheckItem } from './useClassroom'

export interface ReviewData {
  data: Record<string, unknown>
  checkItems?: CheckItem[]
}

export interface ReviewRestoreResult<T> {
  state: T
  allDone: boolean
}

export function useReviewRestore<T>(
  reviewData: ReviewData | undefined,
  parse: (review: ReviewData) => ReviewRestoreResult<T>,
  onDone?: () => void,
): T | null {
  const [result] = useState<ReviewRestoreResult<T> | null>(() =>
    reviewData ? parse(reviewData) : null,
  )

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (result?.allDone && onDoneRef.current) onDoneRef.current()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return result?.state ?? null
}
