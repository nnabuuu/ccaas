import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

interface StandardsIndex {
  _meta: {
    version: string;
    syncedAt: string;
  };
  standards: {
    id: string;
    subject: string;
    count: number;
    file: string;
  }[];
}

interface SubjectFile {
  _meta: {
    syncedAt: string;
  };
  subject: string;
  count: number;
  standards: CurriculumStandard[];
}

@Injectable()
export class CurriculumStandardsService implements OnModuleInit {
  private index: StandardsIndex | null = null;
  private dataPath: string;
  private standardsCache: Map<string, CurriculumStandard[]> = new Map();

  constructor() {
    // Path to data files (relative to dist/ when compiled)
    // __dirname in compiled code is: backend/dist/curriculum-standards/
    // Data is in: solutions/lesson-plan-designer/data/curriculum-standards
    this.dataPath = path.join(__dirname, '../../../data/curriculum-standards');
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
      console.error('Failed to load curriculum standards index:', error);
      this.index = null;
    }
  }

  private loadSubjectStandards(subject: string): CurriculumStandard[] {
    // Check cache first
    if (this.standardsCache.has(subject)) {
      return this.standardsCache.get(subject)!;
    }

    if (!this.index) {
      return [];
    }

    // Find the subject file
    const subjectInfo = this.index.standards.find((s) => s.subject === subject);
    if (!subjectInfo) {
      return [];
    }

    try {
      const filePath = path.join(this.dataPath, subjectInfo.file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: SubjectFile = JSON.parse(content);

      // Cache the result
      this.standardsCache.set(subject, data.standards);

      return data.standards;
    } catch (error) {
      console.error(`Failed to load standards for ${subject}:`, error);
      return [];
    }
  }

  /**
   * Get all available subjects
   * @returns string[] - e.g., ["数学", "物理", "化学"]
   */
  getSubjects(): string[] {
    if (!this.index) {
      return [];
    }
    return this.index.standards.map((s) => s.subject);
  }

  /**
   * Get all available stages for a subject
   * @returns string[] - unique stages
   */
  getStages(subject: string): string[] {
    const standards = this.loadSubjectStandards(subject);
    const stages = [...new Set(standards.map((s) => s.stage))];
    return stages.sort();
  }

  /**
   * Get curriculum standards with optional filtering
   */
  getStandards(
    subject: string,
    stage?: string,
    standardType?: string,
    contentDomain?: string,
    keyword?: string,
  ): { subject: string; count: number; standards: CurriculumStandard[] } {
    let standards = this.loadSubjectStandards(subject);

    // Filter by stage
    if (stage) {
      standards = standards.filter((s) => s.stage === stage);
    }

    // Filter by standard type
    if (standardType) {
      standards = standards.filter((s) => s.standardType === standardType);
    }

    // Filter by content domain
    if (contentDomain) {
      standards = standards.filter((s) => s.contentDomain === contentDomain);
    }

    // Filter by keyword
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      standards = standards.filter(
        (s) =>
          s.title.toLowerCase().includes(lowerKeyword) ||
          s.standardCode.toLowerCase().includes(lowerKeyword),
      );
    }

    return {
      subject,
      count: standards.length,
      standards,
    };
  }

  /**
   * Get a single standard by ID
   */
  getStandardById(subject: string, id: number): CurriculumStandard | null {
    const standards = this.loadSubjectStandards(subject);
    return standards.find((s) => s.id === id) || null;
  }
}
