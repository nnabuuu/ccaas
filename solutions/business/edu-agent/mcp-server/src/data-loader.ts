/**
 * Data Loader for EduAgent MCP Server
 * Loads textbook and curriculum standards data from JSON files
 * Copied and adapted from lesson-plan-designer/mcp-server/src/data-loader.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base data path - relative to compiled output (dist/)
const DATA_BASE_PATH = path.join(__dirname, '../../data');

// ===== Types =====

export interface TextbookChapter {
  id: number;
  title: string;
  children?: TextbookChapter[];
}

interface TextbookEdition {
  subject: string;
  grade: number;
  volume: string;
  file: string;
}

interface TextbookIndex {
  _meta: { version: string; generatedAt: string; source: string };
  subjects: string[];
  editions: TextbookEdition[];
}

interface ChapterFile {
  subject: string;
  grade: number;
  volume: string;
  chapters: TextbookChapter[];
}

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

interface StandardsIndex {
  _meta: { version: string; syncedAt: string };
  standards: { id: string; subject: string; count: number; file: string }[];
}

interface SubjectStandardsFile {
  _meta: { syncedAt: string };
  subject: string;
  count: number;
  standards: CurriculumStandard[];
}

// ===== Subject / Knowledge Point types (problem-explainer) =====

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
}

// ===== Caches =====

let textbookIndex: TextbookIndex | null = null;
let standardsIndex: StandardsIndex | null = null;
const chapterCache = new Map<string, TextbookChapter[]>();
const standardsCache = new Map<string, CurriculumStandard[]>();

// ===== Textbook Functions =====

function loadTextbookIndex(): TextbookIndex | null {
  if (textbookIndex) return textbookIndex;
  try {
    const indexPath = path.join(DATA_BASE_PATH, 'textbooks/_index.json');
    const content = fs.readFileSync(indexPath, 'utf-8');
    textbookIndex = JSON.parse(content);
    return textbookIndex;
  } catch (error) {
    console.error('Failed to load textbook index:', error);
    return null;
  }
}

export function getTextbookSubjects(): string[] {
  const index = loadTextbookIndex();
  return index?.subjects || [];
}

export function getTextbookGrades(subject: string): number[] {
  const index = loadTextbookIndex();
  if (!index) return [];
  const grades = index.editions.filter(e => e.subject === subject).map(e => e.grade);
  return [...new Set(grades)].sort((a, b) => a - b);
}

export function getTextbookVolumes(subject: string, grade: number): string[] {
  const index = loadTextbookIndex();
  if (!index) return [];
  const volumes = index.editions.filter(e => e.subject === subject && e.grade === grade).map(e => e.volume);
  return [...new Set(volumes)];
}

export function getTextbookChapters(subject: string, grade: number, volume: string): TextbookChapter[] {
  const index = loadTextbookIndex();
  if (!index) return [];
  const cacheKey = `${subject}-${grade}-${volume}`;
  if (chapterCache.has(cacheKey)) return chapterCache.get(cacheKey)!;
  const edition = index.editions.find(e => e.subject === subject && e.grade === grade && e.volume === volume);
  if (!edition) return [];
  try {
    const chapterPath = path.join(DATA_BASE_PATH, 'textbooks/chapters', edition.file);
    const content = fs.readFileSync(chapterPath, 'utf-8');
    const data: ChapterFile = JSON.parse(content);
    chapterCache.set(cacheKey, data.chapters);
    return data.chapters;
  } catch (error) {
    console.error(`Failed to load chapters for ${edition.file}:`, error);
    return [];
  }
}

// ===== Curriculum Standards Functions =====

function loadStandardsIndex(): StandardsIndex | null {
  if (standardsIndex) return standardsIndex;
  try {
    const indexPath = path.join(DATA_BASE_PATH, 'curriculum-standards/_index.json');
    const content = fs.readFileSync(indexPath, 'utf-8');
    standardsIndex = JSON.parse(content);
    return standardsIndex;
  } catch (error) {
    console.error('Failed to load standards index:', error);
    return null;
  }
}

function loadSubjectStandards(subject: string): CurriculumStandard[] {
  if (standardsCache.has(subject)) return standardsCache.get(subject)!;
  const index = loadStandardsIndex();
  if (!index) return [];
  const info = index.standards.find(s => s.subject === subject);
  if (!info) return [];
  try {
    const filePath = path.join(DATA_BASE_PATH, 'curriculum-standards', info.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: SubjectStandardsFile = JSON.parse(content);
    standardsCache.set(subject, data.standards);
    return data.standards;
  } catch (error) {
    console.error(`Failed to load standards for ${subject}:`, error);
    return [];
  }
}

export function getCurriculumSubjects(): string[] {
  const index = loadStandardsIndex();
  return index?.standards.map(s => s.subject) || [];
}

export function getCurriculumStages(subject: string): string[] {
  const standards = loadSubjectStandards(subject);
  return [...new Set(standards.map(s => s.stage))].sort();
}

export function getCurriculumStandards(
  subject: string,
  stage?: string,
  standardType?: string,
  contentDomain?: string,
  keyword?: string,
): { subject: string; count: number; standards: CurriculumStandard[] } {
  let standards = loadSubjectStandards(subject);
  if (stage) standards = standards.filter(s => s.stage === stage);
  if (standardType) standards = standards.filter(s => s.standardType === standardType);
  if (contentDomain) standards = standards.filter(s => s.contentDomain === contentDomain);
  if (keyword) {
    const lk = keyword.toLowerCase();
    standards = standards.filter(s => s.title.toLowerCase().includes(lk) || s.standardCode.toLowerCase().includes(lk));
  }
  return { subject, count: standards.length, standards };
}

// ===== Problem Explainer Functions =====

export function getSubjects(): Subject[] {
  try {
    const filePath = path.join(DATA_BASE_PATH, 'subjects.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fallback
    return [
      { id: 'math', name: '数学', hasFormula: true },
      { id: 'physics', name: '物理', hasFormula: true },
      { id: 'chemistry', name: '化学', hasFormula: true },
      { id: 'chinese', name: '语文', hasFormula: false },
      { id: 'english', name: '英语', hasFormula: false },
    ];
  }
}

export function getKnowledgePoints(subject: string, grade?: string): KnowledgePoint[] {
  try {
    const filePath = path.join(DATA_BASE_PATH, `knowledge-points/${subject}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    let points: KnowledgePoint[] = JSON.parse(content);
    if (grade) {
      points = points.filter(p => !p.grade || p.grade === grade);
    }
    return points;
  } catch {
    return [];
  }
}

export function calculateDifficulty(knowledgePointCount: number, stepCount: number): {
  difficulty: number;
  label: string;
  estimatedTime: string;
} {
  const difficulty = Math.min(5, Math.ceil(knowledgePointCount * 0.5 + stepCount * 0.3));
  const labels: Record<number, string> = { 1: '基础', 2: '简单', 3: '中等', 4: '较难', 5: '困难' };
  const times: Record<number, string> = { 1: '3-5分钟', 2: '5-8分钟', 3: '8-12分钟', 4: '12-18分钟', 5: '18-25分钟' };
  return {
    difficulty,
    label: labels[difficulty] || '未知',
    estimatedTime: times[difficulty] || '未知',
  };
}
