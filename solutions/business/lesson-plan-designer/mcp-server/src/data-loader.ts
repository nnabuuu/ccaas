/**
 * Data Loader for Lesson Plan Designer MCP Server
 *
 * Loads textbook and curriculum standards data from JSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base data path - relative to compiled output
const DATA_BASE_PATH = path.join(__dirname, '../../data');

// ===== Textbook Types =====

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

// ===== Curriculum Standards Types =====

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

interface SubjectStandardsFile {
  _meta: {
    syncedAt: string;
  };
  subject: string;
  count: number;
  standards: CurriculumStandard[];
}

// ===== Cached Data =====

let textbookIndex: TextbookIndex | null = null;
let standardsIndex: StandardsIndex | null = null;
const chapterCache = new Map<string, TextbookChapter[]>();
const standardsCache = new Map<string, CurriculumStandard[]>();

// ===== Textbook Loading Functions =====

function loadTextbookIndex(): TextbookIndex | null {
  if (textbookIndex) {
    return textbookIndex;
  }

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

/**
 * Get all available textbook subjects
 */
export function getTextbookSubjects(): string[] {
  const index = loadTextbookIndex();
  if (!index) {
    return [];
  }
  return index.subjects;
}

/**
 * Get available grades for a subject
 */
export function getTextbookGrades(subject: string): number[] {
  const index = loadTextbookIndex();
  if (!index) {
    return [];
  }

  const grades = index.editions
    .filter((e) => e.subject === subject)
    .map((e) => e.grade);

  return [...new Set(grades)].sort((a, b) => a - b);
}

/**
 * Get available volumes for a subject and grade
 */
export function getTextbookVolumes(subject: string, grade: number): string[] {
  const index = loadTextbookIndex();
  if (!index) {
    return [];
  }

  const volumes = index.editions
    .filter((e) => e.subject === subject && e.grade === grade)
    .map((e) => e.volume);

  return [...new Set(volumes)];
}

/**
 * Get chapter tree for a specific textbook edition
 */
export function getTextbookChapters(
  subject: string,
  grade: number,
  volume: string,
): TextbookChapter[] {
  const index = loadTextbookIndex();
  if (!index) {
    return [];
  }

  // Check cache
  const cacheKey = `${subject}-${grade}-${volume}`;
  if (chapterCache.has(cacheKey)) {
    return chapterCache.get(cacheKey)!;
  }

  // Find the edition
  const edition = index.editions.find(
    (e) => e.subject === subject && e.grade === grade && e.volume === volume,
  );

  if (!edition) {
    return [];
  }

  // Load the chapter file
  try {
    const chapterPath = path.join(
      DATA_BASE_PATH,
      'textbooks/chapters',
      edition.file,
    );
    const content = fs.readFileSync(chapterPath, 'utf-8');
    const data: ChapterFile = JSON.parse(content);

    // Cache the result
    chapterCache.set(cacheKey, data.chapters);

    return data.chapters;
  } catch (error) {
    console.error(`Failed to load chapters for ${edition.file}:`, error);
    return [];
  }
}

// ===== Curriculum Standards Loading Functions =====

function loadStandardsIndex(): StandardsIndex | null {
  if (standardsIndex) {
    return standardsIndex;
  }

  try {
    const indexPath = path.join(
      DATA_BASE_PATH,
      'curriculum-standards/_index.json',
    );
    const content = fs.readFileSync(indexPath, 'utf-8');
    standardsIndex = JSON.parse(content);
    return standardsIndex;
  } catch (error) {
    console.error('Failed to load curriculum standards index:', error);
    return null;
  }
}

function loadSubjectStandards(subject: string): CurriculumStandard[] {
  // Check cache
  if (standardsCache.has(subject)) {
    return standardsCache.get(subject)!;
  }

  const index = loadStandardsIndex();
  if (!index) {
    return [];
  }

  // Find the subject file
  const subjectInfo = index.standards.find((s) => s.subject === subject);
  if (!subjectInfo) {
    return [];
  }

  try {
    const filePath = path.join(
      DATA_BASE_PATH,
      'curriculum-standards',
      subjectInfo.file,
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: SubjectStandardsFile = JSON.parse(content);

    // Cache the result
    standardsCache.set(subject, data.standards);

    return data.standards;
  } catch (error) {
    console.error(`Failed to load standards for ${subject}:`, error);
    return [];
  }
}

/**
 * Get all available curriculum standards subjects
 */
export function getCurriculumSubjects(): string[] {
  const index = loadStandardsIndex();
  if (!index) {
    return [];
  }
  return index.standards.map((s) => s.subject);
}

/**
 * Get available stages for a subject
 */
export function getCurriculumStages(subject: string): string[] {
  const standards = loadSubjectStandards(subject);
  const stages = [...new Set(standards.map((s) => s.stage))];
  return stages.sort();
}

/**
 * Get curriculum standards with optional filtering
 */
export function getCurriculumStandards(
  subject: string,
  stage?: string,
  standardType?: string,
  contentDomain?: string,
  keyword?: string,
): { subject: string; count: number; standards: CurriculumStandard[] } {
  let standards = loadSubjectStandards(subject);

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
