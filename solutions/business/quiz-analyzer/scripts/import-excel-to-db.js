import Database from 'better-sqlite3';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESOURCES_DIR = path.join(__dirname, '../resources');
const DB_PATH = path.join(__dirname, '../data/quiz-analyzer.db');

class ExcelImporter {
  constructor(dbPath) {
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  initSchema() {
    // Read and execute schema.sql
    const schemaSql = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );
    this.db.exec(schemaSql);
    console.log('✓ Database schema initialized');
  }

  // Import subjects (from 目录信息.xlsx)
  importSubjects(filePath) {
    console.log('\nImporting subjects...');
    const workbook = xlsx.readFile(filePath);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO subjects (id, name, code, description, grade_levels)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((rows) => {
      rows.forEach(row => {
        const id = row.id || row.科目ID || row.目录ID || uuidv4();
        const name = row.name || row.科目名称 || row.目录名称 || 'Unknown';
        const code = row.code || row.科目代码 || row.目录代码 || null;
        const description = row.description || row.描述 || '';
        const gradeLevels = JSON.stringify(row.grade_levels || row.年级范围 || []);

        insertStmt.run(id, name, code, description, gradeLevels);
      });
    });

    insert(data);
    console.log(`✓ Imported ${data.length} subjects`);
  }

  // TWO-PASS import for hierarchical knowledge points
  importKnowledgePoints(filePath) {
    console.log('\nImporting knowledge points (2-pass)...');
    const workbook = xlsx.readFile(filePath);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    console.log(`  Processing ${data.length} knowledge points...`);

    // First, create subjects from unique 学段+学科 combinations
    const subjectMap = new Map(); // "学段-学科" -> subject_id
    const uniqueSubjects = new Set();

    data.forEach(row => {
      const stage = row.学段 || '';
      const subject = row.学科 || '';
      if (stage && subject) {
        uniqueSubjects.add(`${stage}-${subject}`);
      }
    });

    console.log(`  Creating ${uniqueSubjects.size} subjects from knowledge points...`);
    const subjectInsertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO subjects (id, name, code, description, grade_levels)
      VALUES (?, ?, ?, ?, ?)
    `);

    uniqueSubjects.forEach(key => {
      const [stage, subject] = key.split('-');
      const subjectId = uuidv4();
      subjectMap.set(key, subjectId);
      subjectInsertStmt.run(
        subjectId,
        `${stage}-${subject}`,
        key,
        `${stage}阶段${subject}学科`,
        JSON.stringify([stage])
      );
    });
    console.log(`  ✓ Created ${subjectMap.size} subjects`);

    // PASS 1: Create all knowledge point nodes (parent_id = NULL)
    const nodeMap = new Map(); // originalId -> generatedId
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_points
      (id, subject_id, parent_id, name, code, description, level, grade_level,
       difficulty_contribution, common_problem_types, related_formulas)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertNodes = this.db.transaction((rows) => {
      rows.forEach(row => {
        const id = row.id || row.知识点ID || uuidv4();
        const originalId = row.原始ID || row.id || row.知识点ID || id;
        nodeMap.set(originalId, id);

        // Get subject_id from 学段+学科
        const stage = row.学段 || '';
        const subject = row.学科 || '';
        const subjectKey = `${stage}-${subject}`;
        const subjectId = subjectMap.get(subjectKey) || 'default';

        const name = row.name || row.知识点名称 || row.知识点 || 'Unknown';
        const code = row.code || row.知识点代码 || row.编码 || null;
        const description = row.description || row.描述 || row.说明 || '';
        const level = parseInt(row.level || row.层级 || row.等级 || 0);
        const gradeLevel = row.grade_level || row.年级 || row.学段 || null;
        const difficultyContribution = parseFloat(row.difficulty_contribution || row.难度权重 || 0.5);
        const commonProblemTypes = JSON.stringify(row.common_problem_types || row.常见题型 || []);
        const relatedFormulas = JSON.stringify(row.related_formulas || row.相关公式 || []);

        insertStmt.run(
          id, subjectId, name, code, description, level, gradeLevel,
          difficultyContribution, commonProblemTypes, relatedFormulas
        );
      });
    });

    insertNodes(data);
    console.log(`  ✓ Pass 1: Created ${nodeMap.size} nodes`);

    // PASS 2: Update parent_id relationships
    const updateStmt = this.db.prepare(
      'UPDATE knowledge_points SET parent_id = ? WHERE id = ?'
    );

    const updateParents = this.db.transaction((rows) => {
      let linked = 0;
      rows.forEach(row => {
        const originalId = row.原始ID || row.id || row.知识点ID;
        const id = nodeMap.get(originalId);
        const parentOriginalId = row.parent_id || row.父级ID || row.父知识点ID || row.父ID || row.上级ID || null;

        if (parentOriginalId && nodeMap.has(parentOriginalId)) {
          updateStmt.run(nodeMap.get(parentOriginalId), id);
          linked++;
        }
      });
      return linked;
    });

    const linkedCount = updateParents(data);
    console.log(`  ✓ Pass 2: Linked ${linkedCount} parent-child relationships`);
  }

  // Import quizzes
  importQuizzes(filePath) {
    console.log('\nImporting quizzes...');
    const workbook = xlsx.readFile(filePath);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO quizzes
      (id, tenant_id, content, subject_id, grade_level, quiz_type,
       difficulty, source, correct_answer, answer_options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((rows) => {
      rows.forEach(row => {
        const id = row.id || row.题目ID || row.题号 || uuidv4();
        const content = row.content || row.题目内容 || row.题干 || '';
        const subjectId = row.subject_id || row.科目ID || row.目录ID || 'default';
        const gradeLevel = row.grade_level || row.年级 || row.学段 || null;
        const quizType = row.quiz_type || row.题型 || row.类型 || null;
        const difficulty = row.difficulty || row.难度 || null;
        const source = row.source || row.来源 || row.出处 || '';
        const correctAnswer = row.correct_answer || row.正确答案 || row.答案 || '';
        const answerOptions = JSON.stringify(row.answer_options || row.选项 || []);

        insertStmt.run(
          id, 'default', content, subjectId, gradeLevel, quizType,
          difficulty, source, correctAnswer, answerOptions
        );
      });
    });

    insert(data);
    console.log(`✓ Imported ${data.length} quizzes`);
  }

  // Run full import
  async run() {
    console.log('Starting Excel import...\n');
    console.log('Resources directory:', RESOURCES_DIR);

    try {
      // Check which files exist
      const catalogFile = path.join(RESOURCES_DIR, '目录信息.xlsx');
      const knowledgeFile = path.join(RESOURCES_DIR, '知识点信息.xlsx');
      const quizFile = path.join(RESOURCES_DIR, '题目信息.xlsx');

      if (fs.existsSync(catalogFile)) {
        this.importSubjects(catalogFile);
      } else {
        console.log('⚠ Skipping subjects import (目录信息.xlsx not found)');
      }

      if (fs.existsSync(knowledgeFile)) {
        this.importKnowledgePoints(knowledgeFile);
      } else {
        console.log('⚠ Skipping knowledge points import (知识点信息.xlsx not found)');
      }

      // Skip quiz import for now - needs schema adjustment for catalog_id vs subject_id
      console.log('⚠ Skipping quizzes import (needs schema update for catalog references)');

      console.log('\n✓ Import completed successfully!');
      this.printStats();
    } catch (error) {
      console.error('\n✗ Import failed:', error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  printStats() {
    const stats = {
      subjects: this.db.prepare('SELECT COUNT(*) as count FROM subjects').get().count,
      knowledgePoints: this.db.prepare('SELECT COUNT(*) as count FROM knowledge_points').get().count,
      quizzes: this.db.prepare('SELECT COUNT(*) as count FROM quizzes').get().count,
    };

    console.log('\nDatabase Statistics:');
    console.log(`  Subjects: ${stats.subjects}`);
    console.log(`  Knowledge Points: ${stats.knowledgePoints}`);
    console.log(`  Quizzes: ${stats.quizzes}`);
    console.log(`\nDatabase location: ${DB_PATH}`);
  }
}

// Run import
const importer = new ExcelImporter(DB_PATH);
importer.run().catch(console.error);
