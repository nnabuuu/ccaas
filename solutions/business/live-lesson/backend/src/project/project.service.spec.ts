import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { LESSON_REPO_PORT } from '../domain/ports/lesson-repo.port';
import { ManifestSchema } from '../schemas';
import { TeachingRequirementsService } from '../teaching-requirements/teaching-requirements.service';
import { RequirementInterpretationService } from '../teaching-requirements/requirement-interpretation.service';

// ── Mock repository factory ──

function mockRepo() {
  // Chainable query-builder mock — every method returns `qb` so tests
  // can configure `getMany()` and assert calls to `where` / `orderBy` /
  // `loadRelationCountAndMap` happened.
  const qb: any = {
    loadRelationCountAndMap: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    where: jest.fn(() => qb),
    getMany: jest.fn(() => Promise.resolve([])),
  };
  return {
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((entity) => Promise.resolve(Array.isArray(entity) ? entity : { id: 'uuid-1', ...entity })),
    find: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(() => Promise.resolve(null)),
    findById: jest.fn(() => Promise.resolve(null)),
    findByIds: jest.fn(() => Promise.resolve([])),
    findAllSeedFields: jest.fn(() => Promise.resolve([])),
    findAllForList: jest.fn(() => Promise.resolve([])),
    insert: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    createQueryBuilder: jest.fn(() => qb),
    qb,
  };
}

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: ReturnType<typeof mockRepo>;
  let fileRepo: ReturnType<typeof mockRepo>;
  let lessonRepo: ReturnType<typeof mockRepo>;
  let teachingRequirements: jest.Mocked<TeachingRequirementsService>;
  let interpretations: jest.Mocked<RequirementInterpretationService>;

  beforeEach(async () => {
    projectRepo = mockRepo();
    fileRepo = mockRepo();
    lessonRepo = mockRepo();
    // Default to "no library, no interpretations" — keeps the
    // pre-existing test cases (which don't care about the lib append)
    // operating against the original artifact list. The new tests
    // override these mocks per-case.
    teachingRequirements = {
      getLibrary: jest.fn().mockReturnValue(null),
      tryFindItemById: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<TeachingRequirementsService>;
    interpretations = {
      listForUser: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RequirementInterpretationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(CourseProject), useValue: projectRepo },
        { provide: getRepositoryToken(ProjectFile), useValue: fileRepo },
        { provide: LESSON_REPO_PORT, useValue: lessonRepo },
        { provide: TeachingRequirementsService, useValue: teachingRequirements },
        { provide: RequirementInterpretationService, useValue: interpretations },
      ],
    }).compile();

    service = module.get(ProjectService);
  });

  // ── Create ──

  describe('create', () => {
    it('creates project with scaffold files', async () => {
      projectRepo.save.mockResolvedValueOnce({ id: 'p1', title: 'Math', description: '' });

      const result = await service.create({ title: 'Math' });

      expect(result.id).toBe('p1');
      expect(fileRepo.save).toHaveBeenCalledTimes(1);
      // Scaffold creates 2 files (plan + manifest)
      const savedFiles = fileRepo.save.mock.calls[0][0];
      expect(savedFiles).toHaveLength(2);
      expect(savedFiles[0].path).toBe('plan/lesson-plan.md');
      expect(savedFiles[1].path).toBe('execution/manifest.json');
    });

    it('scaffolded manifest passes ManifestSchema validation', async () => {
      // Defends against regressions where someone tweaks the example
      // step in a way that no longer passes the publish-time Zod
      // validator. If this breaks, fresh projects can't be published
      // until the agent re-edits — confusing first-run experience.
      projectRepo.save.mockResolvedValueOnce({ id: 'p1', title: 'Sample', description: '' });

      await service.create({ title: 'Sample' });

      const savedFiles = fileRepo.save.mock.calls[0][0];
      const manifestFile = savedFiles.find((f: { path: string }) => f.path === 'execution/manifest.json');
      expect(manifestFile).toBeDefined();
      const parsed = JSON.parse(manifestFile.content);
      const result = ManifestSchema.safeParse(parsed);
      if (!result.success) {
        // Surface the Zod issues so a failure diagnoses itself.
        throw new Error(
          'scaffold manifest failed ManifestSchema validation:\n' +
            result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n'),
        );
      }
      expect(parsed.id).toBe('p1');
      expect(parsed.readingSteps).toHaveLength(1);
      // Example step should be flagged as replaceable so the agent
      // and teacher both know it's template-only.
      expect(parsed.readingSteps[0].label).toMatch(/TODO/i);
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('default (active) filters to draft + published with order DESC + fileCount mapped', async () => {
      (projectRepo as any).qb.getMany.mockResolvedValueOnce([
        { id: 'p1', status: 'draft', fileCount: 2 },
      ]);
      const result = await service.findAll();
      expect(result).toEqual([{ id: 'p1', status: 'draft', fileCount: 2 }]);
      expect((projectRepo as any).qb.loadRelationCountAndMap).toHaveBeenCalledWith(
        'project.fileCount',
        'project.files',
      );
      expect((projectRepo as any).qb.orderBy).toHaveBeenCalledWith('project.updatedAt', 'DESC');
      expect((projectRepo as any).qb.where).toHaveBeenCalledWith(
        'project.status IN (:...statuses)',
        { statuses: ['draft', 'published'] },
      );
    });

    it('status="archived" filters to archived only', async () => {
      (projectRepo as any).qb.getMany.mockResolvedValueOnce([]);
      await service.findAll({ status: 'archived' });
      expect((projectRepo as any).qb.where).toHaveBeenCalledWith(
        'project.status = :status',
        { status: 'archived' },
      );
    });

    it('status="all" applies no status filter', async () => {
      (projectRepo as any).qb.getMany.mockResolvedValueOnce([]);
      await service.findAll({ status: 'all' });
      expect((projectRepo as any).qb.where).not.toHaveBeenCalled();
    });
  });

  // ── restore ──

  describe('restore', () => {
    it('throws NotFoundException for unknown id', async () => {
      projectRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.restore('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if project is not archived', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      await expect(service.restore('p1')).rejects.toThrow(BadRequestException);
    });

    it('flips archived → draft and persists', async () => {
      const project: any = { id: 'p1', status: 'archived' };
      projectRepo.findOne.mockResolvedValueOnce(project);
      await service.restore('p1');
      expect(projectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', status: 'draft' }),
      );
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      projectRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for archived project', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'archived' });
      await expect(service.findOne('p1')).rejects.toThrow(BadRequestException);
    });

    it('returns project with files', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft', title: 'X' });
      fileRepo.find.mockResolvedValueOnce([{ id: 'f1', path: 'a.json', fileType: 'json' }]);

      const result = await service.findOne('p1');
      expect(result.id).toBe('p1');
      expect(result.files).toHaveLength(1);
    });
  });

  // ── archive ──

  describe('archive', () => {
    it('sets status to archived', async () => {
      const project = { id: 'p1', status: 'draft' };
      projectRepo.findOne.mockResolvedValueOnce(project);

      await service.archive('p1');
      expect(projectRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }));
    });
  });

  // ── sanitizePath (tested indirectly through readFile/createFile) ──

  describe('path traversal prevention', () => {
    beforeEach(() => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', status: 'draft' });
    });

    it('rejects absolute paths', async () => {
      await expect(service.readFile('p1', '/etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('rejects ../ traversal', async () => {
      await expect(service.readFile('p1', '../../../etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('rejects paths that normalize to ..', async () => {
      await expect(service.readFile('p1', 'foo/../../etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('accepts valid relative paths', async () => {
      fileRepo.findOne.mockResolvedValueOnce({ content: '{}', fileType: 'json' });
      const result = await service.readFile('p1', 'execution/manifest.json');
      expect(result.content).toBe('{}');
    });
  });

  // ── readFile ──

  describe('readFile', () => {
    it('throws NotFoundException if file does not exist', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.readFile('p1', 'missing.json')).rejects.toThrow(NotFoundException);
    });
  });

  // ── writeFile ──

  describe('writeFile', () => {
    it('updates file content and project updatedAt', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      const file = { content: 'old', updatedAt: '' };
      fileRepo.findOne.mockResolvedValueOnce(file);

      await service.writeFile('p1', 'a.json', 'new-content');
      expect(file.content).toBe('new-content');
      expect(fileRepo.save).toHaveBeenCalled();
      expect(projectRepo.update).toHaveBeenCalledWith('p1', expect.objectContaining({ updatedAt: expect.any(String) }));
    });

    it('throws if file not found', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.writeFile('p1', 'missing.json', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── createFile ──

  describe('createFile', () => {
    it('creates a new file', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce(null); // no existing file

      await service.createFile('p1', { path: 'notes.md', content: '# Notes' });
      expect(fileRepo.create).toHaveBeenCalledWith(expect.objectContaining({ path: 'notes.md' }));
      expect(fileRepo.save).toHaveBeenCalled();
    });

    it('rejects duplicate path', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({ id: 'f1' }); // already exists

      await expect(service.createFile('p1', { path: 'notes.md', content: '' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── deleteFile ──

  describe('deleteFile', () => {
    it('removes existing file', async () => {
      const file = { id: 'f1', path: 'a.json' };
      fileRepo.findOne.mockResolvedValueOnce(file);
      await service.deleteFile('p1', 'a.json');
      expect(fileRepo.remove).toHaveBeenCalledWith(file);
    });

    it('throws if file not found', async () => {
      fileRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.deleteFile('p1', 'missing.json')).rejects.toThrow(NotFoundException);
    });
  });

  // ── validateManifestContent (stateless pre-flight; used by agent self-check) ──

  describe('validateManifestContent', () => {
    const validManifest = {
      id: 'p1',
      title: 'Lesson',
      subject: 'Math',
      gradeLevel: '7',
      lessonType: 'interactive',
      readingSteps: [
        {
          id: 's1',
          idx: 1,
          type: 'task',
          answerKey: {
            type: 'quiz',
            answers: [
              { questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 0 },
            ],
          },
        },
      ],
    };

    it('returns valid:true + stepCount for a schema-conforming manifest', () => {
      const result = service.validateManifestContent(JSON.stringify(validManifest));
      expect(result.valid).toBe(true);
      expect(result.stepCount).toBe(1);
      expect(result.issues).toBeUndefined();
    });

    it('returns valid:false with parse error for invalid JSON', () => {
      const result = service.validateManifestContent('{not json');
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues![0].path).toBe('$');
      expect(result.issues![0].message).toMatch(/invalid JSON/);
    });

    it('returns valid:false with each Zod issue mapped to path + message', () => {
      const broken = { ...validManifest, readingSteps: [] }; // .min(1) violated
      const result = service.validateManifestContent(JSON.stringify(broken));
      expect(result.valid).toBe(false);
      expect(result.issues!.length).toBeGreaterThan(0);
      // Path uses dot-joined form per the service contract.
      expect(result.issues![0].path).toContain('readingSteps');
    });

    it('catches a typo in answerKey.type with a discriminator-union error', () => {
      // Common agent mistake: 'qiuz' instead of 'quiz'. This is the
      // exact failure mode the self-check is designed to flag before
      // publish. If this assertion breaks, the agent loses fast feedback.
      const typo: any = JSON.parse(JSON.stringify(validManifest));
      typo.readingSteps[0].answerKey.type = 'qiuz';
      const result = service.validateManifestContent(JSON.stringify(typo));
      expect(result.valid).toBe(false);
      const blob = result.issues!.map((i) => `${i.path}: ${i.message}`).join('\n');
      expect(blob).toMatch(/readingSteps.*answerKey/);
    });
  });

  // ── publish ──

  describe('publish', () => {
    const validManifest = {
      id: 'anything',
      title: 'Lesson',
      subject: 'Math',
      gradeLevel: '7',
      lessonType: 'interactive',
      readingSteps: [{ id: 's1', idx: 0, label: 'Step 1' }],
    };

    it('creates a new lesson when none exists', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({
        content: JSON.stringify(validManifest),
      });
      lessonRepo.findById.mockResolvedValueOnce(null); // no existing lesson

      const result = await service.publish('p1');
      expect(result.lessonId).toBe('p1'); // uses projectId, not manifest.id
      expect(lessonRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    });

    it('updates existing lesson on re-publish', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({
        content: JSON.stringify(validManifest),
      });
      const existing = { id: 'p1', manifestJson: '{}' };
      lessonRepo.findById.mockResolvedValueOnce(existing);

      const result = await service.publish('p1');
      expect(result.lessonId).toBe('p1');
      expect(lessonRepo.update).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Lesson' }));
    });

    it('always uses projectId as lessonId (prevents hijack)', async () => {
      const hijackManifest = { ...validManifest, id: 'someone-elses-lesson' };
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({
        content: JSON.stringify(hijackManifest),
      });
      lessonRepo.findById.mockResolvedValueOnce(null);

      const result = await service.publish('p1');
      expect(result.lessonId).toBe('p1'); // NOT "someone-elses-lesson"
    });

    it('rejects if no manifest file', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.publish('p1')).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid JSON', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({ content: '{bad json' });

      await expect(service.publish('p1')).rejects.toThrow(BadRequestException);
    });

    it('rejects manifest that fails schema validation', async () => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.findOne.mockResolvedValueOnce({
        content: JSON.stringify({ title: 'x' }), // missing required fields
      });

      await expect(service.publish('p1')).rejects.toThrow(BadRequestException);
    });

    it('sets project status to published', async () => {
      const project = { id: 'p1', status: 'draft' };
      projectRepo.findOne.mockResolvedValueOnce(project);
      fileRepo.findOne.mockResolvedValueOnce({
        content: JSON.stringify(validManifest),
      });
      lessonRepo.findById.mockResolvedValueOnce(null);

      await service.publish('p1');
      expect(projectRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }));
    });
  });

  // ── listArtifactsWithContent (with optional user-scoped lib append) ──

  describe('listArtifactsWithContent', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Default state for these tests: project exists, returns 2 files.
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
      fileRepo.find.mockResolvedValueOnce([
        { path: 'plan/lesson-plan.md', content: '# plan', fileType: 'md' },
        { path: 'execution/manifest.json', content: '{}', fileType: 'json' },
      ]);
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('returns only project files when no userId provided', async () => {
      delete process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT;
      const out = await service.listArtifactsWithContent('p1');
      expect(out).toHaveLength(2);
      expect(out.map((a) => a.path)).toEqual([
        'plan/lesson-plan.md',
        'execution/manifest.json',
      ]);
      expect(interpretations.listForUser).not.toHaveBeenCalled();
    });

    it('returns only project files when userId present but subject env unset', async () => {
      delete process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT;
      const out = await service.listArtifactsWithContent('p1', { userId: 'alice' });
      expect(out).toHaveLength(2);
      // L1/L2 services not consulted when subject is missing — the
      // env switch is the opt-in.
      expect(teachingRequirements.getLibrary).not.toHaveBeenCalled();
      expect(interpretations.listForUser).not.toHaveBeenCalled();
    });

    it('returns only project files when subject env set but userId absent', async () => {
      process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT = 'english';
      const out = await service.listArtifactsWithContent('p1');
      expect(out).toHaveLength(2);
      expect(interpretations.listForUser).not.toHaveBeenCalled();
    });

    it('appends _lib/*.md when userId + subject both present', async () => {
      process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT = 'english';
      teachingRequirements.getLibrary.mockReturnValueOnce({
        subject: 'english',
        subjectLabel: '英语',
        version: '2026-05',
        categories: [
          {
            id: 'lang',
            label: '语言能力',
            color: 'teal',
            items: [{ id: 'r-1.2.3', code: '课标 2.1.3', text: '推断生词含义' }],
          },
        ],
      });
      interpretations.listForUser.mockResolvedValueOnce([
        {
          reqId: 'r-1.2.3',
          notes: 'my note',
          updatedAt: '2026-05-27T00:00:00Z',
        },
      ]);
      teachingRequirements.tryFindItemById.mockReturnValueOnce({
        id: 'r-1.2.3',
        code: '课标 2.1.3',
        text: '推断生词含义',
        subject: 'english',
        categoryId: 'lang',
        categoryLabel: '语言能力',
        categoryColor: 'teal',
      });

      const out = await service.listArtifactsWithContent('p1', { userId: 'alice' });
      const paths = out.map((a) => a.path);
      expect(paths).toContain('_lib/teaching-requirements.md');
      expect(paths).toContain('_lib/my-interpretations.md');
      expect(interpretations.listForUser).toHaveBeenCalledWith('alice');
      const libFile = out.find((a) => a.path === '_lib/teaching-requirements.md');
      expect(libFile?.content).toContain('推断生词含义');
      const myFile = out.find((a) => a.path === '_lib/my-interpretations.md');
      expect(myFile?.content).toContain('my note');
    });

    it('emits empty-state my-interpretations.md when user has zero recorded', async () => {
      process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT = 'english';
      teachingRequirements.getLibrary.mockReturnValueOnce(null);
      interpretations.listForUser.mockResolvedValueOnce([]);

      const out = await service.listArtifactsWithContent('p1', { userId: 'alice' });
      const paths = out.map((a) => a.path);
      // No library (subject not registered) → no teaching-requirements.md
      expect(paths).not.toContain('_lib/teaching-requirements.md');
      // But still emit my-interpretations.md (placeholder) so the
      // agent sees the lib materialization ran.
      expect(paths).toContain('_lib/my-interpretations.md');
    });

    it('never queries L2 service unless both userId + subject are set', async () => {
      delete process.env.LIVE_LESSON_LESSON_PLAN_SUBJECT;
      await service.listArtifactsWithContent('p1', { userId: 'alice' });
      expect(interpretations.listForUser).not.toHaveBeenCalled();
    });
  });

  // ── _lib/ reserved-prefix guard (round-trip pollution prevention) ──

  describe('upsertArtifact reserved-prefix guard', () => {
    beforeEach(() => {
      projectRepo.findOne.mockResolvedValueOnce({ id: 'p1', status: 'draft' });
    });

    it('rejects writes to _lib/teaching-requirements.md (platform-rendered)', async () => {
      await expect(
        service.upsertArtifact('p1', '_lib/teaching-requirements.md', '...', 'md'),
      ).rejects.toThrow(/_lib\/ prefix/);
    });

    it('rejects writes to _lib/my-interpretations.md', async () => {
      await expect(
        service.upsertArtifact('p1', '_lib/my-interpretations.md', '...', 'md'),
      ).rejects.toThrow(/_lib\/ prefix/);
    });

    it('rejects writes to arbitrary _lib/ subpath', async () => {
      await expect(
        service.upsertArtifact('p1', '_lib/future-thing.md', '...', 'md'),
      ).rejects.toThrow(/_lib\/ prefix/);
    });

    it('does NOT call save when path is reserved', async () => {
      await expect(
        service.upsertArtifact('p1', '_lib/x.md', '...', 'md'),
      ).rejects.toThrow();
      expect(fileRepo.save).not.toHaveBeenCalled();
    });

    it('allows writes to non-_lib paths', async () => {
      fileRepo.findOne.mockResolvedValueOnce(null);
      await service.upsertArtifact('p1', 'plan/lesson-plan.md', '# new', 'md');
      expect(fileRepo.save).toHaveBeenCalled();
    });
  });

  describe('deleteFile reserved-prefix guard', () => {
    it('rejects deletes against _lib/* (platform-rendered)', async () => {
      await expect(
        service.deleteFile('p1', '_lib/teaching-requirements.md'),
      ).rejects.toThrow(/_lib\/ prefix/);
      expect(fileRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
