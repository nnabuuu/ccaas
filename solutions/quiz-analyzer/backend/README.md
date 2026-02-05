# Quiz Analyzer Backend

NestJS REST API server for the Quiz Analyzer solution.

## Features

- 🎯 Quiz management with multi-condition search
- 🌳 Hierarchical knowledge points with tree structure
- 🤖 AI-powered quiz analysis storage
- 📦 Batch processing with progress tracking and ETA
- ✅ Health check with database connectivity verification
- 🔒 Input validation with class-validator
- 📝 Request logging and error handling
- 🌐 CORS enabled for frontend integration

## Tech Stack

- **Framework**: NestJS 10.3.0
- **ORM**: TypeORM 0.3.19
- **Database**: SQLite (better-sqlite3)
- **WebSocket**: Socket.io 4.6.0
- **Validation**: class-validator + class-transformer

## Project Structure

```
backend/src/
├── app.module.ts                  # Root module
├── main.ts                        # Application bootstrap
├── database/                      # Database configuration
│   ├── database.module.ts
│   ├── database.service.ts
│   └── entities/                  # TypeORM entities
│       ├── subject.entity.ts
│       ├── knowledge-point.entity.ts
│       ├── quiz.entity.ts
│       ├── quiz-knowledge-link.entity.ts
│       ├── quiz-analysis.entity.ts
│       └── batch-job.entity.ts
├── common/                        # Shared utilities
│   ├── common.module.ts
│   ├── health.controller.ts       # Health check endpoint
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── logging.interceptor.ts
├── quizzes/                       # Quiz management
│   ├── quizzes.module.ts
│   ├── quizzes.controller.ts
│   ├── quizzes.service.ts
│   └── dto/
│       ├── create-quiz.dto.ts
│       ├── update-quiz.dto.ts
│       └── search-quizzes.dto.ts
├── knowledge-points/              # Knowledge points
│   ├── knowledge-points.module.ts
│   ├── knowledge-points.controller.ts
│   ├── knowledge-points.service.ts
│   └── dto/
│       └── search-kp.dto.ts
├── analyses/                      # Quiz analysis storage
│   ├── analyses.module.ts
│   ├── analyses.controller.ts
│   ├── analyses.service.ts
│   └── dto/
│       └── create-analysis.dto.ts
└── batch/                         # Batch processing
    ├── batch.module.ts
    ├── batch.controller.ts
    ├── batch.service.ts
    ├── batch-processor.service.ts
    └── dto/
        └── create-batch-job.dto.ts
```

## Installation

```bash
npm install
```

## Database Setup

Make sure the SQLite database exists:

```bash
cd ../scripts
npm install
node import-excel-to-db.js
```

This creates `../data/quiz-analyzer.db` with all tables and sample data.

## Running

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The server will start on `http://localhost:3005`.

## API Endpoints

### Health Check

```http
GET /health
```

Returns service health status and database connectivity:

```json
{
  "status": "healthy",
  "service": "quiz-analyzer-backend",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "database": {
    "connected": true,
    "quizCount": 6
  }
}
```

### Quizzes

#### List Quizzes

```http
GET /api/v1/quizzes?limit=20&offset=0
```

Query parameters:
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

#### Search Quizzes

```http
POST /api/v1/quizzes/search
Content-Type: application/json

{
  "query": "方程",
  "subjectId": "math-001",
  "gradeLevel": "9",
  "quizType": "选择题",
  "difficulty": 3,
  "knowledgePointId": "kp-001",
  "limit": 20,
  "offset": 0
}
```

Returns:

```json
{
  "quizzes": [
    {
      "id": "quiz-001",
      "content": "解方程 x² - 5x + 6 = 0",
      "quiz_type": "解答题",
      "difficulty": 3,
      "subject": { "id": "math-001", "name": "数学" },
      "knowledge_points": [
        { "id": "kp-003", "name": "一元二次方程" }
      ]
    }
  ],
  "pagination": {
    "total": 6,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Get Quiz Details

```http
GET /api/v1/quizzes/:id
```

Returns full quiz details including knowledge points and analysis.

#### Create Quiz

```http
POST /api/v1/quizzes
Content-Type: application/json

{
  "content": "求解不等式 2x + 3 > 7",
  "subject_id": "math-001",
  "grade_level": "9",
  "quiz_type": "解答题",
  "difficulty": 2,
  "correct_answer": "x > 2"
}
```

#### Update Quiz

```http
PUT /api/v1/quizzes/:id
Content-Type: application/json

{
  "difficulty": 3,
  "correct_answer": "x > 2"
}
```

### Knowledge Points

#### List Knowledge Points

```http
GET /api/v1/knowledge-points?subjectId=math-001
```

Returns flat list of all knowledge points.

#### Get Knowledge Points Tree

```http
GET /api/v1/knowledge-points/tree?subjectId=math-001&gradeLevel=9
```

Returns hierarchical tree structure:

```json
{
  "tree": [
    {
      "id": "kp-001",
      "name": "代数",
      "level": 0,
      "children": [
        {
          "id": "kp-002",
          "name": "方程与不等式",
          "level": 1,
          "children": [
            {
              "id": "kp-003",
              "name": "一元二次方程",
              "level": 2,
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "totalNodes": 8
}
```

#### Get Single Knowledge Point

```http
GET /api/v1/knowledge-points/:id
```

Returns knowledge point with parent and children.

#### Search Knowledge Points

```http
POST /api/v1/knowledge-points/search
Content-Type: application/json

{
  "query": "方程",
  "subjectId": "math-001",
  "parentId": "kp-002",
  "gradeLevel": "9",
  "level": 2
}
```

### Analysis

#### Get Quiz Analysis

```http
GET /api/v1/analyses/:quizId
```

Returns complete analysis for a quiz:

```json
{
  "id": "analysis-001",
  "quiz_id": "quiz-001",
  "thinking_process": "# 解题思路\n\n## 1. 识别方程类型...",
  "solution_steps": [
    {
      "stepNumber": 1,
      "title": "识别方程类型",
      "description": "这是一个标准的一元二次方程...",
      "formula": "ax² + bx + c = 0"
    }
  ],
  "common_mistakes": [
    {
      "description": "忘记检验根的判别式",
      "frequency": "high",
      "knowledgeGaps": ["kp-004"]
    }
  ],
  "knowledge_gap_analysis": "需要加强判别式的理解...",
  "difficulty_rationale": "涉及多个知识点",
  "time_estimate": "8-12分钟"
}
```

#### Create Analysis

```http
POST /api/v1/analyses
Content-Type: application/json

{
  "quiz_id": "quiz-001",
  "thinking_process": "# 解题思路...",
  "solution_steps": [...],
  "common_mistakes": [...],
  "difficulty_rationale": "涉及2个知识点",
  "time_estimate": "5-8分钟"
}
```

#### Update Analysis

```http
PUT /api/v1/analyses/:quizId
Content-Type: application/json

{
  "thinking_process": "# 更新的解题思路..."
}
```

#### Delete Analysis

```http
DELETE /api/v1/analyses/:quizId
```

### Batch Processing

#### Create Batch Analysis Job

```http
POST /api/v1/batch/analyze
Content-Type: application/json

{
  "name": "数学9年级题库批量分析",
  "quiz_ids": ["quiz-001", "quiz-002", "quiz-003"]
}
```

Returns:

```json
{
  "message": "Batch analysis job created",
  "job": {
    "id": "batch-001",
    "name": "数学9年级题库批量分析",
    "status": "pending",
    "quiz_ids": ["quiz-001", "quiz-002", "quiz-003"],
    "total_count": 3,
    "completed_count": 0,
    "failed_count": 0,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### List Batch Jobs

```http
GET /api/v1/batch/jobs?limit=50&offset=0
```

#### Get Job Status

```http
GET /api/v1/batch/jobs/:id
```

Returns job with progress and results:

```json
{
  "id": "batch-001",
  "name": "数学9年级题库批量分析",
  "status": "running",
  "quiz_ids": ["quiz-001", "quiz-002", "quiz-003"],
  "total_count": 3,
  "completed_count": 2,
  "failed_count": 0,
  "started_at": "2025-01-15T10:30:01.000Z",
  "estimated_completion": "2025-01-15T10:30:05.000Z",
  "results": [
    {
      "quizId": "quiz-001",
      "status": "completed",
      "duration_ms": 523
    },
    {
      "quizId": "quiz-002",
      "status": "completed",
      "duration_ms": 612
    }
  ]
}
```

#### Cancel Batch Job

```http
DELETE /api/v1/batch/jobs/:id
```

#### Get Processor Status

```http
GET /api/v1/batch/status
```

Returns:

```json
{
  "queueSize": 2,
  "isProcessing": true
}
```

## Batch Processing Details

### Rate Limiting

The batch processor processes 2 quizzes per second (500ms delay between each) to prevent overwhelming the system.

### Progress Tracking

- Real-time progress updates via database polling
- ETA calculation based on moving average of processing times
- Per-quiz result tracking (completed/failed with error messages)

### Cancellation

Jobs can be cancelled at any time. The processor checks for cancellation before processing each quiz.

### Error Handling

- Individual quiz failures don't stop the batch
- Failed quizzes are logged with error messages
- Batch job continues until all quizzes are processed or job is cancelled

## Error Handling

All endpoints return consistent error responses:

```json
{
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "Quiz with ID quiz-999 not found",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/v1/quizzes/quiz-999"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error

## Logging

The server logs all requests with duration:

```
[HTTP] GET /api/v1/quizzes - 45ms
[HTTP] POST /api/v1/batch/analyze - 123ms
[BatchProcessorService] Job batch-001 added to queue (1 jobs)
[BatchProcessorService] Processing job batch-001 (3 quizzes)
[BatchProcessorService] Quiz quiz-001 analysis initialized in 523ms
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

## Environment Variables

```bash
# Server port
PORT=3005

# Database path (relative to backend directory)
DB_PATH=../data/quiz-analyzer.db

# Node environment
NODE_ENV=development
```

## Integration with MCP Server

The backend is designed to work with the MCP server (port 3006) which provides AI tools for quiz analysis.

When AI analysis is triggered:
1. AI calls `/api/v1/analyses` to create/update analysis
2. Results are stored in the database
3. Frontend retrieves analysis via `/api/v1/analyses/:quizId`

## Database Schema

See `../scripts/schema.sql` for complete schema definition.

Key tables:
- `subjects` - Subject catalog
- `knowledge_points` - Hierarchical knowledge tree
- `quizzes` - Quiz content
- `quiz_knowledge_links` - Many-to-many quiz ↔ knowledge points
- `quiz_analyses` - AI analysis results
- `batch_analysis_jobs` - Batch processing tracking

## Future Enhancements

- [ ] WebSocket support for real-time batch progress
- [ ] Authentication and authorization
- [ ] Rate limiting for public APIs
- [ ] Database migration system
- [ ] PostgreSQL support for production
- [ ] Swagger/OpenAPI documentation
- [ ] Integration tests
- [ ] Performance monitoring
- [ ] Caching layer (Redis)

## License

MIT
