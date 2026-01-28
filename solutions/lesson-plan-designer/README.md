# Lesson Plan Designer

AI辅助备课设计器 - 独立前后端解决方案

## 功能特性

- **60/40 分屏布局** - 左侧备课表单，右侧AI Chat
- **同步按钮** - Chat消息中显示"同步到表单"按钮
- **AI修改标记** - 被AI修改的字段显示黄色边框
- **实时通信** - 通过Socket.io前后端交互
- **数据持久化** - SQLite数据库存储备课方案
- **教材版本选择** - 支持学科/年级/出版社/册别级联选择
- **章节树选择** - 树形结构选择具体教学章节
- **MCP Tools** - 提供9个AI可用的工具

## 技术栈

| 层级 | Frontend | Backend | MCP Server |
|-----|----------|---------|------------|
| Framework | React 18 + TypeScript | NestJS + TypeScript | @modelcontextprotocol/sdk |
| Build | Vite 6 | nest-cli / tsx | tsc |
| Styling | Tailwind CSS 3.4 | - | - |
| Real-time | Socket.io Client | Socket.io Server | stdio |
| Database | - | SQLite + better-sqlite3 | - |
| Testing | Vitest | Jest | - |

## 快速启动

### 一键启动（推荐）

```bash
./setup.sh
```

### 手动启动

```bash
# Terminal 1 - 后端
cd backend
npm install
npm run start:dev    # 启动在 :3002

# Terminal 2 - 前端
cd frontend
npm install
npm run dev    # 启动在 :5280

# Terminal 3 - MCP Server (可选，用于AI集成)
cd mcp-server
npm install
npm run build
```

## 访问地址

- **前端**: http://localhost:5280
- **后端API**: http://localhost:3002/api
- **Socket.io**: ws://localhost:3002

## API 端点

### 备课方案 API

| 方法 | 路径 | 用途 |
|-----|-----|-----|
| GET | `/api/lesson-plans` | 列表查询 |
| GET | `/api/lesson-plans/:id` | 获取详情 |
| POST | `/api/lesson-plans` | 创建备课 |
| PUT | `/api/lesson-plans/:id` | 更新备课 |
| PATCH | `/api/lesson-plans/:id/field` | 同步单个字段 |
| DELETE | `/api/lesson-plans/:id` | 删除备课 |

### 教材版本 API

| 方法 | 路径 | 用途 |
|-----|-----|-----|
| GET | `/api/textbook/subjects` | 获取学科列表 |
| GET | `/api/textbook/grades?subject=数学` | 获取年级列表 |
| GET | `/api/textbook/publishers?subject=数学&gradeId=3` | 获取出版社 |
| GET | `/api/textbook/volumes?subject=数学&gradeId=3&publisher=人教版` | 获取册别 |
| GET | `/api/textbook/chapters?subject=数学&gradeId=3&publisher=人教版&volume=上册` | 获取章节树 |

## MCP Tools

MCP Server 提供以下工具供AI使用：

### 输出工具

| 工具名称 | 用途 |
|---------|-----|
| `write_output` | 将结构化备课数据写入前端表单 |

### 搜索工具

| 工具名称 | 用途 |
|---------|-----|
| `search_curriculum_standards` | 搜索课程标准 |
| `search_textbook` | 搜索教材内容 |
| `search_teaching_resources` | 搜索教学资源 |

### 教材版本工具

| 工具名称 | 用途 |
|---------|-----|
| `get_textbook_subjects` | 获取可用学科列表 |
| `get_textbook_grades` | 获取指定学科的年级列表 |
| `get_textbook_publishers` | 获取指定学科/年级的出版社列表 |
| `get_textbook_volumes` | 获取册别（上册/下册） |
| `get_textbook_chapters` | 获取指定教材版本的章节树 |

### MCP 使用示例

```typescript
// 获取三年级数学人教版上册的章节
const chapters = await mcp.call('get_textbook_chapters', {
  subject: '数学',
  gradeId: 3,
  publisher: '人教版',
  volume: '上册'
});

// 搜索课程标准
const standards = await mcp.call('search_curriculum_standards', {
  subject: '数学',
  gradeLevel: '三年级',
  keyword: '分数'
});

// 写入教学目标到表单
await mcp.call('write_output', {
  field: 'objectives',
  value: [
    { id: 'obj-1', description: '理解分数的意义', bloomLevel: 'understand' }
  ],
  preview: '1个教学目标'
});
```

## Socket.io 事件

### 客户端发送

```typescript
socket.emit('chat', {
  sessionId: string,
  message: string,
  tenantId: string,
  context: { lessonPlanId, currentForm }
})
```

### 服务端发送

```typescript
// 文本流
socket.on('text_delta', { type: 'text_delta', sessionId, text })

// AI 输出更新（来自 write_output MCP 工具）
// 注意：使用嵌套结构，field/value/preview 在 payload.data 中
socket.on('output_update', {
  type: 'output_update',
  sessionId,
  payload: {
    data: { field, value, preview },
    status: 'success'
  }
})

// Agent 状态
socket.on('agent_status', { type: 'agent_status', status: 'running' | 'complete' | 'error' })
```

> **注意**: `output_update` 事件的数据在 `payload.data` 中，不是顶层。
> 前端使用 `parseOutputUpdateEvent()` 函数统一解析。

## 目录结构

```
lesson-plan-designer/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/      # UI组件
│   │   │   ├── CreateLessonPlanDialog.tsx  # 创建对话框
│   │   │   └── ChapterTree.tsx             # 章节树
│   │   ├── hooks/           # React Hooks
│   │   │   ├── useLessonPlanSession.ts     # 会话管理
│   │   │   └── useTextbook.ts              # 教材数据Hook
│   │   ├── types/           # TypeScript类型
│   │   └── utils/           # 工具函数
│   │       ├── api.ts                      # API 客户端
│   │       └── outputUpdateParser.ts       # 解析 output_update 事件
│   └── __tests__/           # Vitest 测试文件
│
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── lesson-plans/    # 备课方案模块
│   │   ├── textbook/        # 教材版本模块
│   │   ├── sessions/        # 会话模块
│   │   ├── database/        # 数据库模块
│   │   └── config/          # 配置模块
│   └── test/                # Jest 测试文件
│
└── mcp-server/              # MCP 服务器
    ├── src/
    │   ├── index.ts         # 主入口，9个MCP工具
    │   ├── mock-data.ts     # Mock数据
    │   └── types.ts         # 类型定义
    └── dist/                # 编译输出
```

## 测试

```bash
# 前端测试 (Vitest)
cd frontend && npm test

# 后端测试 (Jest)
cd backend && npm test
```

### 测试覆盖

- **Frontend**: 164 tests (useTextbook, ChapterTree, CreateLessonPlanDialog, useLessonPlanSync, parseOutputUpdate, etc.)
- **Backend**: 32 tests (TextbookService)

## 数据模型

### LessonPlan

```typescript
interface LessonPlan {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  gradeLevel: string;
  duration: string;

  // 教材版本信息
  publisher?: string;      // 出版社
  volume?: string;         // 册别
  chapterId?: number;      // 章节ID
  chapterTitle?: string;   // 章节标题

  // 教学内容
  objectives: LearningObjective[];
  standards: CurriculumStandard[];
  materials: Material[];
  activities: Activity[];
  assessment: Assessment;
  differentiation: Differentiation;

  // 元数据
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}
```

## 支持的教材版本

目前仅支持数学学科（1-6年级），出版社：

- 人教版 (PEP)
- 北师大版 (BSD)
- 苏教版 (SU)

每个年级支持上册和下册。

## 环境变量

```bash
# Backend
PORT=3002

# Frontend
VITE_API_URL=http://localhost:3002
```
