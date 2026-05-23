/**
 * ClassroomController unit tests.
 *
 * Was 60.6% statement / 21.21% branch covered. Exercises the controller's
 * own routing/validation logic (code vs UUID parsing, query param parsing,
 * BadRequest/NotFound throwing) with all services mocked.
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { StudentSubmissionService } from '../../application/classroom/student-submission.service';
import { ObserveRegistry } from '../../application/observation/observe-registry';
import { ManifestCacheService } from '../../application/classroom/manifest-cache.service';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';

const VALID_CODE = 'HX3KM7'; // 6 chars, matches /^[A-Z2-9]{6}$/
const VALID_UUID = '11111111-2222-3333-4444-555555555555';
const INVALID_LONG = '11111111-2222-3333-4444-AAAAAAAAAAAA-x'; // long but not a UUID

async function buildController(over: Partial<{
  classroom: Record<string, jest.Mock>
  submission: Record<string, jest.Mock>
  observe: Record<string, jest.Mock>
  manifestCache: Record<string, jest.Mock>
  manifest: Record<string, unknown> | null
}> = {}) {
  const classroomService = {
    createSession: jest.fn(async () => ({ sessionId: 'sid', code: VALID_CODE, lessonId: 'L1', status: 'waiting' })),
    batchCheckSessions: jest.fn(async () => ({ results: [] })),
    listSessions: jest.fn(async () => ({ sessions: [], total: 0 })),
    getSessionInfo: jest.fn(async () => ({ sessionId: 'sid', code: VALID_CODE })),
    startSession: jest.fn(async () => ({ ok: true })),
    endSession: jest.fn(async () => ({ ok: true })),
    resolveActiveSession: jest.fn(async () => ({ id: 'sid', code: VALID_CODE, lessonId: 'L1' })),
    resolveStartedSession: jest.fn(async () => ({ id: 'sid', code: VALID_CODE, lessonId: 'L1' })),
    resolveSession: jest.fn(async () => ({ id: 'sid', code: VALID_CODE, lessonId: 'L1' })),
    broadcast: jest.fn(),
    subscribe: jest.fn(),
    getChatHistory: jest.fn(async () => ({ messages: [] })),
    getSnapshots: jest.fn(async () => ({ snapshots: [] })),
    getSurfaces: jest.fn(async () => ({ surfaces: [] })),
    getState: jest.fn(async () => ({ metrics: {}, students: [] })),
    setStep: jest.fn(async () => ({ ok: true })),
    notify: jest.fn(async () => ({ ok: true })),
    ...over.classroom,
  };
  const submission = {
    join: jest.fn(async () => ({ studentId: 'st1', name: 'A', _broadcast: true })),
    submit: jest.fn(async () => ({ ok: true, score: 100 })),
    updatePhase: jest.fn(async () => undefined),
    getSubmission: jest.fn(async () => ({ step: 1, data: {} })),
    getProgress: jest.fn(async () => ({ steps: [] })),
    ...over.submission,
  };
  const observeRegistry = {
    loadObserveData: jest.fn(async () => ({ students: [], subsByStudent: new Map() })),
    compute: jest.fn(async () => ({ items: [] })),
    ...over.observe,
  };
  const manifestCache = {
    getManifest: jest.fn(async () => over.manifest === null
      ? null
      : (over.manifest ?? { readingSteps: [{ idx: 1, answerKey: { type: 'quiz' } }] })),
    ...over.manifestCache,
  };
  const lessonRepo = { findOne: jest.fn(), find: jest.fn() };

  const module = await Test.createTestingModule({
    controllers: [ClassroomController],
    providers: [
      { provide: ClassroomService, useValue: classroomService },
      { provide: StudentSubmissionService, useValue: submission },
      { provide: ObserveRegistry, useValue: observeRegistry },
      { provide: ManifestCacheService, useValue: manifestCache },
      { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
    ],
  }).compile();

  return {
    controller: module.get(ClassroomController),
    classroomService,
    submission,
    observeRegistry,
    manifestCache,
  };
}

describe('ClassroomController — session lifecycle', () => {
  it('createSession delegates to classroomService.createSession', async () => {
    const { controller, classroomService } = await buildController();
    const out = await controller.createSession({ lessonId: 'L1' } as never);
    expect(classroomService.createSession).toHaveBeenCalledWith('L1');
    expect(out).toMatchObject({ sessionId: 'sid' });
  });

  it('batchCheck filters non-UUID ids and caps at 50', async () => {
    const { controller, classroomService } = await buildController();
    const ids = [
      VALID_UUID,
      'not-a-uuid',
      '22222222-3333-4444-5555-666666666666',
    ];
    await controller.batchCheck({ sessionIds: ids });
    expect(classroomService.batchCheckSessions).toHaveBeenCalledWith(
      [VALID_UUID, '22222222-3333-4444-5555-666666666666'],
      undefined,
    );
  });

  it('batchCheck tolerates missing sessionIds (empty array fallback)', async () => {
    const { controller, classroomService } = await buildController();
    await controller.batchCheck({} as never);
    expect(classroomService.batchCheckSessions).toHaveBeenCalledWith([], undefined);
  });

  it('batchCheck passes status when present', async () => {
    const { controller, classroomService } = await buildController();
    await controller.batchCheck({ sessionIds: [VALID_UUID], status: 'active' });
    expect(classroomService.batchCheckSessions).toHaveBeenCalledWith([VALID_UUID], 'active');
  });

  it('listSessions parses status enum + clamps limit/offset', async () => {
    const { controller, classroomService } = await buildController();
    await controller.listSessions('active', '500', '-10');
    expect(classroomService.listSessions).toHaveBeenCalledWith('active', 200, 0);
  });

  it('listSessions ignores bogus status; defaults limit=50 offset=0', async () => {
    const { controller, classroomService } = await buildController();
    await controller.listSessions('bogus', undefined, undefined);
    expect(classroomService.listSessions).toHaveBeenCalledWith(undefined, 50, 0);
  });

  it('listSessions clamps a negative limit up to 1', async () => {
    const { controller, classroomService } = await buildController();
    // parseInt('-5') → -5 (truthy), Math.max(-5,1) → 1. (Note: '0' would be
    // treated as falsy by the `|| 50` short-circuit and fall back to 50.)
    await controller.listSessions(undefined, '-5', undefined);
    expect(classroomService.listSessions).toHaveBeenCalledWith(undefined, 1, 0);
  });

  it('getSession accepts a 6-char code', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getSession(VALID_CODE);
    expect(classroomService.getSessionInfo).toHaveBeenCalledWith(VALID_CODE);
  });

  it('getSession accepts a UUID and forwards it as-is', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getSession(VALID_UUID);
    expect(classroomService.getSessionInfo).toHaveBeenCalledWith(VALID_UUID);
  });

  it('getSession rejects a long-but-not-UUID identifier', async () => {
    const { controller } = await buildController();
    // validateCodeOrId throws synchronously before any promise is created
    expect(() => controller.getSession(INVALID_LONG)).toThrow(BadRequestException);
  });

  it('startSession passes the validated code through', async () => {
    const { controller, classroomService } = await buildController();
    await controller.startSession(VALID_CODE);
    expect(classroomService.startSession).toHaveBeenCalledWith(VALID_CODE);
  });

  it('startSession rejects an invalid code format', async () => {
    const { controller } = await buildController();
    expect(() => controller.startSession('xx')).toThrow(BadRequestException);
  });

  it('endSession passes the validated code through', async () => {
    const { controller, classroomService } = await buildController();
    await controller.endSession(VALID_CODE);
    expect(classroomService.endSession).toHaveBeenCalledWith(VALID_CODE);
  });
});

describe('ClassroomController — classroom ops', () => {
  it('join → resolveActiveSession + studentSubmission.join + broadcasts on _broadcast=true', async () => {
    const { controller, classroomService, submission } = await buildController();
    const result = await controller.join(VALID_CODE, { name: 'Alice' } as never);
    expect(classroomService.resolveActiveSession).toHaveBeenCalledWith(VALID_CODE);
    expect(submission.join).toHaveBeenCalled();
    expect(classroomService.broadcast).toHaveBeenCalledWith('sid');
    expect(result).not.toHaveProperty('_broadcast');
  });

  it('join does not broadcast when service returns _broadcast=false', async () => {
    const { controller, classroomService } = await buildController({
      submission: { join: jest.fn(async () => ({ studentId: 'x', _broadcast: false })) },
    });
    await controller.join(VALID_CODE, { name: 'Bob' } as never);
    expect(classroomService.broadcast).not.toHaveBeenCalled();
  });

  it('submit goes through resolveStartedSession + broadcast', async () => {
    const { controller, classroomService, submission } = await buildController();
    const dto = { studentId: 'st1', step: 1, data: { answers: [0] } } as never;
    await controller.submit(VALID_CODE, dto);
    expect(classroomService.resolveStartedSession).toHaveBeenCalledWith(VALID_CODE);
    expect(submission.submit).toHaveBeenCalledWith(expect.any(Object), 'st1', 1, { answers: [0] });
    expect(classroomService.broadcast).toHaveBeenCalledWith('sid');
  });

  it('updatePhase goes through resolveStartedSession + broadcasts', async () => {
    const { controller, classroomService, submission } = await buildController();
    await controller.updatePhase(VALID_CODE, { studentId: 'st1', task: 1, phase: 'practice' } as never);
    expect(classroomService.resolveStartedSession).toHaveBeenCalled();
    expect(submission.updatePhase).toHaveBeenCalled();
    expect(classroomService.broadcast).toHaveBeenCalledWith('sid');
  });

  it('getSubmission rejects non-UUID studentId', async () => {
    const { controller } = await buildController();
    await expect(controller.getSubmission(VALID_CODE, 'not-a-uuid', '1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSubmission rejects negative step', async () => {
    const { controller } = await buildController();
    await expect(controller.getSubmission(VALID_CODE, VALID_UUID, '-1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSubmission rejects NaN step', async () => {
    const { controller } = await buildController();
    await expect(controller.getSubmission(VALID_CODE, VALID_UUID, 'abc'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSubmission forwards parsed step on the happy path', async () => {
    const { controller, submission } = await buildController();
    await controller.getSubmission(VALID_CODE, VALID_UUID, '2');
    expect(submission.getSubmission).toHaveBeenCalledWith(expect.any(Object), VALID_UUID, 2);
  });

  it('getStudentProgress passes include=submissions through as true', async () => {
    const { controller, submission } = await buildController();
    await controller.getStudentProgress(VALID_CODE, VALID_UUID, 'submissions');
    expect(submission.getProgress).toHaveBeenCalledWith(expect.any(Object), VALID_UUID, true);
  });

  it('getStudentProgress defaults include to false when omitted', async () => {
    const { controller, submission } = await buildController();
    await controller.getStudentProgress(VALID_CODE, VALID_UUID, undefined);
    expect(submission.getProgress).toHaveBeenCalledWith(expect.any(Object), VALID_UUID, false);
  });

  it('getStudentProgress rejects invalid studentId UUID', async () => {
    const { controller } = await buildController();
    await expect(controller.getStudentProgress(VALID_CODE, 'bad', undefined))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getChatHistory rejects missing studentId', async () => {
    const { controller } = await buildController();
    await expect(controller.getChatHistory(VALID_CODE, '', undefined))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getChatHistory rejects an invalid threadId format', async () => {
    const { controller } = await buildController();
    await expect(controller.getChatHistory(VALID_CODE, 'st1', 'oops:bad'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getChatHistory accepts discuss:NN and translate:NN:HEX thread ids', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getChatHistory(VALID_CODE, 'st1', 'discuss:1');
    await controller.getChatHistory(VALID_CODE, 'st1', 'translate:2:abcdef01');
    await controller.getChatHistory(VALID_CODE, 'st1', undefined);
    expect(classroomService.getChatHistory).toHaveBeenCalledTimes(3);
  });
});

describe('ClassroomController — snapshots/surfaces/state/stream', () => {
  it('getSnapshots delegates to classroomService.getSnapshots', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getSnapshots(VALID_CODE);
    expect(classroomService.getSnapshots).toHaveBeenCalledWith('sid');
  });

  it('getSurfaces rejects step < 1', async () => {
    const { controller } = await buildController();
    await expect(controller.getSurfaces(VALID_CODE, '0'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSurfaces rejects non-numeric step', async () => {
    const { controller } = await buildController();
    await expect(controller.getSurfaces(VALID_CODE, 'NaN'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSurfaces happy path parses step', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getSurfaces(VALID_CODE, '3');
    expect(classroomService.getSurfaces).toHaveBeenCalledWith('sid', 3);
  });

  it('getState parses step query', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getState(VALID_CODE, '4');
    expect(classroomService.getState).toHaveBeenCalledWith('sid', 4);
  });

  it('getState rejects non-numeric step', async () => {
    const { controller } = await buildController();
    await expect(controller.getState(VALID_CODE, 'abc'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('getState omits parsed step when query missing', async () => {
    const { controller, classroomService } = await buildController();
    await controller.getState(VALID_CODE, undefined);
    expect(classroomService.getState).toHaveBeenCalledWith('sid', undefined);
  });

  it('stream wires the express Response into subscribe()', async () => {
    const { controller, classroomService } = await buildController();
    const res = {} as Response;
    await controller.stream(VALID_CODE, res);
    expect(classroomService.subscribe).toHaveBeenCalledWith('sid', res);
  });
});

describe('ClassroomController — observe endpoint', () => {
  const ANSWER_KEY = { type: 'quiz', answers: [] } as Record<string, unknown>;
  const DISCOVERY_KEY = { type: 'guided-discovery', steps: [] } as Record<string, unknown>;
  const MANIFEST = {
    readingSteps: [
      { idx: 1, answerKey: ANSWER_KEY, discoveryKey: DISCOVERY_KEY },
      { idx: 2, answerKey: ANSWER_KEY },
    ],
  };

  it('rejects step < 1', async () => {
    const { controller } = await buildController({ manifest: MANIFEST });
    await expect(controller.getObserve(VALID_CODE, '0', 'quiz'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when manifest missing', async () => {
    const { controller } = await buildController({ manifest: null });
    await expect(controller.getObserve(VALID_CODE, '1', 'quiz'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when manifest has no readingSteps', async () => {
    // buildTaskMap with empty readingSteps → taskToStep[1] is undefined → NotFound.
    const { controller } = await buildController({ manifest: { readingSteps: [] } });
    await expect(controller.getObserve(VALID_CODE, '1', 'quiz'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('prefers discoveryKey when type=guided-discovery', async () => {
    const { controller, observeRegistry } = await buildController({ manifest: MANIFEST });
    await controller.getObserve(VALID_CODE, '1', 'guided-discovery');
    expect(observeRegistry.compute).toHaveBeenCalledWith(
      'guided-discovery',
      expect.objectContaining({ answerKey: DISCOVERY_KEY }),
    );
  });

  it('falls back to answerKey for non-guided-discovery types', async () => {
    const { controller, observeRegistry } = await buildController({ manifest: MANIFEST });
    await controller.getObserve(VALID_CODE, '1', 'quiz');
    expect(observeRegistry.compute).toHaveBeenCalledWith(
      'quiz',
      expect.objectContaining({ answerKey: ANSWER_KEY }),
    );
  });

  it('parses view=first and partIds CSV', async () => {
    const { controller, observeRegistry } = await buildController({ manifest: MANIFEST });
    await controller.getObserve(VALID_CODE, '1', 'quiz', 'first', 'a,b,,c');
    expect(observeRegistry.compute).toHaveBeenCalledWith(
      'quiz',
      expect.objectContaining({ view: 'first', partIds: ['a', 'b', 'c'] }),
    );
  });

  it('treats unknown view value as latest, omits partIds when not provided', async () => {
    const { controller, observeRegistry } = await buildController({ manifest: MANIFEST });
    await controller.getObserve(VALID_CODE, '1', 'quiz', 'something-else');
    expect(observeRegistry.compute).toHaveBeenCalledWith(
      'quiz',
      expect.objectContaining({ view: 'latest', partIds: undefined }),
    );
  });
});

describe('ClassroomController — setStep / notify', () => {
  it('setStep goes through resolveStartedSession', async () => {
    const { controller, classroomService } = await buildController();
    await controller.setStep(VALID_CODE, { step: 3 } as never);
    expect(classroomService.resolveStartedSession).toHaveBeenCalled();
    expect(classroomService.setStep).toHaveBeenCalledWith('sid', 3);
  });

  it('notify goes through resolveStartedSession', async () => {
    const { controller, classroomService } = await buildController();
    await controller.notify(VALID_CODE, { message: 'hi', type: 'info' } as never);
    expect(classroomService.resolveStartedSession).toHaveBeenCalled();
    expect(classroomService.notify).toHaveBeenCalledWith('sid', 'hi', 'info');
  });
});
