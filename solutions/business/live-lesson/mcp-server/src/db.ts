import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { LessonManifest, BoardState, BeatState, ChalkboardAction, GlobalBoardOp } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/live-lesson.db');

export interface LessonListItem {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  emoji: string;
}

export interface SavedState {
  sessionId: string;
  lessonId: string;
  boardState: BoardState | null;
  beatState: BeatState | null;
  dynamicActions: ChalkboardAction[];
  lastDynamicBeatId: string | null;
  globalOps: GlobalBoardOp[];
}

export function initDb(): Database.Database {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      subject        TEXT NOT NULL,
      grade_level    TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      emoji          TEXT NOT NULL DEFAULT '',
      teaching_notes TEXT,
      manifest_json  TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_state (
      session_id           TEXT PRIMARY KEY,
      lesson_id            TEXT NOT NULL REFERENCES lessons(id),
      board_state_json     TEXT,
      beat_state_json      TEXT,
      dynamic_actions_json TEXT,
      last_dynamic_beat_id TEXT,
      global_ops_json      TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

/**
 * Seed lessons from manifest files in data/lessons/.
 * Uses INSERT OR REPLACE so updated manifests are picked up on restart.
 */
export function seedFromManifestFiles(db: Database.Database): void {
  const lessonsDir = path.resolve(__dirname, '../../data/lessons');
  if (!fs.existsSync(lessonsDir)) return;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO lessons (id, title, subject, grade_level, description, emoji, teaching_notes, manifest_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const dirs = fs.readdirSync(lessonsDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const manifestPath = path.join(lessonsDir, dir.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as LessonManifest;

      upsert.run(
        manifest.id,
        manifest.title,
        manifest.subject,
        manifest.gradeLevel,
        manifest.description ?? '',
        '📖',
        manifest.teachingNotes ?? null,
        raw,
      );
    } catch {
      // skip invalid manifests
    }
  }
}

export function loadLessonManifest(db: Database.Database, id: string): LessonManifest {
  const row = db.prepare('SELECT manifest_json FROM lessons WHERE id = ?').get(id) as { manifest_json: string } | undefined;
  if (!row) throw new Error(`Lesson not found in database: ${id}`);
  try {
    return JSON.parse(row.manifest_json) as LessonManifest;
  } catch {
    throw new Error(`Corrupted manifest data for lesson: ${id}`);
  }
}

export function listLessons(db: Database.Database): LessonListItem[] {
  return db.prepare(
    'SELECT id, title, subject, grade_level as gradeLevel, description, emoji FROM lessons'
  ).all() as LessonListItem[];
}

export function saveSessionState(db: Database.Database, sessionId: string, state: SavedState): void {
  db.prepare(`
    INSERT OR REPLACE INTO session_state
      (session_id, lesson_id, board_state_json, beat_state_json, dynamic_actions_json, last_dynamic_beat_id, global_ops_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    sessionId,
    state.lessonId,
    state.boardState ? JSON.stringify(state.boardState) : null,
    state.beatState ? JSON.stringify(state.beatState) : null,
    JSON.stringify(state.dynamicActions),
    state.lastDynamicBeatId,
    JSON.stringify(state.globalOps),
  );
}

export function loadSessionState(db: Database.Database, sessionId: string): SavedState | null {
  const row = db.prepare('SELECT * FROM session_state WHERE session_id = ?').get(sessionId) as {
    session_id: string;
    lesson_id: string;
    board_state_json: string | null;
    beat_state_json: string | null;
    dynamic_actions_json: string | null;
    last_dynamic_beat_id: string | null;
    global_ops_json: string | null;
  } | undefined;

  if (!row) return null;

  function safeParse<T>(json: string | null, fallback: T): T {
    if (!json) return fallback;
    try {
      return JSON.parse(json) as T;
    } catch {
      console.error(`[db] Failed to parse session state JSON, using fallback`);
      return fallback;
    }
  }

  return {
    sessionId: row.session_id,
    lessonId: row.lesson_id,
    boardState: safeParse<BoardState | null>(row.board_state_json, null),
    beatState: safeParse<BeatState | null>(row.beat_state_json, null),
    dynamicActions: safeParse<ChalkboardAction[]>(row.dynamic_actions_json, []),
    lastDynamicBeatId: row.last_dynamic_beat_id,
    globalOps: safeParse<GlobalBoardOp[]>(row.global_ops_json, []),
  };
}
