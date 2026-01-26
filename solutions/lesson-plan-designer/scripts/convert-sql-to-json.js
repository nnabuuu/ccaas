#!/usr/bin/env node
/**
 * Convert SQL seed data to JSON files for textbook chapters
 *
 * This script reads the SQL seed file and generates:
 * - data/textbooks/_index.json
 * - data/textbooks/chapters/*.json
 */

const fs = require('fs');
const path = require('path');

const sqlFilePath = path.join(__dirname, '../reference/sql/V2025_12_22_003__seed_textbook_data.sql');
const outputDir = path.join(__dirname, '../data/textbooks');
const chaptersDir = path.join(outputDir, 'chapters');

// Ensure directories exist
if (!fs.existsSync(chaptersDir)) {
  fs.mkdirSync(chaptersDir, { recursive: true });
}

// Read SQL file
const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

// Parse editions from SQL
// Format: (id, subject, publisher, version, stage, grade, volume, status, tenant_id)
const editionRegex = /\((\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*\d+,\s*'[^']+'\)/g;
const editions = [];
let match;

// Extract edition inserts section
const editionSection = sqlContent.match(/INSERT INTO normal_textbook_edition[^;]+;/s);
if (editionSection) {
  while ((match = editionRegex.exec(editionSection[0])) !== null) {
    editions.push({
      id: parseInt(match[1]),
      subject: match[2],
      publisher: match[3],
      version: match[4],
      stage: match[5],
      grade: parseInt(match[6]),
      volume: match[7],
    });
  }
}

console.log(`Found ${editions.length} editions`);

// Parse chapters from SQL
// Format: (id, textbook_edition_id, parent_id, chapter_code, title, sort_order, status, tenant_id)
const chapterRegex = /\((\d+),\s*(\d+),\s*(NULL|\d+),\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*\d+,\s*'[^']+'\)/g;
const chapters = [];

// Extract all chapter inserts
const chapterMatches = sqlContent.matchAll(/INSERT INTO normal_textbook_chapter[^;]+;/gs);
for (const chapterSection of chapterMatches) {
  while ((match = chapterRegex.exec(chapterSection[0])) !== null) {
    chapters.push({
      id: parseInt(match[1]),
      textbookEditionId: parseInt(match[2]),
      parentId: match[3] === 'NULL' ? null : parseInt(match[3]),
      chapterCode: match[4],
      title: match[5],
      sortOrder: parseInt(match[6]),
    });
  }
}

console.log(`Found ${chapters.length} chapters`);

// Group chapters by edition
const chaptersByEdition = {};
for (const chapter of chapters) {
  if (!chaptersByEdition[chapter.textbookEditionId]) {
    chaptersByEdition[chapter.textbookEditionId] = [];
  }
  chaptersByEdition[chapter.textbookEditionId].push(chapter);
}

// Build chapter tree for an edition
function buildChapterTree(editionChapters) {
  // Sort by sort order
  editionChapters.sort((a, b) => a.sortOrder - b.sortOrder);

  // Create lookup map
  const chapterMap = new Map();
  for (const ch of editionChapters) {
    chapterMap.set(ch.id, { id: ch.id, title: ch.title, children: [] });
  }

  // Build tree
  const roots = [];
  for (const ch of editionChapters) {
    const node = chapterMap.get(ch.id);
    if (ch.parentId === null) {
      roots.push(node);
    } else {
      const parent = chapterMap.get(ch.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  // Remove empty children arrays
  function cleanTree(nodes) {
    for (const node of nodes) {
      if (node.children.length === 0) {
        delete node.children;
      } else {
        cleanTree(node.children);
      }
    }
    return nodes;
  }

  return cleanTree(roots);
}

// Generate JSON files for each edition
const indexEditions = [];

for (const edition of editions) {
  const editionChapters = chaptersByEdition[edition.id] || [];
  const chapterTree = buildChapterTree(editionChapters);

  const fileName = `${edition.subject}-${edition.grade}-${edition.volume}.json`;
  const filePath = path.join(chaptersDir, fileName);

  const fileContent = {
    subject: edition.subject,
    grade: edition.grade,
    volume: edition.volume,
    chapters: chapterTree,
  };

  fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf-8');
  console.log(`Generated: ${fileName} (${chapterTree.length} top-level chapters)`);

  indexEditions.push({
    subject: edition.subject,
    grade: edition.grade,
    volume: edition.volume,
    file: fileName,
  });
}

// Generate index file
const subjects = [...new Set(editions.map(e => e.subject))];

const indexContent = {
  _meta: {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: 'V2025_12_22_003__seed_textbook_data.sql',
  },
  subjects: subjects,
  editions: indexEditions,
};

fs.writeFileSync(
  path.join(outputDir, '_index.json'),
  JSON.stringify(indexContent, null, 2),
  'utf-8'
);

console.log(`\nGenerated _index.json with ${subjects.length} subjects and ${indexEditions.length} editions`);
