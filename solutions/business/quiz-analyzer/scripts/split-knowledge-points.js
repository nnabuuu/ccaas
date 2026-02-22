import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
const subjectsDir = path.join(dataDir, 'subjects');

// 读取原文件
const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'knowledge-points.json'), 'utf-8'));

// Step 1: 修复 gradeLevel
let fixedCount = 0;
for (const kp of raw.knowledgePoints) {
  if (kp.gradeLevel === '语文') {
    kp.gradeLevel = '高中';
    fixedCount++;
  }
}
console.log(`✅ Fixed ${fixedCount} records: gradeLevel "语文" → "高中"`);

// Step 2: 按 subjectId 分组
const groups = new Map();
for (const kp of raw.knowledgePoints) {
  if (!groups.has(kp.subjectId)) groups.set(kp.subjectId, []);
  groups.get(kp.subjectId).push(kp);
}
console.log(`📦 Found ${groups.size} subjects`);

// Step 3: 写出各学科文件
fs.mkdirSync(subjectsDir, { recursive: true });
for (const [subjectId, kps] of groups) {
  const gradeLevel = kps[0].gradeLevel;
  const file = {
    version: '1.0',
    lastUpdated: new Date().toISOString().slice(0, 10),
    subjectId,
    gradeLevel,
    totalCount: kps.length,
    knowledgePoints: kps,
  };
  fs.writeFileSync(
    path.join(subjectsDir, `${subjectId}.json`),
    JSON.stringify(file),
    'utf-8'
  );
  console.log(`   📄 ${subjectId}.json — ${kps.length} KPs (${gradeLevel})`);
}
console.log('✅ All subject files written');
