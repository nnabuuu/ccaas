const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filepath = path.join(__dirname, '../resources/题目信息.xlsx');
const workbook = xlsx.readFile(filepath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Get unique subjects
const subjects = [...new Set(data.map(r => r.学科))];
console.log('可用学科:', subjects.join(', '));
console.log('');

// Select one quiz from each of 5 different subjects
const selectedQuizzes = [];
subjects.slice(0, 5).forEach(subject => {
  const quiz = data.find(r => r.学科 === subject && r.题干 && r.题干.length > 10);
  if (quiz) {
    selectedQuizzes.push(quiz);
  }
});

console.log(`选中 ${selectedQuizzes.length} 道题目进行测试:\n`);
selectedQuizzes.forEach((quiz, idx) => {
  console.log(`题目 ${idx + 1}: 【${quiz.学科}】`);
  console.log(`  题干: ${quiz.题干.substring(0, 80)}${quiz.题干.length > 80 ? '...' : ''}`);
  console.log(`  知识点: ${quiz.知识点名称?.trim() || '未标注'}`);
  console.log(`  知识点ID: ${quiz.知识点id || '无'}`);
  console.log('');
});

// Save to JSON for test script
fs.writeFileSync(
  path.join(__dirname, '../test-quizzes.json'),
  JSON.stringify(selectedQuizzes, null, 2)
);
console.log('已保存到 ../test-quizzes.json');
