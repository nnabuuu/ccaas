#!/usr/bin/env node
/**
 * Lesson Plan Designer MCP Server
 *
 * Provides tools for:
 * 1. write_output - Send structured lesson plan data to the frontend
 * 2. attach_file - Attach generated files to the lesson plan
 * 3. search_curriculum_standards - Search curriculum standards/requirements (legacy mock)
 * 4. search_textbook - Search textbook content (legacy mock)
 * 5. search_teaching_resources - Search teaching resources (legacy mock)
 * 6. get_textbook_subjects - Get available subjects
 * 7. get_textbook_grades - Get grades for a subject
 * 8. get_textbook_volumes - Get volumes (上册/下册)
 * 9. get_textbook_chapters - Get chapter tree for a textbook edition (from real data)
 * 10. get_curriculum_standards - Get curriculum standards (from real data)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult, type LessonPlanAttachment } from './types.js';
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
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

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

// Define the write_output tool
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write lesson plan content to the frontend form. The frontend will display a "Sync to Form" button allowing the user to apply the changes.

Valid fields: ${SYNC_FIELDS.join(', ')}

Field schemas:
- title: string (课程标题)
- subject: string (学科，如 "数学", "语文")
- gradeLevel: number (年级，1-12)
- durationMinutes: number (课时分钟数)
- lessonPlanCode: string (教案编号)
- objectives: string (学习目标，纯文本)
- content: string (学习过程，纯文本)
- teachingMethods: string (教学方法，纯文本)
- materialsNeeded: string (课前准备，纯文本)
- assessmentMethods: string (作业检测，纯文本)
- curriculumRequirements: CurriculumStandard[] (课程要求，结构化数组，每项包含 id, standardCode, title, stage, standardType, contentDomain)
- studentAnalysis: string (学情分析，纯文本)
- extraProperties: Record<string, string> (额外属性，如教材分析、课件等)
- status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

Example for objectives:
{
  "field": "objectives",
  "value": "1. 学生能够理解分数的基本概念\\n2. 学生能够比较分数的大小",
  "preview": "2个学习目标"
}

Example for extraProperties:
{
  "field": "extraProperties",
  "value": { "教材分析": "本课是分数单元的第一课...", "课件": "PPT 12页" },
  "preview": "2个额外属性"
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
          { type: 'string', description: 'For text fields (title, subject, objectives, content, etc.)' },
          { type: 'number', description: 'For numeric fields (gradeLevel, durationMinutes)' },
          { type: 'object', description: 'For extraProperties (Record<string, string>)' },
          { type: 'array', description: 'For curriculumRequirements (CurriculumStandard[])' },
        ],
        description: 'The value for the field.',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// Define the attach_file tool
const attachFileTool: Tool = {
  name: 'attach_file',
  description: `Attach a generated file to the current lesson plan.

This tool allows you to attach files (teaching scripts, audio, PPT, PDF, etc.) that you've created in the session workspace to the lesson plan. The frontend will display a sync button allowing the user to add the attachment.

File types:
- script: Teaching scripts (.md, .txt)
- audio: Audio files (.mp3, .wav, .ogg, .m4a)
- ppt: PowerPoint presentations (.ppt, .pptx)
- pdf: PDF documents (.pdf)
- other: Other file types

Example usage:
{
  "filePath": "教学讲稿.md",
  "fileType": "script",
  "description": "教学讲稿 - 包含9个章节的完整授课指南"
}

Note: The filePath should be relative to the session workspace directory.`,
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to file in session workspace (relative path)',
      },
      fileType: {
        type: 'string',
        enum: ['script', 'audio', 'ppt', 'pdf', 'other'],
        description: 'Type of file being attached',
      },
      description: {
        type: 'string',
        description: 'Optional description of the file',
      },
    },
    required: ['filePath', 'fileType'],
  },
};

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      writeOutputTool,
      attachFileTool,
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

  // Handle attach_file tool
  if (name === 'attach_file') {
    const { filePath, fileType, description } = args as {
      filePath: string;
      fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
      description?: string;
    };

    // Get absolute path to the file in the session workspace
    const absolutePath = path.resolve(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: {
                error: `File not found: ${filePath}`,
              },
              status: 'error',
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileName = path.basename(filePath);

    // Infer MIME type from file extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
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
    // Note: fileId will be generated by the backend when the file is actually copied to persistent storage
    // For now, we use a placeholder that includes the file path
    const attachmentId = randomUUID();
    const fileId = randomUUID(); // Temporary ID, backend will assign real one

    // Format file size for preview
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Create attachment object
    const attachment: Partial<LessonPlanAttachment> = {
      id: attachmentId,
      fileId, // Placeholder, backend will replace
      fileName,
      fileType,
      mimeType,
      size: stats.size,
      downloadUrl: `/api/v1/files/${fileId}/download`, // Placeholder URL
      uploadedAt: new Date().toISOString(),
      description,
    };

    // Add metadata about the original file path for backend processing
    // Send absolute path so the backend can copy the file directly
    const attachmentWithPath = {
      ...attachment,
      _originalPath: absolutePath, // Absolute path to file in workspace
    };

    // Return result in the same format as write_output
    // This will trigger an output_update event with field='attachments'
    const result: WriteOutputResult = {
      data: {
        field: 'attachments',
        value: [attachmentWithPath], // Single attachment in array
        preview: `📎 ${fileName} (${formatBytes(stats.size)})`,
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
