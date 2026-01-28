import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  TextbookSubject,
  TextbookGrade,
  TextbookPublisher,
  TextbookVolume,
  TextbookChapter,
  findChapterById,
} from './mock-data';

interface TextbookIndex {
  _meta: {
    version: string;
    generatedAt: string;
    source: string;
  };
  subjects: string[];
  editions: {
    subject: string;
    grade: number;
    volume: string;
    file: string;
  }[];
}

interface ChapterFile {
  subject: string;
  grade: number;
  volume: string;
  chapters: TextbookChapter[];
}

// Subject name mapping (Chinese name -> ID)
const SUBJECT_ID_MAP: Record<string, string> = {
  '数学': 'math',
  '物理': 'physics',
  '化学': 'chemistry',
  '语文': 'chinese',
  '英语': 'english',
};

// Reverse mapping (ID -> Chinese name)
const SUBJECT_NAME_MAP: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  chinese: '语文',
  english: '英语',
};

// Grade labels and stages
const GRADE_INFO: Record<number, { label: string; stage: string }> = {
  1: { label: '一年级', stage: '义务教育阶段第一学段' },
  2: { label: '二年级', stage: '义务教育阶段第一学段' },
  3: { label: '三年级', stage: '义务教育阶段第二学段' },
  4: { label: '四年级', stage: '义务教育阶段第二学段' },
  5: { label: '五年级', stage: '义务教育阶段第二学段' },
  6: { label: '六年级', stage: '义务教育阶段第二学段' },
  7: { label: '七年级', stage: '义务教育阶段第三学段' },
  8: { label: '八年级', stage: '义务教育阶段第三学段' },
  9: { label: '九年级', stage: '义务教育阶段第四学段' },
};

// Publishers (only 人教版 supported with real data)
const PUBLISHERS: TextbookPublisher[] = [
  { id: 'pep', label: '人教版' },
  { id: 'bsd', label: '北师大版' },
  { id: 'su', label: '苏教版' },
];

// Volume mapping
const VOLUME_MAP: Record<string, { id: string; label: string }> = {
  '上册': { id: 'vol1', label: '上册' },
  '下册': { id: 'vol2', label: '下册' },
};

@Injectable()
export class TextbookService implements OnModuleInit {
  private index: TextbookIndex | null = null;
  private dataPath: string;
  private chaptersCache: Map<string, TextbookChapter[]> = new Map();

  constructor() {
    this.dataPath = path.join(__dirname, '../../../data/textbooks');
  }

  onModuleInit() {
    this.loadIndex();
  }

  private loadIndex(): void {
    try {
      const indexPath = path.join(this.dataPath, '_index.json');
      const content = fs.readFileSync(indexPath, 'utf-8');
      this.index = JSON.parse(content);
    } catch (error) {
      console.error('Failed to load textbook index:', error);
      this.index = null;
    }
  }

  /**
   * Normalize subject input (accept both ID and Chinese name)
   */
  private normalizeSubject(subject: string): string {
    // If it's an ID, convert to Chinese name
    if (SUBJECT_NAME_MAP[subject]) {
      return SUBJECT_NAME_MAP[subject];
    }
    // Already a Chinese name
    return subject;
  }

  /**
   * Get all available subjects
   * @returns TextbookSubject[] with id and label
   */
  getSubjects(): TextbookSubject[] {
    if (!this.index) {
      return [];
    }
    return this.index.subjects.map((name) => ({
      id: SUBJECT_ID_MAP[name] || name,
      label: name,
    }));
  }

  /**
   * Get available grades for a subject
   * @param subject - Subject ID or Chinese name
   * @returns TextbookGrade[] with id, label, and stage
   */
  getGrades(subject: string): TextbookGrade[] {
    if (!this.index) {
      return [];
    }

    const subjectName = this.normalizeSubject(subject);

    // Get unique grades for this subject from editions
    const grades = this.index.editions
      .filter((e) => e.subject === subjectName)
      .map((e) => e.grade);

    const uniqueGrades = [...new Set(grades)].sort((a, b) => a - b);

    return uniqueGrades.map((gradeNum) => ({
      id: gradeNum,
      label: GRADE_INFO[gradeNum]?.label || `${gradeNum}年级`,
      stage: GRADE_INFO[gradeNum]?.stage || '',
    }));
  }

  /**
   * Get available publishers for a subject and grade
   * @param subject - Subject ID or Chinese name
   * @param gradeId - Grade number
   * @returns TextbookPublisher[] (currently only 人教版)
   */
  getPublishers(subject: string, gradeId: number): TextbookPublisher[] {
    if (!this.index) {
      return [];
    }

    const subjectName = this.normalizeSubject(subject);

    // Check if this subject/grade combo exists
    const hasData = this.index.editions.some(
      (e) => e.subject === subjectName && e.grade === gradeId,
    );

    if (!hasData) {
      return [];
    }

    // Only return 人教版 for now (our data only has 人教版)
    return PUBLISHERS;
  }

  /**
   * Get available volumes for a subject, grade, and publisher
   * @param subject - Subject ID or Chinese name
   * @param gradeId - Grade number
   * @param publisher - Publisher label (e.g., '人教版') or ID (e.g., 'pep')
   * @returns TextbookVolume[] with id and label
   */
  getVolumes(
    subject: string,
    gradeId: number,
    publisher: string,
  ): TextbookVolume[] {
    if (!this.index) {
      return [];
    }

    const subjectName = this.normalizeSubject(subject);

    // Get volumes for this subject and grade
    const volumes = this.index.editions
      .filter((e) => e.subject === subjectName && e.grade === gradeId)
      .map((e) => e.volume);

    const uniqueVolumes = [...new Set(volumes)];

    return uniqueVolumes.map((vol) => VOLUME_MAP[vol] || { id: vol, label: vol });
  }

  /**
   * Get chapter tree for a subject, grade, publisher, and volume
   * @param subject - Subject ID or Chinese name
   * @param gradeId - Grade number
   * @param publisher - Publisher label or ID
   * @param volume - Volume label (e.g., '上册') or ID (e.g., 'vol1')
   * @returns TextbookChapter[] tree structure
   */
  getChapters(
    subject: string,
    gradeId: number,
    publisher: string,
    volume: string,
  ): TextbookChapter[] {
    if (!this.index) {
      return [];
    }

    const subjectName = this.normalizeSubject(subject);

    // Normalize volume (accept both '上册' and 'vol1')
    let volumeLabel = volume;
    if (volume === 'vol1') volumeLabel = '上册';
    if (volume === 'vol2') volumeLabel = '下册';

    // Cache key
    const cacheKey = `${subjectName}-${gradeId}-${volumeLabel}`;
    if (this.chaptersCache.has(cacheKey)) {
      return this.chaptersCache.get(cacheKey)!;
    }

    // Find the edition
    const edition = this.index.editions.find(
      (e) =>
        e.subject === subjectName &&
        e.grade === gradeId &&
        e.volume === volumeLabel,
    );

    if (!edition) {
      return [];
    }

    // Load chapter file
    try {
      const chapterPath = path.join(this.dataPath, 'chapters', edition.file);
      const content = fs.readFileSync(chapterPath, 'utf-8');
      const data: ChapterFile = JSON.parse(content);

      // Cache and return
      this.chaptersCache.set(cacheKey, data.chapters);
      return data.chapters;
    } catch (error) {
      console.error(`Failed to load chapters for ${edition.file}:`, error);
      return [];
    }
  }

  /**
   * Find a chapter by ID within a chapter tree
   * @param subject - Subject ID or Chinese name
   * @param gradeId - Grade number
   * @param publisher - Publisher label or ID
   * @param volume - Volume label or ID
   * @param chapterId - Chapter ID to find
   * @returns TextbookChapter or null
   */
  findChapter(
    subject: string,
    gradeId: number,
    publisher: string,
    volume: string,
    chapterId: number,
  ): TextbookChapter | null {
    const chapters = this.getChapters(subject, gradeId, publisher, volume);
    return findChapterById(chapters, chapterId);
  }
}
