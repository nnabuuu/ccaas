/**
 * JSON Data Loader for MCP Server
 *
 * This module loads knowledge points and catalogs from JSON files
 * instead of querying the SQLite database.
 *
 * Benefits:
 * - Faster startup (no database initialization)
 * - Simpler deployment (no database file needed)
 * - Easier to cache and query (in-memory structures)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// Type Definitions
// ========================================

export interface KnowledgePoint {
  id: string;
  subjectId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  description: string;
  level: number;
  gradeLevel: string;
  difficultyContribution: number;
  commonProblemTypes: string[];
  relatedFormulas: string[];
  createdAt: string;
  children: string[]; // IDs of child knowledge points
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string;
  gradeLevels: string[];
  hasFormula: boolean;
  createdAt: string;
}

interface KnowledgePointsData {
  version: string;
  lastUpdated: string;
  totalCount: number;
  knowledgePoints: KnowledgePoint[];
}

interface CatalogsData {
  version: string;
  lastUpdated: string;
  totalCount: number;
  subjects: Subject[];
}

// ========================================
// Data Loading
// ========================================

class JsonDataLoader {
  private knowledgePoints: KnowledgePoint[] = [];
  private subjects: Subject[] = [];

  // Indexes for fast lookup
  private kpById: Map<string, KnowledgePoint> = new Map();
  private kpByName: Map<string, KnowledgePoint[]> = new Map();
  private kpBySubject: Map<string, KnowledgePoint[]> = new Map();
  private subjectById: Map<string, Subject> = new Map();
  private subjectByName: Map<string, Subject[]> = new Map();

  private loaded = false;

  /**
   * Load JSON data files and build indexes
   */
  load() {
    if (this.loaded) {
      return;
    }

    console.log('📚 Loading JSON data files...');

    // Load knowledge points
    const kpFilePath = path.resolve(__dirname, '../../data/knowledge-points.json');
    const kpData: KnowledgePointsData = JSON.parse(fs.readFileSync(kpFilePath, 'utf-8'));
    this.knowledgePoints = kpData.knowledgePoints;
    console.log(`   ✅ Loaded ${this.knowledgePoints.length} knowledge points`);

    // Load catalogs/subjects
    const catalogsFilePath = path.resolve(__dirname, '../../data/catalogs.json');
    const catalogsData: CatalogsData = JSON.parse(fs.readFileSync(catalogsFilePath, 'utf-8'));
    this.subjects = catalogsData.subjects;
    console.log(`   ✅ Loaded ${this.subjects.length} subjects/catalogs`);

    // Build indexes
    this.buildIndexes();
    console.log('   ✅ Indexes built\n');

    this.loaded = true;
  }

  /**
   * Build in-memory indexes for fast queries
   */
  private buildIndexes() {
    // Index knowledge points
    this.knowledgePoints.forEach(kp => {
      // By ID
      this.kpById.set(kp.id, kp);

      // By name
      if (!this.kpByName.has(kp.name)) {
        this.kpByName.set(kp.name, []);
      }
      this.kpByName.get(kp.name)!.push(kp);

      // By subject
      if (!this.kpBySubject.has(kp.subjectId)) {
        this.kpBySubject.set(kp.subjectId, []);
      }
      this.kpBySubject.get(kp.subjectId)!.push(kp);
    });

    // Index subjects
    this.subjects.forEach(subject => {
      // By ID
      this.subjectById.set(subject.id, subject);

      // By name
      if (!this.subjectByName.has(subject.name)) {
        this.subjectByName.set(subject.name, []);
      }
      this.subjectByName.get(subject.name)!.push(subject);
    });
  }

  // ========================================
  // Query Methods - Knowledge Points
  // ========================================

  /**
   * Get all knowledge points
   */
  getAllKnowledgePoints(): KnowledgePoint[] {
    this.load();
    return this.knowledgePoints;
  }

  /**
   * Get knowledge point by ID
   */
  getKnowledgePointById(id: string): KnowledgePoint | undefined {
    this.load();
    return this.kpById.get(id);
  }

  /**
   * Get knowledge points by name (exact match)
   */
  getKnowledgePointsByName(name: string): KnowledgePoint[] {
    this.load();
    return this.kpByName.get(name) || [];
  }

  /**
   * Search knowledge points by keyword (fuzzy)
   */
  searchKnowledgePoints(keyword: string, options?: {
    subjectId?: string;
    gradeLevel?: string;
    limit?: number;
  }): KnowledgePoint[] {
    this.load();

    let results = this.knowledgePoints.filter(kp =>
      kp.name.includes(keyword) || kp.description.includes(keyword)
    );

    // Filter by subject
    if (options?.subjectId) {
      results = results.filter(kp => kp.subjectId === options.subjectId);
    }

    // Filter by grade level
    if (options?.gradeLevel) {
      results = results.filter(kp => kp.gradeLevel === options.gradeLevel);
    }

    // Limit results
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get root knowledge points (parentId is null)
   */
  getRootKnowledgePoints(options?: {
    subjectId?: string;
    gradeLevel?: string;
  }): KnowledgePoint[] {
    this.load();

    let roots = this.knowledgePoints.filter(kp => kp.parentId === null);

    if (options?.subjectId) {
      roots = roots.filter(kp => kp.subjectId === options.subjectId);
    }

    if (options?.gradeLevel) {
      roots = roots.filter(kp => kp.gradeLevel === options.gradeLevel);
    }

    return roots;
  }

  /**
   * Get children of a knowledge point
   */
  getChildrenKnowledgePoints(parentId: string): KnowledgePoint[] {
    this.load();

    const parent = this.kpById.get(parentId);
    if (!parent) {
      return [];
    }

    return parent.children
      .map(childId => this.kpById.get(childId))
      .filter((kp): kp is KnowledgePoint => kp !== undefined);
  }

  /**
   * Get path from root to a knowledge point
   */
  getKnowledgePointPath(id: string): KnowledgePoint[] {
    this.load();

    const path: KnowledgePoint[] = [];
    let current = this.kpById.get(id);

    while (current) {
      path.unshift(current);
      current = current.parentId ? this.kpById.get(current.parentId) : undefined;
    }

    return path;
  }

  /**
   * Get knowledge points by subject ID
   */
  getKnowledgePointsBySubject(subjectId: string): KnowledgePoint[] {
    this.load();
    return this.kpBySubject.get(subjectId) || [];
  }

  // ========================================
  // Query Methods - Subjects/Catalogs
  // ========================================

  /**
   * Get all subjects
   */
  getAllSubjects(): Subject[] {
    this.load();
    return this.subjects;
  }

  /**
   * Get subject by ID
   */
  getSubjectById(id: string): Subject | undefined {
    this.load();
    return this.subjectById.get(id);
  }

  /**
   * Get subjects by name (exact match)
   */
  getSubjectsByName(name: string): Subject[] {
    this.load();
    return this.subjectByName.get(name) || [];
  }

  /**
   * Search subjects by keyword (fuzzy)
   */
  searchSubjects(keyword: string, options?: {
    limit?: number;
  }): Subject[] {
    this.load();

    let results = this.subjects.filter(s =>
      s.name.includes(keyword) || s.description.includes(keyword)
    );

    // Limit results
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get unique subject names (deduplicate)
   */
  getUniqueSubjectNames(): string[] {
    this.load();
    return Array.from(this.subjectByName.keys());
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get knowledge points statistics by level
   */
  getKnowledgePointsStatsByLevel(): Record<number, number> {
    this.load();

    const stats: Record<number, number> = {};
    this.knowledgePoints.forEach(kp => {
      stats[kp.level] = (stats[kp.level] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get knowledge points statistics by subject
   */
  getKnowledgePointsStatsBySubject(): Record<string, number> {
    this.load();

    const stats: Record<string, number> = {};
    this.knowledgePoints.forEach(kp => {
      const subject = this.subjectById.get(kp.subjectId);
      const key = subject?.name || kp.subjectId;
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }
}

// ========================================
// Singleton Instance
// ========================================

export const jsonDataLoader = new JsonDataLoader();

// Auto-load on import (optional, can be removed if prefer lazy loading)
// jsonDataLoader.load();
