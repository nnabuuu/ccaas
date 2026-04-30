# Progress — live-lesson-ai-tutor-e2e

| Version | Timestamp | Score | Changes | Top Issue |
|---------|-----------|-------|---------|-----------|
| v1 | 2026-04-22 13:42:13 | 0/100 | - Added `aiReferenceQA` (5 entries, 4 categories) to lesson manifest for few-shot prompting;- Added |  |
| v2 | 2026-04-22 13:52:43 | 52/100 | - Reverted `backend/src/entities/student.entity.ts` and `submission.entity.ts` — removed added colum | **[BACKEND] classroom.module.ts:10 — CRITICAL: Add `Lesson` entity to module imp |
| v3 | 2026-04-22 14:02:19 | 80/100 | - Removed `@InjectRepository(Lesson)` from ClassroomService constructor to fix NestJS DI crash;- Ad | [FRONTEND] useReadingLesson.ts — Hook must also return `lessonId` (from `usePara |
| v4 | 2026-04-22 14:13:13 | 100/100 | - Fixed `useReadingLesson` hook to return `lessonId` (from `useParams`) and `sessionParam` (from `se | No fixes needed — all dimensions at full marks. |
