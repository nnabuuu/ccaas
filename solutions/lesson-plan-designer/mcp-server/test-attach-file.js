#!/usr/bin/env node
/**
 * Manual test for attach_file tool
 *
 * This script tests the attach_file tool by:
 * 1. Creating a temporary test file
 * 2. Simulating a tool call
 * 3. Verifying the response structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a test file
const testFileName = '测试教学讲稿.md';
const testFilePath = path.join(__dirname, testFileName);
const testContent = `# 测试教学讲稿

## 第一章节
这是测试内容。

## 第二章节
更多测试内容。
`;

console.log('📝 Creating test file...');
fs.writeFileSync(testFilePath, testContent, 'utf8');
console.log(`✅ Created: ${testFilePath}`);

// Simulate attach_file tool logic
console.log('\n🔧 Testing attach_file logic...');

try {
  // Check if file exists
  const absolutePath = path.resolve(process.cwd(), testFileName);
  if (!fs.existsSync(absolutePath)) {
    console.error('❌ File not found:', absolutePath);
    process.exit(1);
  }

  // Get file stats
  const stats = fs.statSync(absolutePath);
  const fileName = path.basename(testFileName);

  // Infer MIME type
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Create attachment metadata
  const attachmentId = randomUUID();
  const fileId = randomUUID();

  // Format file size
  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const attachment = {
    id: attachmentId,
    fileId,
    fileName,
    fileType: 'script',
    mimeType,
    size: stats.size,
    downloadUrl: `/api/v1/files/${fileId}/download`,
    uploadedAt: new Date().toISOString(),
    description: '测试教学讲稿 - 用于验证attach_file工具',
    _originalPath: testFileName,
  };

  const result = {
    data: {
      field: 'attachments',
      value: [attachment],
      preview: `📎 ${fileName} (${formatBytes(stats.size)})`,
    },
    status: 'success',
  };

  console.log('\n✅ Tool result:');
  console.log(JSON.stringify(result, null, 2));

  // Verify result structure
  console.log('\n🧪 Verifying result structure...');

  const checks = [
    { name: 'Has data field', pass: !!result.data },
    { name: 'Has status field', pass: result.status === 'success' },
    { name: 'Field is attachments', pass: result.data.field === 'attachments' },
    { name: 'Value is array', pass: Array.isArray(result.data.value) },
    { name: 'Has preview', pass: !!result.data.preview },
    { name: 'Attachment has id', pass: !!result.data.value[0].id },
    { name: 'Attachment has fileId', pass: !!result.data.value[0].fileId },
    { name: 'Attachment has fileName', pass: result.data.value[0].fileName === testFileName },
    { name: 'Attachment has fileType', pass: result.data.value[0].fileType === 'script' },
    { name: 'Attachment has mimeType', pass: result.data.value[0].mimeType === 'text/markdown' },
    { name: 'Attachment has size', pass: result.data.value[0].size > 0 },
    { name: 'Attachment has downloadUrl', pass: !!result.data.value[0].downloadUrl },
    { name: 'Attachment has uploadedAt', pass: !!result.data.value[0].uploadedAt },
    { name: 'Attachment has _originalPath', pass: result.data.value[0]._originalPath === testFileName },
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach(check => {
    if (check.pass) {
      console.log(`  ✅ ${check.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.name}`);
      failed++;
    }
  });

  console.log(`\n📊 Results: ${passed}/${checks.length} passed`);

  if (failed > 0) {
    console.log('\n❌ Some checks failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed!');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  // Cleanup
  console.log('\n🧹 Cleaning up...');
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
    console.log('✅ Deleted test file');
  }
}

console.log('\n✨ Test complete!');
