import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TextbookChapter {
  id: number;
  title: string;
  children?: TextbookChapter[];
}

export interface TextbookEdition {
  subject: string;
  grade: number;
  volume: string;
  file: string;
}

interface TextbookIndex {
  _meta: {
    version: string;
    generatedAt: string;
    source: string;
  };
  subjects: string[];
  editions: TextbookEdition[];
}

interface ChapterFile {
  subject: string;
  grade: number;
  volume: string;
  chapters: TextbookChapter[];
}

@Injectable()
export class TextbookService implements OnModuleInit {
  private index: TextbookIndex | null = null;
  private dataPath: string;

  constructor() {
    // Path to data files (relative to dist/ when compiled)
    // __dirname in compiled code is: backend/dist/textbook/
    // So we need: ../../data/textbooks (which is backend/data/textbooks)
    // But data is in: solutions/lesson-plan-designer/data/textbooks
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
   * GET /api/textbook/subjects
   * Returns array of subject names
   */
  getSubjects(): string[] {
    if (!this.index) {
      return [];
    }
    return this.index.subjects;
  }

  /**
   * GET /api/textbook/volumes?subject=数学&grade=3
   * Returns array of volume names for a subject and grade
   */
  getVolumes(subject: string, grade: number): string[] {
    if (!this.index) {
      return [];
    }

    const volumes = this.index.editions
      .filter((e) => e.subject === subject && e.grade === grade)
      .map((e) => e.volume);

    return [...new Set(volumes)]; // Remove duplicates
  }

  /**
   * GET /api/textbook/chapters?subject=数学&grade=3&volume=上册
   * Returns chapter tree for a specific textbook edition
   */
  getChapters(subject: string, grade: number, volume: string): TextbookChapter[] {
    if (!this.index) {
      return [];
    }

    // Find the edition
    const edition = this.index.editions.find(
      (e) => e.subject === subject && e.grade === grade && e.volume === volume,
    );

    if (!edition) {
      return [];
    }

    // Load the chapter file
    try {
      const chapterPath = path.join(this.dataPath, 'chapters', edition.file);
      const content = fs.readFileSync(chapterPath, 'utf-8');
      const data: ChapterFile = JSON.parse(content);
      return data.chapters;
    } catch (error) {
      console.error(`Failed to load chapters for ${edition.file}:`, error);
      return [];
    }
  }

  /**
   * Find a specific chapter by ID in a chapter tree
   */
  findChapterById(chapters: TextbookChapter[], id: number): TextbookChapter | null {
    for (const chapter of chapters) {
      if (chapter.id === id) {
        return chapter;
      }
      if (chapter.children) {
        const found = this.findChapterById(chapter.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Get all available grades for a subject
   */
  getGrades(subject: string): number[] {
    if (!this.index) {
      return [];
    }

    const grades = this.index.editions
      .filter((e) => e.subject === subject)
      .map((e) => e.grade);

    return [...new Set(grades)].sort((a, b) => a - b);
  }
}
