/**
 * ObjectTypeDefs for the live-lesson solution.
 *
 * Phase 3 placeholder — schemas mirror TypeORM column shapes so that
 * (a) `SetFilter` paths in Phase 4 ObjectSetDef consumers stay
 * verifiable, and (b) the ontology validator doesn't reject under the
 * "schema is too permissive" check (Phase 2 lesson: avoid
 * `z.object({}).passthrough()`).
 *
 * Co-located here (`packages/backend/src/ontology/live-lesson/`) rather
 * than in `solutions/business/live-lesson/backend/src/ontology/`
 * because the platform's OntologyRegistry + SolutionToolkitRegistry
 * live in the platform NestJS process (port 3001), and the live-lesson
 * backend is a separate process (port 3007) — cross-process
 * registration would require a wire protocol the platform doesn't have
 * yet. The deferral is captured in docs/ontology/PROGRESS.md.
 */

import { z } from 'zod';
import {
  defineObjectType,
  type ObjectTypeDef,
} from '@kedge-agentic/ontology';

export const LessonType: ObjectTypeDef = defineObjectType({
  apiName: 'Lesson',
  displayName: '课程 / Lesson',
  semantic: '一个完整的课时计划，由若干步骤组成',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    subject: z.string().optional(),
    manifestJson: z.string().optional(),
  }),
  links: [],
  actions: [],
});

export const ClassroomSessionType: ObjectTypeDef = defineObjectType({
  apiName: 'ClassroomSession',
  displayName: '课堂 / Classroom Session',
  semantic: '一次具体的课堂运行实例，关联 Lesson 与若干 Student',
  schema: z.object({
    id: z.string(),
    code: z.string(),
    lessonId: z.string(),
    status: z.enum(['waiting', 'active', 'ended']),
    currentStep: z.number().int().nonnegative().optional(),
  }),
  links: [
    {
      apiName: 'contains',
      displayName: '包含学生 / Contains Students',
      target: 'Student',
      cardinality: '1:N',
      semantic: '当前课堂中的学生',
    },
    {
      apiName: 'ofLesson',
      displayName: '所属课程 / Of Lesson',
      target: 'Lesson',
      cardinality: 'N:1',
      semantic: '本次课堂运行的课程定义',
    },
  ],
  actions: [],
});

export const StudentType: ObjectTypeDef = defineObjectType({
  apiName: 'Student',
  displayName: '学生 / Student',
  semantic: '一名学生，加入了某次课堂',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    classroomCode: z.string(),
    joinedAt: z.string().optional(),
  }),
  links: [],
  actions: [],
});

export const ResourceType: ObjectTypeDef = defineObjectType({
  apiName: 'Resource',
  displayName: '资源 / Resource',
  semantic: '课时中使用的资源（教材片段、题目、图片等）',
  schema: z.object({
    id: z.string(),
    kind: z.string(),
    title: z.string().optional(),
    payload: z.unknown().optional(),
  }),
  links: [],
  actions: [],
});

export const LIVE_LESSON_OBJECT_TYPES: readonly ObjectTypeDef[] = [
  LessonType,
  ClassroomSessionType,
  StudentType,
  ResourceType,
];
