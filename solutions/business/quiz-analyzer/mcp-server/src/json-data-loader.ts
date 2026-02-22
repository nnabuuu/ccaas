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
  subjectId?: string;   // Present in per-subject files
  gradeLevel?: string;  // Present in per-subject files
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

    // Load knowledge points from per-subject files
    const subjectsDir = path.resolve(__dirname, '../../data/subjects');
    const subjectFiles = fs.readdirSync(subjectsDir).filter(f => f.endsWith('.json'));
    this.knowledgePoints = [];
    for (const file of subjectFiles) {
      const data: KnowledgePointsData = JSON.parse(
        fs.readFileSync(path.join(subjectsDir, file), 'utf-8')
      );
      this.knowledgePoints.push(...data.knowledgePoints);
    }
    console.log(`   ✅ Loaded ${this.knowledgePoints.length} knowledge points from ${subjectFiles.length} subject files`);

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

    const scored: Array<{ kp: KnowledgePoint; score: number }> = [];

    for (const kp of this.knowledgePoints) {
      // Filter first (cheap)
      if (options?.subjectId && kp.subjectId !== options.subjectId) continue;
      if (options?.gradeLevel && kp.gradeLevel !== options.gradeLevel) continue;

      // Match type scoring (name only; description is always empty in this dataset)
      const name = kp.name.trim();
      let matchType: number;
      if (name === keyword)              matchType = 3; // exact
      else if (name.startsWith(keyword)) matchType = 2; // name starts with keyword
      else if (name.includes(keyword))   matchType = 1; // substring
      else continue;                                     // no match

      const isLeaf = kp.children.length === 0 ? 1 : 0;
      const score = matchType * 10000 + kp.level * 10 + isLeaf;
      scored.push({ kp, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const results = scored.map(r => r.kp);
    return options?.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Search knowledge points by multiple keywords simultaneously.
   *
   * Returns a deduplicated, ranked list. Each result includes:
   * - matchedKeywords: which of the input keywords hit this KP
   * - matchScore: matchedKeywords.length * 10 + level
   *   (more keyword matches wins; within same count, deeper/more specific nodes rank higher)
   */
  batchSearchKnowledgePoints(
    keywords: string[],
    options?: { subjectId?: string; gradeLevel?: string; limit?: number; leafOnly?: boolean },
  ): Array<KnowledgePoint & { matchedKeywords: string[]; matchScore: number }> {
    this.load();

    // Map from KP id → { kp, matched set }
    const hitMap = new Map<string, { kp: KnowledgePoint; matched: Set<string> }>();

    for (const keyword of keywords) {
      for (const kp of this.knowledgePoints) {
        if (!kp.name.includes(keyword) && !kp.description.includes(keyword)) continue;
        if (options?.subjectId && kp.subjectId !== options.subjectId) continue;
        if (options?.gradeLevel && kp.gradeLevel !== options.gradeLevel) continue;

        const entry = hitMap.get(kp.id);
        if (entry) {
          entry.matched.add(keyword);
        } else {
          hitMap.set(kp.id, { kp, matched: new Set([keyword]) });
        }
      }
    }

    let results = Array.from(hitMap.values()).map(({ kp, matched }) => ({
      ...kp,
      matchedKeywords: Array.from(matched),
      matchScore: matched.size * 10 + kp.level,
    }));

    // Leaf-priority: keep only leaf nodes (children === []) when leafOnly is true.
    // Fall back to all matched nodes if no leaf matched.
    if (options?.leafOnly) {
      const leafResults = results.filter(r => r.children.length === 0);
      if (leafResults.length > 0) {
        results = leafResults;
      }
    }

    // Sort: highest matchScore first
    results.sort((a, b) => b.matchScore - a.matchScore);

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

  /**
   * Search knowledge points by multiple keywords in priority order (Mode C).
   *
   * Keywords are searched sequentially. Results are deduplicated across rounds —
   * a KP only appears in the round where it was first found (seenIds Set).
   */
  searchKnowledgePointsByPriority(
    keywords: string[],
    options?: { leafOnly?: boolean; gradeLevel?: string; limitPerKeyword?: number },
  ): {
    rounds: Array<{
      keyword: string;
      found: number;
      newKPs: Array<{ id: string; name: string; level: number; isLeaf: boolean }>;
      cumulativeCount: number;
    }>;
    allResults: Array<{ id: string; name: string; level: number; isLeaf: boolean }>;
    coveredKeywords: string[];
    uncoveredKeywords: string[];
    coverageScore: number;
  } {
    this.load();

    const { leafOnly = true, gradeLevel, limitPerKeyword = 5 } = options || {};

    const seenIds = new Set<string>();
    const rounds: Array<{
      keyword: string;
      found: number;
      newKPs: Array<{ id: string; name: string; level: number; isLeaf: boolean }>;
      cumulativeCount: number;
    }> = [];
    const coveredKeywords: string[] = [];
    const uncoveredKeywords: string[] = [];
    const allResults: Array<{ id: string; name: string; level: number; isLeaf: boolean }> = [];

    for (const keyword of keywords) {
      let results = this.searchKnowledgePoints(keyword, { gradeLevel, limit: limitPerKeyword * 3 });

      if (leafOnly) {
        const leaves = results.filter(kp => kp.children.length === 0);
        if (leaves.length > 0) results = leaves;
      }
      results = results.slice(0, limitPerKeyword);

      const newKPs = results.filter(kp => !seenIds.has(kp.id));
      const newKPsMapped = newKPs.map(kp => ({
        id: kp.id,
        name: kp.name,
        level: kp.level,
        isLeaf: kp.children.length === 0,
      }));
      newKPs.forEach(kp => seenIds.add(kp.id));
      allResults.push(...newKPsMapped);

      rounds.push({
        keyword,
        found: results.length,
        newKPs: newKPsMapped,
        cumulativeCount: allResults.length,
      });

      if (results.length > 0) coveredKeywords.push(keyword);
      else uncoveredKeywords.push(keyword);
    }

    return {
      rounds,
      allResults,
      coveredKeywords,
      uncoveredKeywords,
      coverageScore: keywords.length > 0 ? coveredKeywords.length / keywords.length : 0,
    };
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
