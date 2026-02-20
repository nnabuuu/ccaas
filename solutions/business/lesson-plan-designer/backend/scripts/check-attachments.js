#!/usr/bin/env node
/**
 * Diagnostic script to check attachment data in the database
 * Usage: node scripts/check-attachments.js [fileId]
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/lesson-plans.db');
const UPLOAD_DIR = path.join(__dirname, '../../../.agent-workspace/uploads/attachments');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

// Get specific fileId from command line
const targetFileId = process.argv[2];

console.log('='.repeat(80));
console.log('📊 Attachment Diagnostic Report');
console.log('='.repeat(80));
console.log(`Database: ${DB_PATH}`);
console.log(`Upload Dir: ${UPLOAD_DIR}`);
console.log('');

// Get all lesson plans
const plans = db.prepare('SELECT id, title, attachments FROM lesson_plans').all();

console.log(`📋 Total Lesson Plans: ${plans.length}`);
console.log('');

let totalAttachments = 0;
let foundTarget = false;

plans.forEach((plan, index) => {
  let attachments = [];

  try {
    attachments = plan.attachments ? JSON.parse(plan.attachments) : [];
  } catch (e) {
    console.error(`❌ Failed to parse attachments for plan ${plan.id}: ${e.message}`);
    return;
  }

  if (attachments.length === 0) {
    return; // Skip plans with no attachments
  }

  totalAttachments += attachments.length;

  console.log(`${index + 1}. Lesson Plan: ${plan.id}`);
  console.log(`   Title: ${plan.title}`);
  console.log(`   Attachments: ${attachments.length}`);

  attachments.forEach((att, attIndex) => {
    const isTarget = targetFileId && att.fileId === targetFileId;
    if (isTarget) {
      foundTarget = true;
    }

    const prefix = isTarget ? '   👉' : '     ';
    console.log(`${prefix}[${attIndex + 1}] fileId: ${att.fileId}`);
    console.log(`${prefix}    fileName: ${att.fileName}`);
    console.log(`${prefix}    downloadUrl: ${att.downloadUrl}`);

    // Check if file exists
    const ext = path.extname(att.fileName);
    const filePath = path.join(UPLOAD_DIR, `${att.fileId}${ext}`);
    const exists = fs.existsSync(filePath);

    console.log(`${prefix}    fileExists: ${exists ? '✅ YES' : '❌ NO'}`);
    if (!exists) {
      console.log(`${prefix}    expectedPath: ${filePath}`);
    }
  });

  console.log('');
});

console.log('='.repeat(80));
console.log(`📦 Total Attachments: ${totalAttachments}`);

if (targetFileId) {
  console.log('');
  console.log(`🔍 Searching for fileId: ${targetFileId}`);
  console.log(`   Result: ${foundTarget ? '✅ FOUND' : '❌ NOT FOUND'}`);

  if (!foundTarget) {
    console.log('');
    console.log('💡 Possible reasons:');
    console.log('   1. Lesson plan was not created or deleted');
    console.log('   2. Attachment was never saved to database');
    console.log('   3. fileId mismatch between MCP and backend');
  }
}

console.log('='.repeat(80));

// Check upload directory
console.log('');
console.log('📁 Files in Upload Directory:');

if (!fs.existsSync(UPLOAD_DIR)) {
  console.log(`   ❌ Directory does not exist: ${UPLOAD_DIR}`);
} else {
  const files = fs.readdirSync(UPLOAD_DIR);

  if (files.length === 0) {
    console.log('   (empty)');
  } else {
    files.forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);
      const isTarget = targetFileId && file.startsWith(targetFileId);

      const prefix = isTarget ? '👉' : '  ';
      console.log(`${prefix} ${file} (${stats.size} bytes)`);
    });
  }
}

console.log('='.repeat(80));

db.close();
