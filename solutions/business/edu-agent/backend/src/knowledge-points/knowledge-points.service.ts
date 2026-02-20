import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Subject {
  id: string;
  name: string;
  hasFormula: boolean;
}

export interface KnowledgePoint {
  id: string;
  subject: string;
  name: string;
  grade?: string;
  parentId?: string;
  children?: KnowledgePoint[];
  description?: string;
  commonProblemTypes?: string[];
  relatedFormulas?: string[];
}

// Default subjects
const SUBJECTS: Subject[] = [
  // Sciences
  { id: 'math', name: '数学', hasFormula: true },
  { id: 'physics', name: '物理', hasFormula: true },
  { id: 'chemistry', name: '化学', hasFormula: true },
  { id: 'biology', name: '生物', hasFormula: false },
  // Languages
  { id: 'chinese', name: '语文', hasFormula: false },
  { id: 'english', name: '英语', hasFormula: false },
  // Social Sciences
  { id: 'history', name: '历史', hasFormula: false },
  { id: 'geography', name: '地理', hasFormula: false },
  { id: 'politics', name: '政治', hasFormula: false },
];

@Injectable()
export class KnowledgePointsService {
  private knowledgePointsCache: Map<string, KnowledgePoint[]> = new Map();
  private readonly dataDir: string;

  constructor() {
    // Data directory relative to backend
    this.dataDir = path.resolve(__dirname, '../../../data/knowledge-points');
    this.loadAllKnowledgePoints();
  }

  private loadAllKnowledgePoints(): void {
    if (!fs.existsSync(this.dataDir)) {
      console.warn(`Knowledge points directory not found: ${this.dataDir}`);
      return;
    }

    for (const subject of SUBJECTS) {
      const filePath = path.join(this.dataDir, `${subject.id}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.knowledgePointsCache.set(subject.id, data.knowledgePoints || []);
        } catch (error) {
          console.error(`Failed to load knowledge points for ${subject.id}:`, error);
        }
      }
    }
  }

  getSubjects(): Subject[] {
    return SUBJECTS;
  }

  getSubjectById(id: string): Subject | undefined {
    // Support both ID and Chinese name lookup
    return SUBJECTS.find(s => s.id === id || s.name === id);
  }

  getKnowledgePoints(
    subject: string,
    grade?: string,
    parentId?: string,
  ): KnowledgePoint[] {
    // Normalize subject to ID
    const subjectInfo = this.getSubjectById(subject);
    if (!subjectInfo) {
      return [];
    }

    const allPoints = this.knowledgePointsCache.get(subjectInfo.id) || [];

    // Filter by grade and parent
    let filtered = allPoints;

    if (parentId) {
      // Find children of the parent
      const parent = this.findKnowledgePointById(allPoints, parentId);
      filtered = parent?.children || [];
    }

    if (grade) {
      filtered = filtered.filter(p => !p.grade || p.grade === grade);
    }

    return filtered;
  }

  private findKnowledgePointById(
    points: KnowledgePoint[],
    id: string,
  ): KnowledgePoint | undefined {
    for (const point of points) {
      if (point.id === id) {
        return point;
      }
      if (point.children) {
        const found = this.findKnowledgePointById(point.children, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }
}
