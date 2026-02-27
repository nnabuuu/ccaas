import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/live-lesson.db');

// HIGH-1: Fail fast with clear message if DB doesn't exist yet
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}.`);
  console.error('Run the MCP server once to create and seed it, or run setup.sh.');
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
db.pragma('journal_mode = WAL');

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5283'];

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));

// GET /api/lessons — lesson list
app.get('/api/lessons', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, title, subject, grade_level as gradeLevel, description, emoji FROM lessons'
  ).all();
  res.json({ lessons: rows });
});

// GET /api/lessons/:id/manifest — full manifest JSON
app.get('/api/lessons/:id/manifest', (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid lesson ID format' });
    return;
  }
  const row = db.prepare('SELECT manifest_json FROM lessons WHERE id = ?').get(id) as { manifest_json: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    res.json(JSON.parse(row.manifest_json));
  } catch {
    res.status(500).json({ error: 'Corrupted lesson data' });
  }
});

const PORT = process.env.PORT ?? 3007;
const server = app.listen(PORT, () => {
  console.log(`Live-lesson backend listening on http://localhost:${PORT}`);
});

// MEDIUM-1: Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
