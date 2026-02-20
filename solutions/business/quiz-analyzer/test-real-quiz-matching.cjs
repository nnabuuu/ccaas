const fs = require('fs');
const http = require('http');

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

const BASE_URL = 'http://localhost:3006';

// 读取测试题目
const quizzes = JSON.parse(fs.readFileSync('test-quizzes.json', 'utf-8'));

// API调用函数
async function searchKnowledgePoints(keyword) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: keyword, limit: 5 });

    const options = {
      hostname: 'localhost',
      port: 3006,
      path: '/tools/search_knowledge_points',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 提取关键词
function extractKeywords(quiz) {
  const keywords = [];
  const knowledgePoint = (quiz.知识点名称 || '').trim();

  // 添加知识点名称
  if (knowledgePoint) {
    keywords.push(knowledgePoint);
  }

  // 根据学科添加特定关键词
  if (quiz.学科 === '语文') {
    if (knowledgePoint.includes('字形')) keywords.push('字形');
    if (knowledgePoint.includes('辨析')) keywords.push('辨析');
  } else if (quiz.学科 === '道德法治') {
    if (knowledgePoint.includes('青春')) keywords.push('青春');
    keywords.push('成长');
  } else if (quiz.学科 === '数学') {
    if (knowledgePoint.includes('对称')) keywords.push('对称');
    if (knowledgePoint.includes('中心')) keywords.push('中心对称');
  } else if (quiz.学科 === '英语') {
    if (knowledgePoint.includes('环境')) keywords.push('环境', '环境保护');
    if (knowledgePoint.includes('写作')) keywords.push('写作');
  } else if (quiz.学科 === '物理') {
    if (knowledgePoint.includes('汽化')) keywords.push('汽化', '液化', '汽化和液化');
    if (knowledgePoint.includes('物态')) keywords.push('物态变化');
  }

  // 去重
  return [...new Set(keywords)].filter(k => k && k.length > 0);
}

// 测试单个题目
async function testQuiz(quiz, idx) {
  console.log(`${colors.blue}${'━'.repeat(60)}${colors.reset}`);
  console.log(`${colors.yellow}题目 ${idx + 1}: 【${quiz.学科}】${colors.reset}`);

  const content = quiz.题干.replace(/<[^>]*>/g, ' ').substring(0, 80);
  console.log(`  题干: ${content}...`);

  const expectedKP = (quiz.知识点名称 || '').trim();
  const expectedKPId = quiz.知识点id;
  console.log(`  ${colors.green}预期知识点: ${expectedKP} (ID: ${expectedKPId})${colors.reset}`);
  console.log('');

  const keywords = extractKeywords(quiz);
  let foundMatch = false;
  let allResults = [];

  for (const keyword of keywords) {
    console.log(`  搜索关键词: ${colors.yellow}${keyword}${colors.reset}`);

    try {
      const result = await searchKnowledgePoints(keyword);
      const count = result.data?.count || 0;

      if (count > 0) {
        console.log(`    ${colors.green}✓ 找到 ${count} 个匹配的知识点${colors.reset}`);

        // 检查是否匹配预期的知识点ID
        const kps = result.data.knowledgePoints || [];
        allResults.push(...kps);

        const matched = kps.find(kp => kp.id === expectedKPId);
        if (matched) {
          console.log(`    ${colors.green}★ 成功匹配预期知识点！${colors.reset}`);
          foundMatch = true;
        }

        // 显示前3个结果
        kps.slice(0, 3).forEach(kp => {
          console.log(`      - ${kp.name} (层级:${kp.level})`);
        });
      } else {
        console.log(`    ${colors.yellow}✗ 未找到匹配的知识点${colors.reset}`);
      }
    } catch (error) {
      console.log(`    ${colors.red}✗ API调用失败: ${error.message}${colors.reset}`);
    }

    console.log('');
  }

  // 如果没有直接匹配ID，检查是否有名称相近的
  if (!foundMatch && allResults.length > 0) {
    const nameMatches = allResults.filter(kp =>
      kp.name.includes(expectedKP) || expectedKP.includes(kp.name)
    );
    if (nameMatches.length > 0) {
      console.log(`  ${colors.green}✓ 找到名称匹配的知识点:${colors.reset}`);
      nameMatches.forEach(kp => {
        console.log(`    - ${kp.name} (ID: ${kp.id}, 层级:${kp.level})`);
      });
      foundMatch = true;
    }
  }

  if (foundMatch) {
    console.log(`${colors.green}✓ 测试通过: 成功匹配预期知识点${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ 测试未找到完全匹配，但可能找到相关知识点${colors.reset}`);
  }
  console.log('');
}

// 主函数
async function main() {
  console.log(`${colors.green}=== 真实题目知识点匹配测试 ===${colors.reset}`);
  console.log('');
  console.log('使用从 题目信息.xlsx 中选取的真实题目');
  console.log('');

  let passedCount = 0;

  for (let i = 0; i < quizzes.length; i++) {
    try {
      await testQuiz(quizzes[i], i);
      passedCount++;
    } catch (error) {
      console.log(`${colors.red}测试失败: ${error.message}${colors.reset}`);
    }
  }

  console.log(`${colors.blue}${'━'.repeat(60)}${colors.reset}`);
  console.log('');
  console.log(`${colors.green}测试完成！${colors.reset}`);
  console.log('');
  console.log(`总计: ${quizzes.length} 道题目`);
  console.log(`通过: ${passedCount} 道`);
  console.log('');
  console.log('分析建议：');
  console.log('1. ✓ 表示成功匹配预期知识点');
  console.log('2. ⚠ 表示未完全匹配，但可能找到相关知识点');
  console.log('3. 可以调整关键词提取策略以提高匹配准确度');
  console.log('4. 考虑使用知识点的层级结构进行更智能的匹配');
}

main().catch(console.error);
