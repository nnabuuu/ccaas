#!/usr/bin/env node

/**
 * Export database to JSON files for MCP data source
 *
 * This script reads knowledge_points and subjects tables from SQLite
 * and exports them as structured JSON files for MCP tools to consume.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../data/quiz-analyzer.db');
const OUTPUT_DIR = path.join(__dirname, '../data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Connect to database
const db = new Database(DB_PATH, { readonly: true });

console.log('📊 Exporting database to JSON files...\n');

// ========================================
// Export Knowledge Points
// ========================================
console.log('1️⃣  Exporting knowledge points...');

const knowledgePointsQuery = db.prepare(`
  SELECT
    id,
    subject_id as subjectId,
    parent_id as parentId,
    name,
    code,
    description,
    level,
    grade_level as gradeLevel,
    difficulty_contribution as difficultyContribution,
    common_problem_types as commonProblemTypes,
    related_formulas as relatedFormulas,
    created_at as createdAt
  FROM knowledge_points
  ORDER BY level, id
`);

const knowledgePointsRaw = knowledgePointsQuery.all();

// Parse JSON fields
const knowledgePoints = knowledgePointsRaw.map(kp => ({
  ...kp,
  commonProblemTypes: kp.commonProblemTypes ? JSON.parse(kp.commonProblemTypes) : [],
  relatedFormulas: kp.relatedFormulas ? JSON.parse(kp.relatedFormulas) : [],
}));

// Build children map for faster tree construction
const childrenMap = new Map();
knowledgePoints.forEach(kp => {
  if (kp.parentId) {
    if (!childrenMap.has(kp.parentId)) {
      childrenMap.set(kp.parentId, []);
    }
    childrenMap.get(kp.parentId).push(kp.id);
  }
});

// Add children array to each knowledge point
const knowledgePointsWithChildren = knowledgePoints.map(kp => ({
  ...kp,
  children: childrenMap.get(kp.id) || [],
}));

const knowledgePointsOutput = {
  version: "1.0",
  lastUpdated: new Date().toISOString().split('T')[0],
  totalCount: knowledgePoints.length,
  knowledgePoints: knowledgePointsWithChildren,
};

const kpFilePath = path.join(OUTPUT_DIR, 'knowledge-points.json');
fs.writeFileSync(kpFilePath, JSON.stringify(knowledgePointsOutput, null, 2));

console.log(`   ✅ Exported ${knowledgePoints.length} knowledge points to ${kpFilePath}`);

// ========================================
// Export Subjects/Catalogs
// ========================================
console.log('\n2️⃣  Exporting subjects/catalogs...');

const subjectsQuery = db.prepare(`
  SELECT
    id,
    name,
    code,
    description,
    grade_levels as gradeLevels,
    has_formula as hasFormula,
    created_at as createdAt
  FROM subjects
  ORDER BY name
`);

const subjectsRaw = subjectsQuery.all();

// Parse JSON fields
const subjects = subjectsRaw.map(s => ({
  ...s,
  gradeLevels: s.gradeLevels ? JSON.parse(s.gradeLevels) : [],
  hasFormula: Boolean(s.hasFormula),
}));

const catalogsOutput = {
  version: "1.0",
  lastUpdated: new Date().toISOString().split('T')[0],
  totalCount: subjects.length,
  subjects: subjects,
};

const catalogsFilePath = path.join(OUTPUT_DIR, 'catalogs.json');
fs.writeFileSync(catalogsFilePath, JSON.stringify(catalogsOutput, null, 2));

console.log(`   ✅ Exported ${subjects.length} subjects to ${catalogsFilePath}`);

// ========================================
// Statistics
// ========================================
console.log('\n📈 Statistics:');
console.log(`   - Total knowledge points: ${knowledgePoints.length}`);
console.log(`   - Root knowledge points: ${knowledgePoints.filter(kp => !kp.parentId).length}`);
console.log(`   - Total subjects: ${subjects.length}`);

// Knowledge points by level
const byLevel = {};
knowledgePoints.forEach(kp => {
  byLevel[kp.level] = (byLevel[kp.level] || 0) + 1;
});
console.log(`   - Knowledge points by level:`, byLevel);

// Close database
db.close();

console.log('\n✨ Export completed successfully!\n');
