#!/usr/bin/env node
/**
 * Lesson Plan Designer MCP Server
 *
 * Provides tools for:
 * 1. write_output - Send structured lesson plan data to the frontend
 * 2. search_curriculum_standards - Search curriculum standards/requirements (legacy mock)
 * 3. search_textbook - Search textbook content (legacy mock)
 * 4. search_teaching_resources - Search teaching resources (legacy mock)
 * 5. get_textbook_subjects - Get available subjects
 * 6. get_textbook_grades - Get grades for a subject
 * 7. get_textbook_volumes - Get volumes (上册/下册)
 * 8. get_textbook_chapters - Get chapter tree for a textbook edition (from real data)
 * 9. get_curriculum_standards - Get curriculum standards (from real data)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult } from './types.js';
import { validateAndFixField, type ValidationResult } from './schemas.js';
import {
  searchCurriculumStandards,
  searchTextbook,
  searchTeachingResources,
} from './mock-data.js';
import {
  getTextbookSubjects,
  getTextbookGrades,
  getTextbookVolumes,
  getTextbookChapters,
  getCurriculumSubjects,
  getCurriculumStages,
  getCurriculumStandards,
} from './data-loader.js';

// Create the MCP server
const server = new Server(
  {
    name: 'lesson-plan-designer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the search_curriculum_standards tool (legacy mock)
const searchCurriculumStandardsTool: Tool = {
  name: 'search_curriculum_standards',
  description: `[Legacy] Search curriculum standards and requirements by subject, grade level, or keywords.
Note: For real data, use get_curriculum_standards tool instead.

Returns matching curriculum standards with codes, descriptions, and categories (content or academic).

Example usage:
- Search by subject: { "subject": "数学" }
- Search by grade: { "gradeLevel": "三年级" }
- Search by keyword: { "keyword": "分数" }
- Combined search: { "subject": "数学", "gradeLevel": "三年级", "keyword": "分数" }`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject to filter by (e.g., "数学", "语文", "物理")',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level to filter by (e.g., "三年级", "初二")',
      },
      keyword: {
        type: 'string',
        description: 'Keyword to search in title, description, and tags',
      },
      category: {
        type: 'string',
        enum: ['content', 'academic'],
        description: 'Category of standard: "content" for subject content, "academic" for skills',
      },
    },
  },
};

// Define the search_textbook tool (legacy mock)
const searchTextbookTool: Tool = {
  name: 'search_textbook',
  description: `[Legacy] Search textbook chapters and content by subject, grade level, or keywords.
Note: For real chapter data, use get_textbook_chapters tool instead.

Returns matching textbook chapters with summaries, key points, and vocabulary.

Example usage:
- Search by subject: { "subject": "数学" }
- Search by keyword: { "keyword": "分数" }
- Combined: { "subject": "数学", "gradeLevel": "三年级", "keyword": "分数" }`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject to filter by',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level to filter by',
      },
      keyword: {
        type: 'string',
        description: 'Keyword to search in title, summary, key points, and vocabulary',
      },
    },
  },
};

// Define the search_teaching_resources tool
const searchTeachingResourcesTool: Tool = {
  name: 'search_teaching_resources',
  description: `Search teaching resources including videos, documents, interactive tools, images, and exercises.

Returns matching resources with type, description, URL, and duration (for videos).

Resource types:
- video: Educational videos
- document: PDF documents, handbooks
- interactive: Interactive games and simulations
- image: Images and illustrations
- exercise: Practice exercises and tests

Example usage:
- Search by type: { "type": "video" }
- Search by subject and keyword: { "subject": "数学", "keyword": "分数" }`,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['video', 'document', 'interactive', 'image', 'exercise'],
        description: 'Type of resource to filter by',
      },
      subject: {
        type: 'string',
        description: 'Subject to filter by',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level to filter by',
      },
      keyword: {
        type: 'string',
        description: 'Keyword to search in title, description, and tags',
      },
    },
  },
};

// ===== Real Data Tools =====

// Define the get_textbook_subjects tool
const getTextbookSubjectsTool: Tool = {
  name: 'get_textbook_subjects',
  description: `Get all available textbook subjects from real data.

Returns a list of subjects (学科) that can be used for lesson planning.
Available subjects: 数学, 物理, 化学

Example response: ["数学", "物理", "化学"]`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// Define the get_textbook_grades tool
const getTextbookGradesTool: Tool = {
  name: 'get_textbook_grades',
  description: `Get available grades for a specific subject from real data.

Returns a list of grade numbers (1-9).
- 数学: grades 1-9
- 物理: grades 8-9
- 化学: grade 9

Example usage: { "subject": "数学" }
Example response: [1, 2, 3, 4, 5, 6, 7, 8, 9]`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject name (e.g., "数学", "物理", "化学")',
      },
    },
    required: ['subject'],
  },
};

// Define the get_textbook_volumes tool
const getTextbookVolumesTool: Tool = {
  name: 'get_textbook_volumes',
  description: `Get available textbook volumes for a subject and grade from real data.

Returns a list of volumes (册别), typically "上册" and "下册".
Some textbooks may have "全一册".

Example usage: { "subject": "数学", "grade": 3 }
Example response: ["上册", "下册"]`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject name (e.g., "数学")',
      },
      grade: {
        type: 'number',
        description: 'Grade number (1-9)',
      },
    },
    required: ['subject', 'grade'],
  },
};

// Define the get_textbook_chapters tool
const getTextbookChaptersTool: Tool = {
  name: 'get_textbook_chapters',
  description: `Get the chapter tree for a specific textbook edition from real data.

Returns a hierarchical tree of chapters (章节) with parent units and child lessons.
This is useful for selecting the specific content to teach in a lesson plan.

Available data:
- 数学: grades 1-9, 上册/下册
- 物理: grade 8 (上/下册), grade 9 (全一册)
- 化学: grade 9 (上/下册)

Example usage:
{ "subject": "数学", "grade": 3, "volume": "上册" }

Example response:
[
  {
    "id": 113,
    "title": "第一单元 时、分、秒",
    "children": [
      { "id": 114, "title": "秒的认识" },
      { "id": 115, "title": "时间的计算" }
    ]
  }
]

Note: Select leaf nodes (children) for specific lesson content.`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject name (e.g., "数学", "物理", "化学")',
      },
      grade: {
        type: 'number',
        description: 'Grade number (1-9)',
      },
      volume: {
        type: 'string',
        description: 'Volume name (e.g., "上册", "下册", "全一册")',
      },
    },
    required: ['subject', 'grade', 'volume'],
  },
};

// Define the get_curriculum_standards tool (NEW - real data)
const getCurriculumStandardsTool: Tool = {
  name: 'get_curriculum_standards',
  description: `Get curriculum standards from real data with optional filtering.

Returns curriculum standards for a subject, optionally filtered by stage, type, or keyword.

Available data:
- 数学: 776 standards
- 物理: 272 standards
- 化学: 259 standards

Stages (学段):
- 义务教育阶段第一学段 (grades 1-2)
- 义务教育阶段第二学段 (grades 3-4)
- 义务教育阶段第三学段 (grades 5-6)
- 义务教育阶段第四学段 (grades 7-9)

Standard types (standardType):
- 内容要求 (content requirements)
- 学业要求 (academic requirements)

Content domains (contentDomain) for 数学:
- 数与代数
- 图形与几何
- 统计与概率

Example usage:
{ "subject": "数学" }
{ "subject": "数学", "stage": "义务教育阶段第二学段" }
{ "subject": "数学", "stage": "义务教育阶段第二学段", "keyword": "分数" }

Example response:
{
  "subject": "数学",
  "count": 150,
  "standards": [
    {
      "id": 123,
      "standardCode": "数学-段第-0123",
      "title": "能用分数描述简单的数量关系",
      "stage": "义务教育阶段第二学段",
      "standardType": "内容要求",
      "contentDomain": "数与代数"
    }
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject name (数学, 物理, 化学)',
      },
      stage: {
        type: 'string',
        description: 'Educational stage (e.g., "义务教育阶段第二学段")',
      },
      standardType: {
        type: 'string',
        description: 'Standard type: "内容要求" or "学业要求"',
      },
      contentDomain: {
        type: 'string',
        description: 'Content domain (e.g., "数与代数", "图形与几何")',
      },
      keyword: {
        type: 'string',
        description: 'Keyword to search in title',
      },
    },
    required: ['subject'],
  },
};

// JSON Schema definitions for write_output value field
const ObjectiveSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '唯一标识符，如 "obj-1"' },
    description: { type: 'string', description: '教学目标描述' },
    bloomLevel: {
      type: 'string',
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
      description: 'Bloom 认知层级',
    },
    assessmentCriteria: { type: 'string', description: '评估标准（可选）' },
  },
  required: ['id', 'description', 'bloomLevel'],
};

const StandardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '唯一标识符' },
    code: { type: 'string', description: '课程标准代码' },
    description: { type: 'string', description: '标准描述' },
  },
  required: ['id', 'code', 'description'],
};

const MaterialSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '唯一标识符' },
    name: { type: 'string', description: '材料名称' },
    type: {
      type: 'string',
      enum: ['textbook', 'handout', 'digital', 'manipulative', 'other'],
      description: '材料类型',
    },
    url: { type: 'string', description: '资源链接（可选）' },
    notes: { type: 'string', description: '备注（可选）' },
  },
  required: ['id', 'name', 'type'],
};

const ActivitySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '唯一标识符，如 "act-1"' },
    title: { type: 'string', description: '活动标题' },
    description: { type: 'string', description: '活动描述' },
    duration: { type: 'number', description: '时长（分钟）' },
    type: {
      type: 'string',
      enum: ['introduction', 'direct-instruction', 'guided-practice', 'independent-practice', 'group', 'assessment', 'closure'],
      description: '活动类型',
    },
    instructions: {
      type: 'array',
      items: { type: 'string' },
      description: '步骤说明',
    },
    materials: {
      type: 'array',
      items: { type: 'string' },
      description: '所需材料（可选）',
    },
    teacherNotes: { type: 'string', description: '教师备注（可选）' },
  },
  required: ['id', 'title', 'description', 'duration', 'type', 'instructions'],
};

const AssessmentSchema = {
  type: 'object',
  properties: {
    formative: {
      type: 'array',
      items: { type: 'string' },
      description: '形成性评估方法',
    },
    summative: {
      type: 'array',
      items: { type: 'string' },
      description: '总结性评估方法',
    },
    rubric: { type: 'string', description: '评分标准（可选）' },
  },
  required: ['formative', 'summative'],
};

const DifferentiationSchema = {
  type: 'object',
  properties: {
    struggling: {
      type: 'array',
      items: { type: 'string' },
      description: '学困生支持策略',
    },
    onLevel: {
      type: 'array',
      items: { type: 'string' },
      description: '普通学生策略',
    },
    advanced: {
      type: 'array',
      items: { type: 'string' },
      description: '优秀学生拓展',
    },
    ell: {
      type: 'array',
      items: { type: 'string' },
      description: 'ELL学生支持（可选）',
    },
    accommodations: {
      type: 'array',
      items: { type: 'string' },
      description: '特殊需求调适（可选）',
    },
  },
  required: ['struggling', 'onLevel', 'advanced'],
};

// Define the write_output tool
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write structured lesson plan content to the frontend form. The frontend will display a "Sync to Form" button allowing the user to apply the changes.

**IMPORTANT**: Data is validated with Zod schemas. Missing 'id' fields will be auto-generated, but other required fields must be provided.

Valid fields: ${SYNC_FIELDS.join(', ')}

Field schemas:
- title: string (课程标题)
- subject: string (学科，如 "数学", "语文")
- gradeLevel: string (年级，如 "三年级", "高一")
- duration: string (课时，如 "45分钟", "2课时")
- objectives: Array<{ id, description, bloomLevel, assessmentCriteria? }>
- standards: Array<{ id, code, description }>
- materials: Array<{ id, name, type, url?, notes? }>
- activities: Array<{ id, title, description, duration, type, instructions[], materials?, teacherNotes? }>
- assessment: { formative[], summative[], rubric? }
- differentiation: { struggling[], onLevel[], advanced[], ell?, accommodations? }

Example for objectives:
{
  "field": "objectives",
  "value": [
    { "id": "obj-1", "description": "学生能够理解核心概念", "bloomLevel": "understand", "assessmentCriteria": "能用自己的话解释" }
  ],
  "preview": "1个教学目标"
}

Example for activities:
{
  "field": "activities",
  "value": [
    { "id": "act-1", "title": "情境导入", "description": "通过生活场景引入", "duration": 5, "type": "introduction", "instructions": ["展示图片", "提问学生"] }
  ],
  "preview": "1个教学活动"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: 'The lesson plan field to update',
      },
      value: {
        oneOf: [
          // String fields
          { type: 'string', description: 'For title, subject, gradeLevel, duration' },
          // objectives array
          { type: 'array', items: ObjectiveSchema, description: 'For objectives field' },
          // standards array
          { type: 'array', items: StandardSchema, description: 'For standards field' },
          // materials array
          { type: 'array', items: MaterialSchema, description: 'For materials field' },
          // activities array
          { type: 'array', items: ActivitySchema, description: 'For activities field' },
          // assessment object
          AssessmentSchema,
          // differentiation object
          DifferentiationSchema,
        ],
        description: 'Structured data matching the field schema. Must be valid JSON, not a string.',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button (e.g., "3个教学目标", "4个教学活动")',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      writeOutputTool,
      // Real data tools (recommended)
      getTextbookSubjectsTool,
      getTextbookGradesTool,
      getTextbookVolumesTool,
      getTextbookChaptersTool,
      getCurriculumStandardsTool,
      // Legacy mock tools
      searchCurriculumStandardsTool,
      searchTextbookTool,
      searchTeachingResourcesTool,
    ],
  };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Handle write_output tool
  if (name === 'write_output') {
    const input = args as unknown as WriteOutputInput;

    // Validate the field name
    if (!SYNC_FIELDS.includes(input.field as SyncField)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Invalid field: ${input.field}. Valid fields are: ${SYNC_FIELDS.join(', ')}` },
              status: 'error',
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // Validate and fix the value using Zod schema
    const validation = validateAndFixField(input.field as SyncField, input.value);

    if (!validation.success) {
      // Schema validation failed - return error with details
      console.error(`[write_output] Validation failed for ${input.field}:`, validation.errors);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: {
                error: `Data validation failed for field "${input.field}": ${validation.errors.join('; ')}`,
                field: input.field,
                originalValue: input.value,
              },
              status: 'error',
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // Log if data was auto-fixed
    if (validation.fixed) {
      console.error(`[write_output] Data for ${input.field} was auto-fixed:`, validation.warnings);
    }

    // Return the result with validated/fixed data
    // EventMapper looks for { data: ..., status: ... } structure
    const result: WriteOutputResult = {
      data: {
        field: input.field,
        value: validation.data, // Use validated/fixed data
        preview: input.preview,
      },
      status: 'success',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }

  // ===== Real Data Tool Handlers =====

  // Handle get_textbook_subjects tool
  if (name === 'get_textbook_subjects') {
    const subjects = getTextbookSubjects();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(subjects, null, 2),
        },
      ],
    };
  }

  // Handle get_textbook_grades tool
  if (name === 'get_textbook_grades') {
    const { subject } = args as { subject: string };
    const grades = getTextbookGrades(subject);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(grades, null, 2),
        },
      ],
    };
  }

  // Handle get_textbook_volumes tool
  if (name === 'get_textbook_volumes') {
    const { subject, grade } = args as { subject: string; grade: number };
    const volumes = getTextbookVolumes(subject, grade);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(volumes, null, 2),
        },
      ],
    };
  }

  // Handle get_textbook_chapters tool
  if (name === 'get_textbook_chapters') {
    const { subject, grade, volume } = args as {
      subject: string;
      grade: number;
      volume: string;
    };
    const chapters = getTextbookChapters(subject, grade, volume);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(chapters, null, 2),
        },
      ],
    };
  }

  // Handle get_curriculum_standards tool (NEW)
  if (name === 'get_curriculum_standards') {
    const { subject, stage, standardType, contentDomain, keyword } = args as {
      subject: string;
      stage?: string;
      standardType?: string;
      contentDomain?: string;
      keyword?: string;
    };
    const result = getCurriculumStandards(
      subject,
      stage,
      standardType,
      contentDomain,
      keyword,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ===== Legacy Mock Tool Handlers =====

  // Handle search_curriculum_standards tool (legacy)
  if (name === 'search_curriculum_standards') {
    const query = args as {
      subject?: string;
      gradeLevel?: string;
      keyword?: string;
      category?: 'content' | 'academic';
    };

    const results = searchCurriculumStandards(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: results.length,
            standards: results,
          }, null, 2),
        },
      ],
    };
  }

  // Handle search_textbook tool (legacy)
  if (name === 'search_textbook') {
    const query = args as {
      subject?: string;
      gradeLevel?: string;
      keyword?: string;
    };

    const results = searchTextbook(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: results.length,
            chapters: results,
          }, null, 2),
        },
      ],
    };
  }

  // Handle search_teaching_resources tool
  if (name === 'search_teaching_resources') {
    const query = args as {
      type?: 'video' | 'document' | 'interactive' | 'image' | 'exercise';
      subject?: string;
      gradeLevel?: string;
      keyword?: string;
    };

    const results = searchTeachingResources(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: results.length,
            resources: results,
          }, null, 2),
        },
      ],
    };
  }

  // Unknown tool
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          data: { error: `Unknown tool: ${name}` },
          status: 'error',
        }),
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr since stdout is used for MCP communication
  console.error('Lesson Plan Designer MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
