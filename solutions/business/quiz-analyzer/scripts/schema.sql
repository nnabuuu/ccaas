-- Quiz Analyzer Database Schema
-- SQLite database for educational quiz analysis system

-- Subjects (from 目录信息.xlsx or inferred)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  grade_levels TEXT, -- JSON array: ["1","2","3"...]
  has_formula INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Hierarchical knowledge points (from 知识点信息.xlsx)
-- Self-referencing tree structure
CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  parent_id TEXT, -- NULL for root nodes
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  level INTEGER DEFAULT 0, -- Tree depth: 0=root, 1=chapter, 2=section
  grade_level TEXT,
  difficulty_contribution REAL DEFAULT 0.5, -- Weight for difficulty calculation
  common_problem_types TEXT, -- JSON array
  related_formulas TEXT, -- JSON array
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kp_subject ON knowledge_points(subject_id);
CREATE INDEX IF NOT EXISTS idx_kp_parent ON knowledge_points(parent_id);
CREATE INDEX IF NOT EXISTS idx_kp_grade ON knowledge_points(grade_level);
CREATE INDEX IF NOT EXISTS idx_kp_level ON knowledge_points(level);

-- Quizzes/Problems (from 题目信息.xlsx)
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  content TEXT NOT NULL,
  content_html TEXT, -- Optional HTML rendering
  image_urls TEXT, -- JSON array
  subject_id TEXT NOT NULL,
  grade_level TEXT,
  quiz_type TEXT, -- "选择题", "填空题", "解答题", "证明题"
  difficulty INTEGER, -- 1-5
  source TEXT, -- Book, exam, etc.
  chapter_reference TEXT,
  correct_answer TEXT,
  answer_options TEXT, -- JSON array for multiple choice
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_grade ON quizzes(grade_level);
CREATE INDEX IF NOT EXISTS idx_quizzes_type ON quizzes(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quizzes_difficulty ON quizzes(difficulty);
CREATE INDEX IF NOT EXISTS idx_quizzes_tenant ON quizzes(tenant_id);

-- Many-to-many: Quiz <-> Knowledge Point
CREATE TABLE IF NOT EXISTS quiz_knowledge_links (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  confidence_score REAL DEFAULT 1.0, -- AI confidence 0.0-1.0
  link_type TEXT DEFAULT 'manual', -- 'manual', 'ai-generated', 'ai-verified'
  source TEXT DEFAULT 'question', -- 'question', 'solution', 'both' - where this knowledge point is identified from
  note TEXT, -- Optional explanation when using parent node (fallback strategy)
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT, -- 'system', 'ai', or user_id
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE,
  UNIQUE(quiz_id, knowledge_point_id)
);

CREATE INDEX IF NOT EXISTS idx_qkl_quiz ON quiz_knowledge_links(quiz_id);
CREATE INDEX IF NOT EXISTS idx_qkl_kp ON quiz_knowledge_links(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_qkl_confidence ON quiz_knowledge_links(confidence_score);

-- AI Analysis Results (stores SYNC_FIELDS)
CREATE TABLE IF NOT EXISTS quiz_analyses (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL UNIQUE,
  thinking_process TEXT, -- 思路 (Markdown)
  solution_steps TEXT, -- JSON array of SolutionStep
  common_mistakes TEXT, -- JSON array of Mistake
  knowledge_gap_analysis TEXT, -- Markdown analysis
  difficulty_rationale TEXT,
  time_estimate TEXT,
  analyzed_at TEXT DEFAULT (datetime('now')),
  analyzer_version TEXT DEFAULT '1.0',
  analysis_duration_ms INTEGER,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qa_quiz ON quiz_analyses(quiz_id);
CREATE INDEX IF NOT EXISTS idx_qa_analyzed_at ON quiz_analyses(analyzed_at);

-- Solution Steps (detailed breakdown)
CREATE TABLE IF NOT EXISTS solution_steps (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  formula TEXT,
  reasoning TEXT,
  common_errors TEXT, -- JSON array
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE(quiz_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_ss_quiz ON solution_steps(quiz_id);
CREATE INDEX IF NOT EXISTS idx_ss_step ON solution_steps(step_number);

-- Batch Processing Jobs
CREATE TABLE IF NOT EXISTS batch_analysis_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending/running/completed/failed/cancelled
  quiz_ids TEXT NOT NULL, -- JSON array
  total_count INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  estimated_completion TEXT, -- ISO timestamp
  error_message TEXT,
  results TEXT, -- JSON array of {quizId, status, error}
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_tenant ON batch_analysis_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_created ON batch_analysis_jobs(created_at DESC);
