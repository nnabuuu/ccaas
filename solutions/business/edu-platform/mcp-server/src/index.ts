import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb } from './db.js';
import { SYNC_FIELDS, type WriteOutputInput, type WriteOutputResult } from './types.js';

const server = new Server(
  { name: 'edu-platform', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ───────────────────────────────────────

const curriculumTreeTool: Tool = {
  name: 'curriculum_tree',
  description: '查询课标知识点树。可按学科、年级、父节点过滤。返回嵌套树结构，可用于 show_info_card 的 outline section。',
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
  description: '查询班级学情数据。返回班级整体平均分和各知识点掌握率（含趋势），可用于 show_info_card 的 metrics 和 bar_list section。',
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

const teachingProgressTool: Tool = {
  name: 'teaching_progress',
  description: '查询班级教学进度。返回当前章节、当前小节、下一小节、章节大纲和进度百分比。',
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
    },
    required: ['class_id'],
  },
};

const generateDocxTool: Tool = {
  name: 'generate_docx',
  description: '将教案内容生成 .docx 文件并注册到文件服务。返回文件下载信息。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: '文档标题',
      },
      content_markdown: {
        type: 'string',
        description: '教案内容（Markdown 格式）',
      },
      session_id: {
        type: 'string',
        description: '会话ID（由环境变量 AGENT_SESSION_ID 提供）',
      },
      tenant_id: {
        type: 'string',
        description: '租户ID（由环境变量 AGENT_CLIENT_ID 提供）',
      },
    },
    required: ['title', 'content_markdown'],
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

// ─── Widget Passthrough Tools ─────────────────────────────

const showInfoCardTool: Tool = {
  name: 'show_info_card',
  description: 'Display an info card with composed sections. USE when presenting structured data (outlines, charts, metrics, action buttons). SKIP for simple text responses.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: '卡片标题' },
      badge: { type: 'string', description: '可选的标签文本' },
      sections: {
        type: 'array',
        description: '卡片内容区块列表',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['outline', 'bar_list', 'metrics', 'actions', 'text'],
              description: '区块类型: outline=大纲, bar_list=进度条列表, metrics=指标面板, actions=操作按钮, text=纯文本',
            },
          },
          required: ['type'],
        },
      },
    },
    required: ['title', 'sections'],
  },
};

const showStepWizardTool: Tool = {
  name: 'show_step_wizard',
  description: 'Display a multi-step interactive wizard. Use for lesson planning workflows.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: '向导标题' },
      submit_action: { type: 'string', description: '提交时触发的 action 名称' },
      submit_label: { type: 'string', description: '提交按钮文字' },
      steps: { type: 'array', items: { type: 'string' }, description: '步骤名称列表' },
      fields: { type: 'array', description: '表单字段（第一步）' },
      tree: { type: 'array', description: '树选择项（第二步）' },
      gaps: { type: 'array', description: '学情数据（第三步）' },
      summary_rows: { type: 'array', description: '摘要行（第四步）' },
    },
    required: ['title', 'submit_action', 'steps'],
  },
};

const showReviewPanelTool: Tool = {
  name: 'show_review_panel',
  description: 'Display a review panel for reviewing items (questions, content). Use for quiz review.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: '面板标题' },
      items: { type: 'array', description: '待审查的项目列表' },
      submit_action: { type: 'string', description: '确认提交时触发的 action 名称' },
    },
    required: ['title', 'items', 'submit_action'],
  },
};

const suggestActionsTool: Tool = {
  name: 'suggest_actions',
  description: 'Suggest follow-up actions as clickable buttons. Always call AFTER presenting information, not before.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      actions: {
        type: 'array',
        description: '操作按钮列表',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '按钮文字' },
            prompt: { type: 'string', description: '点击后发送的消息' },
            skill_hint: { type: 'string', description: '可选的技能提示' },
          },
          required: ['label', 'prompt'],
        },
      },
    },
    required: ['actions'],
  },
};

// ─── List Tools Handler ─────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [curriculumTreeTool, writeOutputTool, studentProficiencyTool, teachingProgressTool, generateDocxTool, showInfoCardTool, showReviewPanelTool, suggestActionsTool],
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

  // ── teaching_progress ──────────────────────────────────
  if (name === 'teaching_progress') {
    const classId = (args as Record<string, string>).class_id;

    const mockProgress: Record<string, object> = {
      'c-8-2-math': {
        current_chapter: { id: 'ch12', name: '第12章 全等三角形' },
        current_section: { id: 'ch12-1', name: '12.1 全等三角形' },
        next_section: { id: 'ch12-2', name: '12.2 三角形全等的判定' },
        chapter_outline: [
          {
            id: 'ch12', label: '第12章 全等三角形', children: [
              { id: 'ch12-1', label: '12.1 全等三角形' },
              { id: 'ch12-2', label: '12.2 三角形全等的判定' },
              { id: 'ch12-3', label: '12.3 角的平分线的性质' },
            ],
          },
        ],
        progress_pct: 33,
      },
      'c-8-1-math': {
        current_chapter: { id: 'ch12', name: '第12章 全等三角形' },
        current_section: { id: 'ch12-2', name: '12.2 三角形全等的判定' },
        next_section: { id: 'ch12-3', name: '12.3 角的平分线的性质' },
        chapter_outline: [
          {
            id: 'ch12', label: '第12章 全等三角形', children: [
              { id: 'ch12-1', label: '12.1 全等三角形' },
              { id: 'ch12-2', label: '12.2 三角形全等的判定' },
              { id: 'ch12-3', label: '12.3 角的平分线的性质' },
            ],
          },
        ],
        progress_pct: 67,
      },
    };

    const data = mockProgress[classId] ?? {
      current_chapter: { id: 'ch1', name: '第1章' },
      current_section: { id: 'ch1-1', name: '1.1' },
      next_section: { id: 'ch1-2', name: '1.2' },
      chapter_outline: [{ id: 'ch1', label: '第1章', children: [{ id: 'ch1-1', label: '1.1' }, { id: 'ch1-2', label: '1.2' }] }],
      progress_pct: 0,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ data, status: 'success' }),
      }],
    };
  }

  // ── generate_docx ─────────────────────────────────────
  if (name === 'generate_docx') {
    try {
      const { title, content_markdown } = args as Record<string, string>;
      const sessionId = (args as Record<string, string>).session_id || process.env.AGENT_SESSION_ID || 'default';
      const tenantId = (args as Record<string, string>).tenant_id || process.env.AGENT_CLIENT_ID || 'default';
      const ccaasUrl = process.env.CCAAS_URL || 'http://localhost:3001';

      // Convert markdown lines to docx paragraphs
      const lines = (content_markdown || '').split('\n');
      const paragraphs: Paragraph[] = [];
      for (const line of lines) {
        if (line.startsWith('# ')) {
          paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
        } else if (line.startsWith('## ')) {
          paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('### ')) {
          paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
        } else if (line.trim() === '') {
          paragraphs.push(new Paragraph({ text: '' }));
        } else {
          paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      });

      const buffer = await Packer.toBuffer(doc);

      // Write to workspace directory
      const workDir = join(process.cwd(), 'workspace');
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
      const fileName = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 100)}.docx`;
      const filePath = join(workDir, fileName);
      writeFileSync(filePath, buffer);

      // Try to register file with CCAAS
      let downloadUrl = '';
      try {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName);
        formData.append('sessionId', sessionId);
        formData.append('tenantId', tenantId);

        const resp = await fetch(`${ccaasUrl}/api/v1/files/register`, {
          method: 'POST',
          body: formData,
        });
        if (resp.ok) {
          const result = await resp.json() as { url?: string };
          downloadUrl = result.url ?? `${ccaasUrl}/api/v1/files/${fileName}`;
        }
      } catch {
        // File registration failed — use local path as fallback
        downloadUrl = `/api/v1/files/${encodeURIComponent(fileName)}`;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: {
              fileName,
              fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              downloadUrl,
              description: `${title} — 教案文档`,
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
            data: { error: `生成文档失败: ${message}` },
            status: 'error',
          }),
        }],
        isError: true,
      };
    }
  }

  // ── Widget passthrough tools ────────────────────────────
  if (name === 'show_info_card' || name === 'suggest_actions'
      || name === 'show_step_wizard' || name === 'show_review_panel') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ status: 'success', rendered: true }),
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
