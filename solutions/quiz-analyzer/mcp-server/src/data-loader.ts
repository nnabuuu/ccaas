import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { KnowledgePointNode } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/quiz-analyzer.db');

export function loadKnowledgePointsTree(): Record<string, KnowledgePointNode[]> {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const rows = db.prepare(`
      SELECT id, subject_id, parent_id, name, code, level, grade_level
      FROM knowledge_points
      ORDER BY level ASC, name ASC
    `).all() as any[];

    // Build tree structure
    const nodeMap = new Map<string, KnowledgePointNode>();
    const rootsBySubject: Record<string, KnowledgePointNode[]> = {};

    // Pass 1: Create node objects
    rows.forEach(row => {
      nodeMap.set(row.id, {
        id: row.id,
        name: row.name,
        code: row.code,
        level: row.level,
        gradeLevel: row.grade_level,
        children: [],
      });
    });

    // Pass 2: Build parent-child relationships
    rows.forEach(row => {
      const node = nodeMap.get(row.id)!;

      if (row.parent_id) {
        const parent = nodeMap.get(row.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        // Root node
        if (!rootsBySubject[row.subject_id]) {
          rootsBySubject[row.subject_id] = [];
        }
        rootsBySubject[row.subject_id].push(node);
      }
    });

    db.close();
    return rootsBySubject;
  } catch (error) {
    console.warn('Failed to load knowledge points tree:', error);
    return {};
  }
}
