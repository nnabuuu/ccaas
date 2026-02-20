import { TextbookService } from './textbook.service';
import { findChapterById } from './mock-data';

describe('TextbookService', () => {
  let service: TextbookService;

  beforeEach(() => {
    service = new TextbookService();
    // Manually call onModuleInit since we're not using NestJS test module
    service.onModuleInit();
  });

  describe('getSubjects', () => {
    it('should return all subjects with id and label', () => {
      const subjects = service.getSubjects();

      expect(subjects.length).toBeGreaterThan(0);
      expect(subjects[0]).toHaveProperty('id');
      expect(subjects[0]).toHaveProperty('label');
    });

    it('should include math subject', () => {
      const subjects = service.getSubjects();

      const mathSubject = subjects.find((s) => s.id === 'math');
      expect(mathSubject).toBeDefined();
      expect(mathSubject?.label).toBe('数学');
    });

    it('should include physics subject', () => {
      const subjects = service.getSubjects();

      const physicsSubject = subjects.find((s) => s.id === 'physics');
      expect(physicsSubject).toBeDefined();
      expect(physicsSubject?.label).toBe('物理');
    });

    it('should include chemistry subject', () => {
      const subjects = service.getSubjects();

      const chemistrySubject = subjects.find((s) => s.id === 'chemistry');
      expect(chemistrySubject).toBeDefined();
      expect(chemistrySubject?.label).toBe('化学');
    });
  });

  describe('getGrades', () => {
    it('should return grades for math subject', () => {
      const grades = service.getGrades('math');

      expect(grades.length).toBeGreaterThan(0);
      expect(grades[0]).toHaveProperty('id');
      expect(grades[0]).toHaveProperty('label');
      expect(grades[0]).toHaveProperty('stage');
    });

    it('should return grades for 数学 (Chinese) subject name', () => {
      const grades = service.getGrades('数学');

      expect(grades.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent subjects', () => {
      const grades = service.getGrades('nonexistent');

      expect(grades).toEqual([]);
    });

    it('should have correct stage information', () => {
      const grades = service.getGrades('math');

      const grade1 = grades.find((g) => g.id === 1);
      if (grade1) {
        expect(grade1.stage).toBe('义务教育阶段第一学段');
      }

      const grade3 = grades.find((g) => g.id === 3);
      if (grade3) {
        expect(grade3.stage).toBe('义务教育阶段第二学段');
      }
    });

    it('should return grades sorted by id', () => {
      const grades = service.getGrades('math');

      for (let i = 1; i < grades.length; i++) {
        expect(grades[i].id).toBeGreaterThan(grades[i - 1].id);
      }
    });
  });

  describe('getPublishers', () => {
    it('should return publishers for math subject', () => {
      const publishers = service.getPublishers('math', 3);

      expect(publishers.length).toBeGreaterThan(0);
      expect(publishers.map((p) => p.label)).toContain('人教版');
    });

    it('should return empty array for non-existent subject/grade combination', () => {
      const publishers = service.getPublishers('nonexistent', 3);

      expect(publishers).toEqual([]);
    });

    it('should return empty array for invalid grade', () => {
      const publishers = service.getPublishers('math', 99);

      expect(publishers).toEqual([]);
    });
  });

  describe('getVolumes', () => {
    it('should return volumes for math subject', () => {
      const volumes = service.getVolumes('math', 3, '人教版');

      expect(volumes.length).toBeGreaterThan(0);
      expect(volumes[0]).toHaveProperty('id');
      expect(volumes[0]).toHaveProperty('label');
    });

    it('should include 上册 and 下册', () => {
      const volumes = service.getVolumes('math', 3, '人教版');

      expect(volumes.map((v) => v.label)).toContain('上册');
      expect(volumes.map((v) => v.label)).toContain('下册');
    });

    it('should return empty array for non-existent subjects', () => {
      const volumes = service.getVolumes('nonexistent', 3, '人教版');

      expect(volumes).toEqual([]);
    });
  });

  describe('getChapters', () => {
    it('should return chapters for grade 3 math 人教版 上册', () => {
      const chapters = service.getChapters('math', 3, '人教版', '上册');

      expect(chapters.length).toBeGreaterThan(0);
    });

    it('should have children for unit chapters', () => {
      const chapters = service.getChapters('math', 3, '人教版', '上册');

      if (chapters.length > 0) {
        // Find a chapter with children
        const chapterWithChildren = chapters.find(
          (c) => c.children && c.children.length > 0,
        );
        expect(chapterWithChildren).toBeDefined();
      }
    });

    it('should return empty array for invalid combination', () => {
      const chapters = service.getChapters('nonexistent', 3, '人教版', '上册');

      expect(chapters).toEqual([]);
    });

    it('should return empty array for non-existent grade', () => {
      const chapters = service.getChapters('math', 99, '人教版', '上册');

      expect(chapters).toEqual([]);
    });

    it('should support Chinese subject name', () => {
      const chapters = service.getChapters('数学', 3, '人教版', '上册');

      expect(chapters.length).toBeGreaterThan(0);
    });

    it('should support volume ID (vol1)', () => {
      const chaptersWithLabel = service.getChapters('math', 3, '人教版', '上册');
      const chaptersWithId = service.getChapters('math', 3, '人教版', 'vol1');

      expect(chaptersWithLabel).toEqual(chaptersWithId);
    });
  });

  describe('findChapter', () => {
    it('should find a top-level chapter by ID', () => {
      const chapters = service.getChapters('math', 3, '人教版', '上册');

      if (chapters.length > 0) {
        const firstChapterId = chapters[0].id;
        const chapter = service.findChapter(
          'math',
          3,
          '人教版',
          '上册',
          firstChapterId,
        );

        expect(chapter).not.toBeNull();
        expect(chapter?.id).toBe(firstChapterId);
      }
    });

    it('should find a nested chapter by ID', () => {
      const chapters = service.getChapters('math', 3, '人教版', '上册');

      if (chapters.length > 0 && chapters[0].children?.length) {
        const nestedChapterId = chapters[0].children[0].id;
        const chapter = service.findChapter(
          'math',
          3,
          '人教版',
          '上册',
          nestedChapterId,
        );

        expect(chapter).not.toBeNull();
        expect(chapter?.id).toBe(nestedChapterId);
      }
    });

    it('should return null for non-existent chapter ID', () => {
      const chapter = service.findChapter('math', 3, '人教版', '上册', 999999);

      expect(chapter).toBeNull();
    });
  });
});

describe('findChapterById Helper', () => {
  const testChapters = [
    {
      id: 1,
      title: 'Chapter 1',
      children: [
        { id: 11, title: 'Section 1.1' },
        { id: 12, title: 'Section 1.2' },
      ],
    },
    {
      id: 2,
      title: 'Chapter 2',
      children: [{ id: 21, title: 'Section 2.1' }],
    },
  ];

  it('should find chapter in flat list', () => {
    const chapter = findChapterById(testChapters, 2);

    expect(chapter).not.toBeNull();
    expect(chapter?.title).toBe('Chapter 2');
  });

  it('should find chapter in nested list', () => {
    const chapter = findChapterById(testChapters, 11);

    expect(chapter).not.toBeNull();
    expect(chapter?.title).toBe('Section 1.1');
  });

  it('should return null for empty array', () => {
    const chapter = findChapterById([], 1);

    expect(chapter).toBeNull();
  });

  it('should return null for non-existent ID', () => {
    const chapter = findChapterById(testChapters, 999);

    expect(chapter).toBeNull();
  });
});

describe('Data Integrity', () => {
  let service: TextbookService;

  beforeEach(() => {
    service = new TextbookService();
    service.onModuleInit();
  });

  it('should have at least 3 subjects', () => {
    const subjects = service.getSubjects();

    expect(subjects.length).toBeGreaterThanOrEqual(3);
  });

  it('should have math grades from 1 to 9', () => {
    const grades = service.getGrades('math');
    const gradeIds = grades.map((g) => g.id);

    expect(gradeIds).toContain(1);
    expect(gradeIds).toContain(9);
  });

  it('should have chapters with unique IDs within each tree', () => {
    const chapters = service.getChapters('math', 3, '人教版', '上册');
    const allIds: number[] = [];

    function collectIds(
      items: Array<{ id: number; children?: Array<{ id: number }> }>,
    ) {
      for (const item of items) {
        allIds.push(item.id);
        if (item.children) {
          collectIds(
            item.children as Array<{
              id: number;
              children?: Array<{ id: number }>;
            }>,
          );
        }
      }
    }

    collectIds(chapters);

    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('should have chapters for physics grade 8', () => {
    const chapters = service.getChapters('physics', 8, '人教版', '上册');

    expect(chapters.length).toBeGreaterThan(0);
  });

  it('should have chapters for chemistry grade 9', () => {
    const chapters = service.getChapters('chemistry', 9, '人教版', '上册');

    expect(chapters.length).toBeGreaterThan(0);
  });
});
