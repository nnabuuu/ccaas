import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getDb } from './db.js';
import { SYNC_FIELDS, type WriteOutputInput, type WriteOutputResult } from './types.js';

const server = new Server(
  { name: 'edu-platform', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ───────────────────────────────────────

const curriculumTreeTool: Tool = {
  name: 'curriculum_tree',
  description: '查询课标知识点树。可按学科、年级、父节点过滤。返回嵌套树结构，可用于 TreeSelector 组件。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string',
        description: '学科英文名，如 math, chinese, english, physics, chemistry, biology',
      },
      grade: {
        type: 'string',
        description: '年级，如 7, 8, 9',
      },
      parent_id: {
        type: 'string',
        description: '父节点ID，获取指定节点的子树',
      },
    },
    required: ['subject'],
  },
};

const studentProficiencyTool: Tool = {
  name: 'student_proficiency',
  description: '查询班级学情数据。返回班级整体平均分和各知识点掌握率（含趋势），可用于 MetricDashboard 和 BarList 组件。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      class_id: {
        type: 'string',
        description: '班级ID，如 c-8-2-math',
      },
      subject: {
        type: 'string',
        description: '学科，如 math, physics',
      },
      grade: {
        type: 'string',
        description: '年级，如 7, 8, 9',
      },
    },
    required: ['class_id'],
  },
};

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将教案内容同步到前端显示面板。支持的字段: ${SYNC_FIELDS.join(', ')}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      field: {
        type: 'string',
        description: `要更新的字段名。可选: ${SYNC_FIELDS.join(', ')}`,
        enum: [...SYNC_FIELDS],
      },
      value: {
        description: '字段内容（字符串或 JSON 对象）',
      },
      preview: {
        type: 'string',
        description: '简短预览文本，显示在面板标题旁',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// ─── List Tools Handler ─────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [curriculumTreeTool, writeOutputTool, studentProficiencyTool],
}));

// ─── Call Tool Handler ──────────────────────────────────────

interface CurriculumNode {
  id: string;
  parent_id: string | null;
  name: string;
  level: number;
  subject: string;
  grade_range: string | null;
  sort_order: number;
  cognitive: string | null;
  difficulty_min: number | null;
  difficulty_max: number | null;
  question_types: string | null;
  exam_weight: number | null;
  prerequisites: string | null;
  common_mistakes: string | null;
  exam_patterns: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  level: number;
  cognitive?: string;
  difficulty_min?: number;
  difficulty_max?: number;
  question_types?: string[];
  exam_weight?: number;
  prerequisites?: string;
  common_mistakes?: string;
  exam_patterns?: string;
  children: TreeNode[];
}

function buildTree(nodes: CurriculumNode[], parentId: string | null = null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(n => {
      const treeNode: TreeNode = {
        id: n.id,
        name: n.name,
        level: n.level,
        children: buildTree(nodes, n.id),
      };
      // Add leaf-node metadata
      if (n.cognitive) treeNode.cognitive = n.cognitive;
      if (n.difficulty_min != null) treeNode.difficulty_min = n.difficulty_min;
      if (n.difficulty_max != null) treeNode.difficulty_max = n.difficulty_max;
      if (n.question_types) {
        try { treeNode.question_types = JSON.parse(n.question_types); } catch { /* ignore */ }
      }
      if (n.exam_weight != null) treeNode.exam_weight = n.exam_weight;
      if (n.prerequisites) treeNode.prerequisites = n.prerequisites;
      if (n.common_mistakes) treeNode.common_mistakes = n.common_mistakes;
      if (n.exam_patterns) treeNode.exam_patterns = n.exam_patterns;
      return treeNode;
    });
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── curriculum_tree ──────────────────────────────────────
  if (name === 'curriculum_tree') {
    try {
      const db = getDb();
      const subject = (args as Record<string, string>).subject;
      const grade = (args as Record<string, string>).grade;
      const parentId = (args as Record<string, string>).parent_id;

      let sql = 'SELECT * FROM curriculum_nodes WHERE subject = ?';
      const params: (string | number)[] = [subject];

      if (grade) {
        sql += ' AND (grade_range IS NULL OR grade_range LIKE ?)';
        params.push(`%${grade}%`);
      }

      if (parentId) {
        // Get the subtree under a specific node
        sql += ' AND (id = ? OR parent_id = ? OR parent_id IN (SELECT id FROM curriculum_nodes WHERE parent_id = ?) OR parent_id IN (SELECT id FROM curriculum_nodes WHERE parent_id IN (SELECT id FROM curriculum_nodes WHERE parent_id = ?)))';
        params.push(parentId, parentId, parentId, parentId);
      }

      const rows = db.prepare(sql).all(...params) as CurriculumNode[];
      const tree = parentId ? buildTree(rows, parentId) : buildTree(rows);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: {
              subject,
              grade: grade || 'all',
              total_nodes: rows.length,
              tree,
            },
            status: 'success',
          }),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: { error: `查询知识点树失败: ${message}` },
            status: 'error',
          }),
        }],
        isError: true,
      };
    }
  }

  // ── write_output ─────────────────────────────────────────
  if (name === 'write_output') {
    const input = args as unknown as WriteOutputInput;
    const { field, value, preview } = input;

    if (!(SYNC_FIELDS as ReadonlyArray<string>).includes(field)) {
      const result: WriteOutputResult = {
        data: { error: `无效字段 "${field}"。有效字段: ${SYNC_FIELDS.join(', ')}` },
        status: 'error',
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: true,
      };
    }

    const result: WriteOutputResult = {
      data: { field, value, preview },
      status: 'success',
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }

  // ── student_proficiency ─────────────────────────────────
  if (name === 'student_proficiency') {
    const classId = (args as Record<string, string>).class_id;

    const mockData: Record<string, object> = {
      'c-8-2-math': {
        className: '八(2)班',
        subject: '数学',
        grade: '8',
        overallAvg: 78.5,
        totalStudents: 45,
        passRate: 0.89,
        excellentRate: 0.31,
        topics: [
          { name: '一次函数', mastery: 0.82, trend: 'up' },
          { name: '全等三角形', mastery: 0.75, trend: 'stable' },
          { name: '轴对称', mastery: 0.88, trend: 'up' },
          { name: '整式乘除', mastery: 0.71, trend: 'down' },
          { name: '分式', mastery: 0.65, trend: 'down' },
          { name: '二次根式', mastery: 0.58, trend: 'stable' },
        ],
      },
      'c-8-1-math': {
        className: '八(1)班',
        subject: '数学',
        grade: '8',
        overallAvg: 82.3,
        totalStudents: 43,
        passRate: 0.93,
        excellentRate: 0.38,
        topics: [
          { name: '一次函数', mastery: 0.88, trend: 'up' },
          { name: '全等三角形', mastery: 0.80, trend: 'up' },
          { name: '轴对称', mastery: 0.91, trend: 'stable' },
          { name: '整式乘除', mastery: 0.79, trend: 'stable' },
          { name: '分式', mastery: 0.72, trend: 'up' },
          { name: '二次根式', mastery: 0.64, trend: 'down' },
        ],
      },
    };

    const data = mockData[classId] ?? {
      className: classId,
      subject: 'unknown',
      grade: 'unknown',
      overallAvg: 75.0,
      totalStudents: 40,
      passRate: 0.85,
      excellentRate: 0.25,
      topics: [
        { name: '综合', mastery: 0.75, trend: 'stable' },
      ],
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ data, status: 'success' }),
      }],
    };
  }

  // ── Unknown tool ─────────────────────────────────────────
  return {
    content: [{ type: 'text', text: JSON.stringify({ data: { error: `未知工具: ${name}` }, status: 'error' }) }],
    isError: true,
  };
});

// ─── Start ──────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Edu Platform MCP Server started');
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error);
  process.exit(1);
});
