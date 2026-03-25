// src/types/curriculum.ts
// 课标知识点树 — 数据结构定义

// ===== 基础枚举 =====

export type Subject =
  | "math" | "chinese" | "english" | "physics"
  | "chemistry" | "biology" | "history" | "geography" | "politics";

export type SchoolStage = "primary" | "junior" | "senior";

/** 年级-学期编码: G7-1 = 七年级上, G8-2 = 八年级下 */
export type GradeSemester = `G${number}-${1 | 2}`;

/** 认知层次 — Bloom's Taxonomy 修订版 */
export type CognitiveLevel =
  | "remember" | "understand" | "apply"
  | "analyze" | "evaluate" | "create";

export type QuestionType =
  | "choice" | "fill" | "true_false" | "short_answer"
  | "proof" | "experiment" | "reading" | "essay" | "drawing";

export type CurriculumEdition = "2022" | "2011" | "2003";

// ===== 节点 ID 规范 =====

/**
 * 层级路径式 ID:
 *   kp:{subject}.{domain}.{topic}.{unit}.{point}
 * 示例:
 *   kp:math.algebra.equation.linear_one.combine_like_terms
 */
export type KnowledgePointId = `kp:${string}`;

// ===== 树节点 =====

interface BaseNode {
  id: string;
  label: string;
  labelEn?: string;
  edition: CurriculumEdition;
  sortOrder: number;
  meta?: {
    createdAt: string;
    updatedAt: string;
    source: "manual" | "import" | "ai";
    reviewStatus: "draft" | "reviewed" | "published";
  };
}

export interface SubjectNode extends BaseNode {
  level: "subject";
  subject: Subject;
  stage: SchoolStage;
  children: DomainNode[];
}

export interface DomainNode extends BaseNode {
  level: "domain";
  parentId: string;
  children: TopicNode[];
}

export interface TopicNode extends BaseNode {
  level: "topic";
  parentId: string;
  gradeRange: GradeSemester[];
  children: UnitNode[];
}

export interface UnitNode extends BaseNode {
  level: "unit";
  parentId: string;
  gradeSemester: GradeSemester;
  textbookRef?: string;
  children: KnowledgePointNode[];
}

/** L4 叶节点 — 出题/备课的原子单位 */
export interface KnowledgePointNode extends BaseNode {
  level: "point";
  id: KnowledgePointId;
  parentId: string;

  cognitive: CognitiveLevel;
  difficultyRange: [number, number];

  questionTypes: QuestionType[];
  examWeight: number;

  prerequisites: KnowledgePointId[];
  successors: KnowledgePointId[];
  crossRefs?: KnowledgePointId[];

  gradeSemesters: GradeSemester[];
  curriculumRequirement?: string;
  examPatterns?: string[];
  commonMistakes?: string[];

  /** 学校级自定义标签 — N个场景的扩展口 */
  schoolTags?: Record<string, string[]>;
}

export type TreeNode = SubjectNode | DomainNode | TopicNode | UnitNode | KnowledgePointNode;

// ===== MCP 查询接口 =====

export interface KnowledgePointQuery {
  subject: Subject;
  gradeSemester?: GradeSemester;
  domainPath?: string;
  cognitive?: CognitiveLevel[];
  difficultyRange?: [number, number];
  questionType?: QuestionType;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface KnowledgePointQueryResult {
  total: number;
  items: KnowledgePointNode[];
  breadcrumbs: Record<KnowledgePointId, string[]>;
}

export interface SubtreeQuery {
  rootId: string;
  depth?: number;
}

// ===== 组卷时的知识点分配 =====

export interface KnowledgePointAllocation {
  pointId: KnowledgePointId;
  count: number;
  targetDifficulty?: number;
  targetQuestionType?: QuestionType;
  /** 学情 MCP 注入: >1 表示需加强 */
  learningGapFactor?: number;
}
