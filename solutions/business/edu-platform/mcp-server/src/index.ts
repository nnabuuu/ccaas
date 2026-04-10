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

// ─── Timetable Shared Data Model ──────────────────────────────

interface ScheduleEntry {
  day: number;          // 1-5 (Mon-Fri)
  period: number;       // 1-8
  subject: string;
  className: string;
  classId: string;
  room: string;
  teacherId: string;
  teacherName: string;
}

interface TeacherInfo {
  teacherId: string;
  name: string;
  subject: string;
  classIds: string[];
}

interface RescheduleRequest {
  requestId: string;
  type: 'swap' | 'reschedule' | 'substitute' | 'makeup' | 'batch';
  teacherId: string;
  teacherName: string;
  changes: Array<{
    originalDay: number;
    originalPeriod: number;
    originalTeacherId: string;
    targetDay: number;
    targetPeriod: number;
    targetTeacherId: string;
    classId: string;
  }>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  createdAt: string;
  approver?: string;
  rejectReason?: string;
}

const TEACHERS: TeacherInfo[] = [
  { teacherId: 't-zhang', name: '张老师', subject: '数学', classIds: ['c-8-2', 'c-8-3'] },
  { teacherId: 't-wang', name: '王老师', subject: '物理', classIds: ['c-8-1', 'c-8-2'] },
  { teacherId: 't-li', name: '李老师', subject: '数学', classIds: ['c-8-1', 'c-8-4'] },
  { teacherId: 't-liu', name: '刘老师', subject: '数学', classIds: ['c-8-3', 'c-8-4'] },
  { teacherId: 't-chen', name: '陈老师', subject: '英语', classIds: ['c-8-1', 'c-8-2'] },
  { teacherId: 't-zhao', name: '赵老师', subject: '数学', classIds: ['c-7-1', 'c-7-2'] },
  { teacherId: 't-sun', name: '孙老师', subject: '语文', classIds: ['c-8-2', 'c-8-3'] },
];

// Complete week schedule: 7 teachers × 5 days × 8 periods (not every slot is occupied)
const SCHEDULE: ScheduleEntry[] = [
  // ── 张老师 (数学, 八2/八3) ──
  { day: 1, period: 1, subject: '数学', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 1, period: 3, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 2, period: 2, subject: '数学', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 2, period: 5, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 3, period: 1, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 3, period: 5, subject: '数学', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 4, period: 2, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 4, period: 6, subject: '数学', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 5, period: 1, subject: '数学', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-zhang', teacherName: '张老师' },
  { day: 5, period: 4, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-zhang', teacherName: '张老师' },
  // ── 王老师 (物理, 八1/八2) ──
  { day: 1, period: 2, subject: '物理', className: '八(1)班', classId: 'c-8-1', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 1, period: 5, subject: '物理', className: '八(2)班', classId: 'c-8-2', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 2, period: 3, subject: '物理', className: '八(1)班', classId: 'c-8-1', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 3, period: 3, subject: '物理', className: '八(2)班', classId: 'c-8-2', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 4, period: 3, subject: '物理', className: '八(1)班', classId: 'c-8-1', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 4, period: 5, subject: '物理', className: '八(2)班', classId: 'c-8-2', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 5, period: 2, subject: '物理', className: '八(1)班', classId: 'c-8-1', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  { day: 5, period: 6, subject: '物理', className: '八(2)班', classId: 'c-8-2', room: '物理实验室', teacherId: 't-wang', teacherName: '王老师' },
  // ── 李老师 (数学, 八1/八4) ──
  { day: 1, period: 3, subject: '数学', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-li', teacherName: '李老师' },
  { day: 1, period: 6, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-li', teacherName: '李老师' },
  { day: 2, period: 1, subject: '数学', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-li', teacherName: '李老师' },
  { day: 2, period: 6, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-li', teacherName: '李老师' },
  { day: 3, period: 2, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-li', teacherName: '李老师' },
  { day: 3, period: 6, subject: '数学', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-li', teacherName: '李老师' },
  { day: 4, period: 1, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-li', teacherName: '李老师' },
  { day: 4, period: 4, subject: '数学', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-li', teacherName: '李老师' },
  { day: 5, period: 3, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-li', teacherName: '李老师' },
  { day: 5, period: 5, subject: '数学', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-li', teacherName: '李老师' },
  // ── 刘老师 (数学, 八3/八4) ──
  { day: 1, period: 4, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 2, period: 3, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 2, period: 7, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 3, period: 4, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 4, period: 2, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 4, period: 7, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 5, period: 2, subject: '数学', className: '八(4)班', classId: 'c-8-4', room: '304', teacherId: 't-liu', teacherName: '刘老师' },
  { day: 5, period: 7, subject: '数学', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-liu', teacherName: '刘老师' },
  // ── 陈老师 (英语, 八1/八2) ──
  { day: 1, period: 4, subject: '英语', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 1, period: 7, subject: '英语', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 2, period: 4, subject: '英语', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 3, period: 4, subject: '英语', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 3, period: 7, subject: '英语', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 4, period: 4, subject: '英语', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 5, period: 4, subject: '英语', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-chen', teacherName: '陈老师' },
  { day: 5, period: 8, subject: '英语', className: '八(1)班', classId: 'c-8-1', room: '303', teacherId: 't-chen', teacherName: '陈老师' },
  // ── 赵老师 (数学, 七1/七2) ──
  { day: 1, period: 1, subject: '数学', className: '七(1)班', classId: 'c-7-1', room: '201', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 1, period: 5, subject: '数学', className: '七(2)班', classId: 'c-7-2', room: '202', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 2, period: 2, subject: '数学', className: '七(1)班', classId: 'c-7-1', room: '201', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 2, period: 5, subject: '数学', className: '七(2)班', classId: 'c-7-2', room: '202', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 3, period: 1, subject: '数学', className: '七(2)班', classId: 'c-7-2', room: '202', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 3, period: 5, subject: '数学', className: '七(1)班', classId: 'c-7-1', room: '201', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 4, period: 1, subject: '数学', className: '七(1)班', classId: 'c-7-1', room: '201', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 4, period: 6, subject: '数学', className: '七(2)班', classId: 'c-7-2', room: '202', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 5, period: 1, subject: '数学', className: '七(1)班', classId: 'c-7-1', room: '201', teacherId: 't-zhao', teacherName: '赵老师' },
  { day: 5, period: 6, subject: '数学', className: '七(2)班', classId: 'c-7-2', room: '202', teacherId: 't-zhao', teacherName: '赵老师' },
  // ── 孙老师 (语文, 八2/八3) ──
  { day: 1, period: 2, subject: '语文', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 1, period: 6, subject: '语文', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 2, period: 1, subject: '语文', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 2, period: 6, subject: '语文', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 3, period: 2, subject: '语文', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 3, period: 6, subject: '语文', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 4, period: 1, subject: '语文', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 4, period: 5, subject: '语文', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 5, period: 3, subject: '语文', className: '八(2)班', classId: 'c-8-2', room: '301', teacherId: 't-sun', teacherName: '孙老师' },
  { day: 5, period: 5, subject: '语文', className: '八(3)班', classId: 'c-8-3', room: '302', teacherId: 't-sun', teacherName: '孙老师' },
];

// Room events that cause hard conflicts (e.g., lab reserved for activity)
const ROOM_EVENTS: Array<{ day: number; period: number; room: string; event: string }> = [
  { day: 3, period: 7, room: '301', event: '校级数学竞赛集训' },
  { day: 4, period: 8, room: '物理实验室', event: '实验室设备维护' },
  { day: 5, period: 7, room: '302', event: '家长会布置' },
];

// Mutable store for submitted requests
const SUBMITTED_REQUESTS: RescheduleRequest[] = [
  {
    requestId: '#2025-0418-001',
    type: 'swap',
    teacherId: 't-zhang',
    teacherName: '张老师',
    changes: [{ originalDay: 3, originalPeriod: 5, originalTeacherId: 't-zhang', targetDay: 4, targetPeriod: 3, targetTeacherId: 't-wang', classId: 'c-8-2' }],
    reason: '周三下午有教研活动',
    status: 'pending',
    createdAt: '2025-04-18T10:30:00Z',
    approver: '李主任',
  },
  {
    requestId: '#2025-0415-003',
    type: 'substitute',
    teacherId: 't-zhang',
    teacherName: '张老师',
    changes: [{ originalDay: 1, originalPeriod: 1, originalTeacherId: 't-zhang', targetDay: 1, targetPeriod: 1, targetTeacherId: 't-liu', classId: 'c-8-2' }],
    reason: '病假',
    status: 'approved',
    createdAt: '2025-04-15T08:00:00Z',
    approver: '李主任',
  },
  {
    requestId: '#2025-0410-002',
    type: 'reschedule',
    teacherId: 't-zhang',
    teacherName: '张老师',
    changes: [{ originalDay: 2, originalPeriod: 5, originalTeacherId: 't-zhang', targetDay: 4, targetPeriod: 7, targetTeacherId: 't-zhang', classId: 'c-8-3' }],
    reason: '调整教学安排',
    status: 'rejected',
    createdAt: '2025-04-10T14:00:00Z',
    approver: '李主任',
    rejectReason: '目标时段教室已被占用',
  },
  // Historical substitute records for dynamic historyCount
  {
    requestId: '#2025-0320-001',
    type: 'substitute',
    teacherId: 't-wang',
    teacherName: '王老师',
    changes: [{ originalDay: 4, originalPeriod: 5, originalTeacherId: 't-wang', targetDay: 4, targetPeriod: 5, targetTeacherId: 't-liu', classId: 'c-8-2' }],
    reason: '外出培训',
    status: 'approved',
    createdAt: '2025-03-20T09:00:00Z',
    approver: '李主任',
  },
  {
    requestId: '#2025-0305-002',
    type: 'substitute',
    teacherId: 't-li',
    teacherName: '李老师',
    changes: [{ originalDay: 2, originalPeriod: 1, originalTeacherId: 't-li', targetDay: 2, targetPeriod: 1, targetTeacherId: 't-liu', classId: 'c-8-1' }],
    reason: '体检',
    status: 'approved',
    createdAt: '2025-03-05T08:30:00Z',
    approver: '李主任',
  },
];

let requestCounter = 6;

// Helper: day number to Chinese name
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五'];

// ─── Timetable Tool Definitions ───────────────────────────────

const timetableQueryScheduleTool: Tool = {
  name: 'timetable_query_schedule',
  description: '查询教师或班级的课表。调课流程第一步：先查课表确认受影响的课时信息。按 teacherId 或 classId 过滤，返回该周的课程安排列表。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      teacherId: { type: 'string', description: '教师ID，如 t-zhang' },
      classId: { type: 'string', description: '班级ID，如 c-8-2' },
      week: { type: 'number', description: '周次（默认1=本周）' },
    },
  },
};

const timetableFindAvailableSlotsTool: Tool = {
  name: 'timetable_find_available_slots',
  description: '查找教师和班级都空闲的时段。用于改时(reschedule)和补课(makeup)场景。通过排除已占用时段推算空闲。totalSlots=0 时需提供降级建议（扩大范围/放宽条件）。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      week: { type: 'number', description: '周次' },
      subject: { type: 'string', description: '学科筛选' },
      excludeTeacherId: { type: 'string', description: '排除的教师ID（即发起人自己）' },
      classIds: { type: 'array', items: { type: 'string' }, description: '需要空闲的班级ID列表' },
      preferredDays: { type: 'array', items: { type: 'number' }, description: '偏好的日期(1-5)' },
    },
    required: ['week'],
  },
};

const timetableCheckConflictsTool: Tool = {
  name: 'timetable_check_conflicts',
  description: '检测调课变更是否存在冲突。返回冲突列表和严重级别(none/soft/hard)。severity=hard 时必须阻止提交并提供替代方案，绝对禁止调用 timetable_submit_request。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      changes: {
        type: 'array',
        description: '变更列表',
        items: {
          type: 'object',
          properties: {
            originalDay: { type: 'number' },
            originalPeriod: { type: 'number' },
            originalTeacherId: { type: 'string' },
            targetDay: { type: 'number' },
            targetPeriod: { type: 'number' },
            targetTeacherId: { type: 'string' },
            classId: { type: 'string' },
          },
          required: ['originalDay', 'originalPeriod', 'originalTeacherId', 'targetDay', 'targetPeriod', 'targetTeacherId', 'classId'],
        },
      },
    },
    required: ['changes'],
  },
};

const timetableSubmitRequestTool: Tool = {
  name: 'timetable_submit_request',
  description: '提交调课申请。⚠️ 必须在用 show_info_card 展示变更摘要并用 suggest_actions 让教师选择"确认提交"之后才能调用。禁止未经确认直接调用。返回申请号和状态。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', enum: ['swap', 'reschedule', 'substitute', 'makeup', 'batch'], description: '调课类型' },
      changes: {
        type: 'array',
        description: '变更列表',
        items: {
          type: 'object',
          properties: {
            originalDay: { type: 'number' },
            originalPeriod: { type: 'number' },
            originalTeacherId: { type: 'string' },
            targetDay: { type: 'number' },
            targetPeriod: { type: 'number' },
            targetTeacherId: { type: 'string' },
            classId: { type: 'string' },
          },
          required: ['originalDay', 'originalPeriod', 'originalTeacherId', 'targetDay', 'targetPeriod', 'targetTeacherId', 'classId'],
        },
      },
      reason: { type: 'string', description: '调课原因' },
      note: { type: 'string', description: '备注（可选）' },
    },
    required: ['type', 'changes', 'reason'],
  },
};

const timetableListMyRequestsTool: Tool = {
  name: 'timetable_list_my_requests',
  description: '查询当前教师的调课申请列表。当教师问"批了吗/申请状态/查看申请"时调用。teacherId 从 sessionContext 获取。可按状态过滤。用 show_info_card 展示结果。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      teacherId: { type: 'string', description: '教师ID（必须从 sessionContext.teacherId 获取）' },
      status: { type: 'string', description: '过滤状态: pending/approved/rejected' },
    },
    required: ['teacherId'],
  },
};

const timetableFindSubstituteTeachersTool: Tool = {
  name: 'timetable_find_substitute_teachers',
  description: '搜索可用的代课教师。用于代课(substitute)场景，当教师请假需找人代课时调用。按匹配度(matchScore)排序，考虑学科匹配、是否教过该班、空闲时段数。用 show_info_card 展示候选列表。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      subject: { type: 'string', description: '需要代课的学科' },
      slot: {
        type: 'object',
        description: '需要代课的时段',
        properties: {
          day: { type: 'number', description: '星期几(1-5)' },
          periods: { type: 'array', items: { type: 'number' }, description: '节次列表' },
        },
        required: ['day', 'periods'],
      },
      excludeTeacherId: { type: 'string', description: '排除的教师ID（请假教师自己）' },
      classId: { type: 'string', description: '班级ID，用于判断是否教过该班' },
    },
    required: ['subject', 'slot', 'excludeTeacherId'],
  },
};

// ─── List Tools Handler ─────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    curriculumTreeTool, writeOutputTool, studentProficiencyTool, teachingProgressTool, generateDocxTool,
    showInfoCardTool, showReviewPanelTool, suggestActionsTool,
    timetableQueryScheduleTool, timetableFindAvailableSlotsTool, timetableCheckConflictsTool,
    timetableSubmitRequestTool, timetableListMyRequestsTool, timetableFindSubstituteTeachersTool,
  ],
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

  // ── timetable_query_schedule ────────────────────────────
  if (name === 'timetable_query_schedule') {
    const params = args as Record<string, unknown>;
    const teacherId = params.teacherId as string | undefined;
    const classId = params.classId as string | undefined;

    let results = [...SCHEDULE];
    if (teacherId) {
      results = results.filter(e => e.teacherId === teacherId);
    }
    if (classId) {
      results = results.filter(e => e.classId === classId);
    }
    results.sort((a, b) => a.day - b.day || a.period - b.period);

    const teacher = teacherId ? TEACHERS.find(t => t.teacherId === teacherId) : undefined;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            week: (params.week as number) || 1,
            teacher: teacher ? { id: teacher.teacherId, name: teacher.name, subject: teacher.subject } : undefined,
            totalEntries: results.length,
            schedule: results.map(e => ({
              day: e.day,
              dayName: DAY_NAMES[e.day],
              period: e.period,
              subject: e.subject,
              className: e.className,
              classId: e.classId,
              room: e.room,
              teacherId: e.teacherId,
              teacherName: e.teacherName,
            })),
          },
          status: 'success',
        }),
      }],
    };
  }

  // ── timetable_find_available_slots ────────────────────────
  if (name === 'timetable_find_available_slots') {
    const params = args as Record<string, unknown>;
    const week = (params.week as number) || 1;
    const classIds = (params.classIds as string[] | undefined) || [];
    const excludeTeacherId = params.excludeTeacherId as string | undefined;
    const preferredDays = (params.preferredDays as number[] | undefined) || [1, 2, 3, 4, 5];

    // Weeks >= 50 simulate exam/event weeks where all slots are occupied
    if (week >= 50) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: {
              week,
              totalSlots: 0,
              slots: [],
              note: '该周为考试周/活动周，所有时段已被占用',
            },
            status: 'success',
          }),
        }],
      };
    }

    const slots: Array<{
      day: number;
      dayName: string;
      period: number;
      room: string;
      conflictLevel: 'none' | 'soft' | 'hard';
      conflictNote?: string;
    }> = [];

    for (const day of preferredDays) {
      for (let period = 1; period <= 8; period++) {
        // Check: is the initiating teacher free?
        if (excludeTeacherId) {
          const teacherBusy = SCHEDULE.some(e => e.teacherId === excludeTeacherId && e.day === day && e.period === period);
          if (teacherBusy) continue;
        }

        // Check: are all requested classes free?
        let classBusy = false;
        for (const cid of classIds) {
          if (SCHEDULE.some(e => e.classId === cid && e.day === day && e.period === period)) {
            classBusy = true;
            break;
          }
        }
        if (classBusy) continue;

        // Check room events for hard conflicts
        const roomEvent = ROOM_EVENTS.find(re => re.day === day && re.period === period);
        let conflictLevel: 'none' | 'soft' | 'hard' = 'none';
        let conflictNote: string | undefined;

        if (roomEvent) {
          conflictLevel = 'hard';
          conflictNote = `${roomEvent.room} 被占用: ${roomEvent.event}`;
        }

        // Check soft conflict: same subject in same class same day
        if (classIds.length > 0 && params.subject) {
          for (const cid of classIds) {
            const sameDaySameSubject = SCHEDULE.filter(
              e => e.classId === cid && e.day === day && e.subject === (params.subject as string)
            ).length;
            if (sameDaySameSubject >= 2) {
              conflictLevel = conflictLevel === 'hard' ? 'hard' : 'soft';
              conflictNote = conflictNote || `该班当天已有${sameDaySameSubject}节${params.subject as string}`;
            }
          }
        }

        // Find a free room
        const occupiedRooms = SCHEDULE.filter(e => e.day === day && e.period === period).map(e => e.room);
        const allRooms = ['301', '302', '303', '304', '201', '202', '物理实验室'];
        const freeRoom = allRooms.find(r => !occupiedRooms.includes(r)) || '待定';

        slots.push({
          day,
          dayName: DAY_NAMES[day],
          period,
          room: freeRoom,
          conflictLevel,
          conflictNote,
        });
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            week,
            totalSlots: slots.length,
            slots: slots.slice(0, 20),
          },
          status: 'success',
        }),
      }],
    };
  }

  // ── timetable_check_conflicts ────────────────────────────
  if (name === 'timetable_check_conflicts') {
    const params = args as Record<string, unknown>;
    const changes = params.changes as Array<{
      originalDay: number;
      originalPeriod: number;
      originalTeacherId: string;
      targetDay: number;
      targetPeriod: number;
      targetTeacherId: string;
      classId: string;
    }>;

    const conflicts: Array<{ type: string; severity: 'soft' | 'hard'; description: string }> = [];

    // Swap-aware: collect slots vacated by all changes in this batch.
    // In a swap, teacher A leaves slot X and teacher B leaves slot Y,
    // so X is available for B and Y is available for A.
    const vacatedTeacherKeys = new Set<string>();
    const vacatedClassKeys = new Set<string>();
    for (const c of changes) {
      vacatedTeacherKeys.add(`${c.originalTeacherId}:${c.originalDay}:${c.originalPeriod}`);
      vacatedClassKeys.add(`${c.classId}:${c.originalDay}:${c.originalPeriod}`);
    }

    for (const change of changes) {
      // Hard: target teacher already has a class at target time
      const targetTeacherBusy = SCHEDULE.find(
        e => e.teacherId === change.targetTeacherId && e.day === change.targetDay && e.period === change.targetPeriod
      );
      if (targetTeacherBusy) {
        // Skip if that teacher's slot is being vacated by another change in this batch
        const vacKey = `${change.targetTeacherId}:${change.targetDay}:${change.targetPeriod}`;
        if (!vacatedTeacherKeys.has(vacKey)) {
          conflicts.push({
            type: 'teacher_busy',
            severity: 'hard',
            description: `${targetTeacherBusy.teacherName}在${DAY_NAMES[change.targetDay]}第${change.targetPeriod}节已有课（${targetTeacherBusy.subject}·${targetTeacherBusy.className}）`,
          });
        }
      }

      // Hard: target class already has a class at target time
      const classBusy = SCHEDULE.find(
        e => e.classId === change.classId && e.day === change.targetDay && e.period === change.targetPeriod
      );
      if (classBusy) {
        // Skip if that class's slot is being vacated by another change in this batch
        const vacKey = `${change.classId}:${change.targetDay}:${change.targetPeriod}`;
        if (!vacatedClassKeys.has(vacKey)) {
          conflicts.push({
            type: 'class_busy',
            severity: 'hard',
            description: `${classBusy.className}在${DAY_NAMES[change.targetDay]}第${change.targetPeriod}节已有课（${classBusy.subject}·${classBusy.teacherName}）`,
          });
        }
      }

      // Hard: room event at target time
      const roomEvent = ROOM_EVENTS.find(
        re => re.day === change.targetDay && re.period === change.targetPeriod
      );
      if (roomEvent) {
        conflicts.push({
          type: 'room_event',
          severity: 'hard',
          description: `${roomEvent.room}在${DAY_NAMES[change.targetDay]}第${change.targetPeriod}节被占用（${roomEvent.event}）`,
        });
      }

      // Soft: same subject count in class for target day
      const originalEntry = SCHEDULE.find(
        e => e.teacherId === change.originalTeacherId && e.day === change.originalDay && e.period === change.originalPeriod
      );
      if (originalEntry) {
        // Count existing same-subject classes on target day, but subtract any
        // that are being vacated (moved away) by other changes in this batch
        let sameSubjectCount = SCHEDULE.filter(
          e => e.classId === change.classId && e.day === change.targetDay && e.subject === originalEntry.subject
        ).length;
        // Subtract vacated entries: if another change moves the same class's same-subject
        // class away from the target day, it no longer counts
        for (const other of changes) {
          if (other === change) continue;
          const otherEntry = SCHEDULE.find(
            e => e.teacherId === other.originalTeacherId && e.day === other.originalDay && e.period === other.originalPeriod
          );
          if (otherEntry && otherEntry.classId === change.classId && otherEntry.day === change.targetDay && otherEntry.subject === originalEntry.subject) {
            sameSubjectCount--;
          }
        }
        if (sameSubjectCount >= 2) {
          conflicts.push({
            type: 'subject_overload',
            severity: 'soft',
            description: `${originalEntry.className}在${DAY_NAMES[change.targetDay]}已有${sameSubjectCount}节${originalEntry.subject}，调课后将达${sameSubjectCount + 1}节`,
          });
        }
      }
    }

    const overallSeverity = conflicts.some(c => c.severity === 'hard')
      ? 'hard'
      : conflicts.length > 0
        ? 'soft'
        : 'none';

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            severity: overallSeverity,
            totalConflicts: conflicts.length,
            conflicts,
          },
          status: 'success',
        }),
      }],
    };
  }

  // ── timetable_submit_request ────────────────────────────
  if (name === 'timetable_submit_request') {
    const params = args as Record<string, unknown>;
    const reqType = params.type as RescheduleRequest['type'];
    const changes = params.changes as RescheduleRequest['changes'];
    const reason = params.reason as string;
    const note = params.note as string | undefined;

    requestCounter++;
    const now = new Date();
    // Format: YYYY-MMDD (e.g., "2025-0418"), matches pre-seeded requestId format
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const requestId = `#${dateStr}-${String(requestCounter).padStart(3, '0')}`;

    const newRequest: RescheduleRequest = {
      requestId,
      type: reqType,
      teacherId: changes[0]?.originalTeacherId || 'unknown',
      teacherName: TEACHERS.find(t => t.teacherId === changes[0]?.originalTeacherId)?.name || '未知',
      changes,
      reason,
      status: 'pending',
      createdAt: now.toISOString(),
      approver: '李主任',
    };

    SUBMITTED_REQUESTS.push(newRequest);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            requestId,
            status: newRequest.status,
            approver: newRequest.approver,
            message: `调课申请 ${requestId} 已提交，等待${newRequest.approver}审批`,
            note: note || undefined,
          },
          status: 'success',
        }),
      }],
    };
  }

  // ── timetable_list_my_requests ────────────────────────────
  if (name === 'timetable_list_my_requests') {
    const params = args as Record<string, unknown>;
    const teacherId = params.teacherId as string | undefined;
    const statusFilter = params.status as string | undefined;

    let results = [...SUBMITTED_REQUESTS];
    if (teacherId) {
      results = results.filter(r => r.teacherId === teacherId);
    }
    if (statusFilter) {
      results = results.filter(r => r.status === statusFilter);
    }

    const summary = {
      pending: results.filter(r => r.status === 'pending').length,
      approved: results.filter(r => r.status === 'approved').length,
      rejected: results.filter(r => r.status === 'rejected').length,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            total: results.length,
            summary,
            requests: results.map(r => ({
              requestId: r.requestId,
              type: r.type,
              status: r.status,
              reason: r.reason,
              createdAt: r.createdAt,
              approver: r.approver,
              rejectReason: r.rejectReason,
              changes: r.changes.map(c => ({
                from: `${DAY_NAMES[c.originalDay]}第${c.originalPeriod}节`,
                to: `${DAY_NAMES[c.targetDay]}第${c.targetPeriod}节`,
                classId: c.classId,
                originalTeacher: TEACHERS.find(t => t.teacherId === c.originalTeacherId)?.name || c.originalTeacherId,
                targetTeacher: TEACHERS.find(t => t.teacherId === c.targetTeacherId)?.name || c.targetTeacherId,
              })),
            })),
          },
          status: 'success',
        }),
      }],
    };
  }

  // ── timetable_find_substitute_teachers ────────────────────
  if (name === 'timetable_find_substitute_teachers') {
    const params = args as Record<string, unknown>;
    const subject = params.subject as string;
    const slot = params.slot as { day: number; periods: number[] };
    const excludeTeacherId = params.excludeTeacherId as string;
    const classId = params.classId as string | undefined;

    const candidates: Array<{
      teacherId: string;
      teacherName: string;
      subject: string;
      availableSlots: number;
      totalSlots: number;
      historyCount: number;
      taughtThisClass: boolean;
      matchScore: number;
    }> = [];

    for (const teacher of TEACHERS) {
      if (teacher.teacherId === excludeTeacherId) continue;

      // Count how many of the requested periods this teacher is free
      let freeCount = 0;
      for (const period of slot.periods) {
        const busy = SCHEDULE.some(
          e => e.teacherId === teacher.teacherId && e.day === slot.day && e.period === period
        );
        if (!busy) freeCount++;
      }

      if (freeCount === 0) continue;

      const taughtThisClass = classId ? teacher.classIds.includes(classId) : false;
      const subjectMatch = teacher.subject === subject;

      // Dynamic history count: count approved substitute requests where this teacher was the target
      const historyCount = SUBMITTED_REQUESTS.filter(
        r => r.type === 'substitute' && r.status === 'approved' &&
          r.changes.some(c => c.targetTeacherId === teacher.teacherId)
      ).length;

      // matchScore formula:
      // subjectMatch: 40 points
      // taughtThisClass: 30 points
      // availability: (freeCount / totalSlots) * 20 points
      // history bonus: min(historyCount * 2, 10) points
      const matchScore = Math.round(
        (subjectMatch ? 40 : 0) +
        (taughtThisClass ? 30 : 0) +
        (freeCount / slot.periods.length) * 20 +
        Math.min(historyCount * 2, 10)
      );

      candidates.push({
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        subject: teacher.subject,
        availableSlots: freeCount,
        totalSlots: slot.periods.length,
        historyCount,
        taughtThisClass,
        matchScore,
      });
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            totalCandidates: candidates.length,
            requestedSubject: subject,
            requestedSlot: { day: slot.day, dayName: DAY_NAMES[slot.day], periods: slot.periods },
            candidates,
            matchScoreFormula: 'subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)',
          },
          status: 'success',
        }),
      }],
    };
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
