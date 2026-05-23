import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { LESSON_REPO_PORT } from '../domain/ports/lesson-repo.port';

// ── Mock repository factory ──

function mockRepo() {
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
  };
}

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: ReturnType<typeof mockRepo>;
  let fileRepo: ReturnType<typeof mockRepo>;
  let lessonRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    projectRepo = mockRepo();
    fileRepo = mockRepo();
    lessonRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(CourseProject), useValue: projectRepo },
        { provide: getRepositoryToken(ProjectFile), useValue: fileRepo },
        { provide: LESSON_REPO_PORT, useValue: lessonRepo },
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
  });

  // ── findAll ──

  describe('findAll', () => {
    it('returns non-archived projects', async () => {
      projectRepo.find.mockResolvedValueOnce([{ id: 'p1', status: 'draft' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
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
});
