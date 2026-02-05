# Backend集成：Source Classification

## 概述

本文档说明如何在backend中集成知识点来源分类（source classification）功能。

## 数据库变更

### 新增字段

在 `quiz_knowledge_links` 表中新增两个字段：

```sql
source TEXT DEFAULT 'question'  -- 'question' | 'solution' | 'both'
note TEXT                       -- Optional explanation for fallback
```

### Migration

```bash
# 对于已存在的数据库，运行migration
sqlite3 data/quiz-analyzer.db < scripts/add-source-classification-fields.sql

# 验证
sqlite3 data/quiz-analyzer.db "SELECT COUNT(*), source FROM quiz_knowledge_links GROUP BY source"
```

## API 响应格式更新

### 1. GET /api/v1/quizzes/:id/knowledge-points

**旧格式**:
```json
{
  "data": [
    {
      "id": "uuid-1",
      "name": "一元二次方程",
      "confidence": 0.95,
      "verified": true,
      "level": 5,
      "path": ["初中-数学", "数与代数", "方程与方程组", "一元二次方程"]
    }
  ]
}
```

**新格式** (添加 `source` 和 `note`):
```json
{
  "data": [
    {
      "id": "uuid-1",
      "name": "一元二次方程",
      "confidence": 0.95,
      "verified": true,
      "level": 5,
      "path": ["初中-数学", "数与代数", "方程与方程组", "一元二次方程"],
      "source": "question",
      "note": null
    },
    {
      "id": "uuid-2",
      "name": "十字相乘法因式分解",
      "confidence": 0.95,
      "verified": true,
      "level": 6,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解", "十字相乘法因式分解"],
      "source": "solution",
      "note": null
    },
    {
      "id": "uuid-3",
      "name": "因式分解",
      "confidence": 0.75,
      "verified": true,
      "level": 5,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解"],
      "source": "question",
      "note": "题目提到'因式分解法'，但具体方法需从答案识别（见子节点）"
    }
  ]
}
```

### 2. GET /api/v1/quizzes/:id/analysis

在完整分析结果中包含source分类：

```json
{
  "quiz": { ... },
  "analysis": {
    "quizAnalysis": "本题综合考察一元二次方程和因式分解（十字相乘法）",
    "knowledgePointTags": [
      {
        "id": "uuid-1",
        "name": "一元二次方程",
        "source": "question",
        "confidence": 0.95,
        ...
      },
      {
        "id": "uuid-2",
        "name": "十字相乘法因式分解",
        "source": "solution",
        "confidence": 0.95,
        ...
      }
    ],
    "thinkingProcess": "# 解题思路\n\n## 1. 识别题型\n从题干'解方程'识别为**一元二次方程**\n\n## 2. 选择方法\n从答案 (x+2)(x+3) 识别需要用**十字相乘法因式分解**...",
    ...
  }
}
```

## NestJS Service层更新

### QuizKnowledgeLinksService

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizKnowledgeLink } from './entities/quiz-knowledge-link.entity';

@Injectable()
export class QuizKnowledgeLinksService {
  constructor(
    @InjectRepository(QuizKnowledgeLink)
    private linksRepository: Repository<QuizKnowledgeLink>,
  ) {}

  /**
   * Save knowledge point tags from AI analysis
   * @param quizId Quiz ID
   * @param tags Knowledge point tags with source classification
   */
  async saveKnowledgePointTags(
    quizId: string,
    tags: KnowledgePointTag[]
  ): Promise<QuizKnowledgeLink[]> {
    // Delete existing links for this quiz
    await this.linksRepository.delete({ quiz_id: quizId });

    // Create new links with source and note fields
    const links = tags.map(tag => ({
      id: uuidv4(),
      quiz_id: quizId,
      knowledge_point_id: tag.id,
      confidence_score: tag.confidence,
      link_type: 'ai-generated',
      source: tag.source,              // ← New field
      note: tag.note || null,          // ← New field
      created_by: 'ai',
    }));

    return await this.linksRepository.save(links);
  }

  /**
   * Get knowledge points grouped by source
   * @param quizId Quiz ID
   */
  async getKnowledgePointsBySource(quizId: string): Promise<{
    question: KnowledgePoint[];
    solution: KnowledgePoint[];
    both: KnowledgePoint[];
  }> {
    const links = await this.linksRepository.find({
      where: { quiz_id: quizId },
      relations: ['knowledgePoint'],
    });

    return {
      question: links
        .filter(link => link.source === 'question')
        .map(link => link.knowledgePoint),
      solution: links
        .filter(link => link.source === 'solution')
        .map(link => link.knowledgePoint),
      both: links
        .filter(link => link.source === 'both')
        .map(link => link.knowledgePoint),
    };
  }

  /**
   * Get fallback knowledge points (those with notes)
   * @param quizId Quiz ID
   */
  async getFallbackKnowledgePoints(quizId: string): Promise<{
    knowledgePoint: KnowledgePoint;
    note: string;
  }[]> {
    const links = await this.linksRepository.find({
      where: {
        quiz_id: quizId,
        note: Not(IsNull()),  // Has note = using fallback
      },
      relations: ['knowledgePoint'],
    });

    return links.map(link => ({
      knowledgePoint: link.knowledgePoint,
      note: link.note,
    }));
  }
}
```

## 批量分析集成

### BatchProcessorService更新

在调用AI分析时，需要明确指示AI：

```typescript
async processQuiz(quizId: string): Promise<void> {
  const quiz = await this.quizzesService.findOne(quizId);

  // Build prompt for AI
  const prompt = `
请分析以下题目，并标注知识点。

**重要说明**：
1. 请区分从题干识别的知识点（source: "question"）和从答案识别的知识点（source: "solution"）
2. 如果无法精确匹配到叶子节点，请使用父节点并在note中说明原因

**题目内容**：
${quiz.content}

**正确答案**：
${quiz.correct_answer}

请按照SKILL_KNOWLEDGE_POINT_MATCHING.md的8步workflow进行分析。
`;

  // Call AI through CCAAS
  const result = await this.ccaasService.analyze({
    sessionId: `batch-${quizId}`,
    prompt,
  });

  // Save results to database
  await this.quizKnowledgeLinksService.saveKnowledgePointTags(
    quizId,
    result.knowledgePointTags
  );
}
```

## TypeORM Entity更新

### quiz-knowledge-link.entity.ts

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Quiz } from '../quizzes/entities/quiz.entity';
import { KnowledgePoint } from '../knowledge-points/entities/knowledge-point.entity';

@Entity('quiz_knowledge_links')
export class QuizKnowledgeLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id' })
  quizId: string;

  @Column({ name: 'knowledge_point_id' })
  knowledgePointId: string;

  @Column({ type: 'real', default: 1.0 })
  confidence_score: number;

  @Column({ default: 'manual' })
  link_type: 'manual' | 'ai-generated' | 'ai-verified';

  @Column({ default: 'question' })  // ← New field
  source: 'question' | 'solution' | 'both';

  @Column({ nullable: true })  // ← New field
  note: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => Quiz, quiz => quiz.knowledgeLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @ManyToOne(() => KnowledgePoint, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'knowledge_point_id' })
  knowledgePoint: KnowledgePoint;
}
```

## API Endpoints更新

### 新增按source筛选的endpoint

```typescript
// knowledge-points.controller.ts

@Get('quizzes/:id/knowledge-points/by-source')
async getKnowledgePointsBySource(
  @Param('id') quizId: string,
): Promise<{
  question: KnowledgePoint[];
  solution: KnowledgePoint[];
  both: KnowledgePoint[];
}> {
  return await this.quizKnowledgeLinksService.getKnowledgePointsBySource(quizId);
}
```

## 前端使用示例

### 1. 显示knowledge点时区分颜色

```tsx
function KnowledgePointBadge({ tag }: { tag: KnowledgePointTag }) {
  const colors = {
    question: 'bg-blue-100 text-blue-800',
    solution: 'bg-green-100 text-green-800',
    both: 'bg-purple-100 text-purple-800',
  };

  const labels = {
    question: '题型',
    solution: '方法',
    both: '综合',
  };

  return (
    <div className={`px-3 py-1 rounded-full ${colors[tag.source]}`}>
      <span className="text-xs font-medium">{labels[tag.source]}</span>
      <span className="ml-2">{tag.name}</span>
      {tag.note && (
        <Tooltip content={tag.note}>
          <InfoIcon className="ml-1 w-3 h-3" />
        </Tooltip>
      )}
    </div>
  );
}
```

### 2. 生成解题提示

```typescript
function generateHints(tags: KnowledgePointTag[]): string[] {
  const questionTags = tags.filter(t => t.source === 'question');
  const solutionTags = tags.filter(t => t.source === 'solution');

  const hints = [];

  if (questionTags.length > 0) {
    hints.push(
      `这是关于 ${questionTags.map(t => t.name).join('和')} 的题目`
    );
  }

  if (solutionTags.length > 0) {
    hints.push(
      `需要用到 ${solutionTags.map(t => t.name).join('和')} 来解答`
    );
  }

  return hints;
}
```

### 3. 智能推荐

```typescript
// 推荐相似题型（基于question knowledge points）
async function recommendSimilarQuizzes(quizId: string) {
  const { question } = await api.getKnowledgePointsBySource(quizId);
  return await api.findQuizzes({
    knowledgePoints: question.map(kp => kp.id),
    source: 'question',
  });
}

// 推荐方法练习（基于solution knowledge points）
async function recommendMethodPractice(quizId: string) {
  const { solution } = await api.getKnowledgePointsBySource(quizId);
  return await api.findQuizzes({
    knowledgePoints: solution.map(kp => kp.id),
    source: 'solution',
  });
}
```

## 测试策略

### 1. Unit Tests

```typescript
describe('QuizKnowledgeLinksService', () => {
  it('should save knowledge point tags with source field', async () => {
    const tags: KnowledgePointTag[] = [
      {
        id: 'uuid-1',
        name: '一元二次方程',
        source: 'question',
        confidence: 0.95,
        verified: true,
        level: 5,
        path: [],
      },
      {
        id: 'uuid-2',
        name: '十字相乘法',
        source: 'solution',
        confidence: 0.95,
        verified: true,
        level: 6,
        path: [],
      },
    ];

    const links = await service.saveKnowledgePointTags('quiz-1', tags);

    expect(links).toHaveLength(2);
    expect(links[0].source).toBe('question');
    expect(links[1].source).toBe('solution');
  });

  it('should retrieve knowledge points grouped by source', async () => {
    const result = await service.getKnowledgePointsBySource('quiz-1');

    expect(result.question).toHaveLength(1);
    expect(result.solution).toHaveLength(1);
    expect(result.both).toHaveLength(0);
  });
});
```

### 2. Integration Tests

```typescript
describe('Quiz Analysis API', () => {
  it('should return knowledge points with source classification', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/quizzes/quiz-1/knowledge-points')
      .expect(200);

    expect(response.body.data[0]).toHaveProperty('source');
    expect(response.body.data[0].source).toMatch(/^(question|solution|both)$/);
  });
});
```

## Migration步骤

### 生产环境部署清单

```bash
# 1. 备份数据库
cp data/quiz-analyzer.db data/quiz-analyzer.db.backup

# 2. 运行migration
sqlite3 data/quiz-analyzer.db < scripts/add-source-classification-fields.sql

# 3. 验证字段添加成功
sqlite3 data/quiz-analyzer.db "PRAGMA table_info(quiz_knowledge_links)"

# 4. 更新backend代码
cd backend
npm install
npm run build

# 5. 重启服务
pm2 restart quiz-analyzer-backend

# 6. 验证API响应格式
curl http://localhost:3005/api/v1/quizzes/test-quiz-1/knowledge-points | jq '.data[0].source'
```

## 总结

### 关键变更

1. ✅ **数据库schema** - 添加 `source` 和 `note` 字段
2. ✅ **TypeORM entity** - 更新 `QuizKnowledgeLink` 类型
3. ✅ **Service层** - 新增按source分组查询方法
4. ✅ **API响应** - 所有knowledge point返回都包含source和note
5. ✅ **批量分析** - AI prompt中明确要求区分source
6. ✅ **前端集成** - 支持按source筛选和显示

### 教育价值提升

- **更精准的题型识别** - question knowledge points
- **明确的解题方法** - solution knowledge points
- **智能学习路径** - 基于source的推荐算法
- **错题分析增强** - 区分概念理解 vs 方法掌握

### 向后兼容

- 旧数据自动设置 `source = 'question'`（默认值）
- `note` 字段为可选，旧数据为 `NULL`
- 现有API仍然工作，只是返回更多信息
