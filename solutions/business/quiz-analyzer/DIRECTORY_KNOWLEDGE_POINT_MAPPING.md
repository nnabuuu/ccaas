# 题目 → 知识点 → 目录信息映射

## 🎯 核心概念

通过知识点可以定位题目的**两个维度**的信息：

| 维度 | 说明 | 用途 |
|------|------|------|
| **知识点层级路径** | 知识体系分类（认知维度） | 知识体系导航、相似知识点推荐 |
| **教材目录信息** | 教材章节定位（教学维度） | 课程规划、教材同步练习 |

## 📊 数据关系图

```
题目 (quiz)
  ├─→ 知识点 (knowledge_point)
  │     ├─→ 知识点层级路径 (path)
  │     │     └─→ 初中知识点 → 识字与写字 → 字形辨析
  │     │         (认知体系，按知识分类)
  │     └─→ 科目 (subject)
  │           └─→ 初中-语文
  │
  └─→ 目录信息 (directory)
        └─→ "1　社戏"（课文章节）
            (教学体系，按教材顺序)
```

## 🔍 实际数据验证

### 示例1：语文题目

**题目**："下列汉字书写正确的是..."
**来自Excel的数据**：
```json
{
  "题干": "下列填入文中横线①处的汉字，正确的一项是",
  "知识点名称": "字形辨析",
  "知识点id": "1998702114322394012",
  "目录id": "1999010056556797953",
  "目录名称": "1　社戏"  // ← 教材章节
}
```

**通过知识点ID获取层级路径**：
```bash
GET /tools/get_node_path?nodeId=1998702114322394012
```

**返回**：
```json
{
  "subject": {
    "id": "73ac9bce-a44b-4dfa-a462-8ea1e1dba401",
    "name": "初中-语文"
  },
  "path": [
    { "name": "初中知识点", "level": 1 },
    { "name": "识字与写字", "level": 2 },
    { "name": "字形辨析", "level": 3 }  // ← 知识体系
  ],
  "depth": 3
}
```

**结论**：
- ✅ **知识体系**：初中知识点 → 识字与写字 → 字形辨析
- ✅ **教材定位**：第1课《社戏》
- ✅ 两个维度都可以获取！

### 示例2：数学题目

**题目**："垃圾分类标志中既是轴对称图形又是中心对称图形的是..."

**来自Excel的数据**：
```json
{
  "知识点名称": "中心对称",
  "知识点id": "1998702114322400414",
  "目录id": "...",
  "目录名称": "..." // 对应教材某章节
}
```

**通过知识点ID获取层级路径**：
```json
{
  "subject": { "name": "初中-数学" },
  "path": [
    { "name": "初中知识点", "level": 1 },
    { "name": "图形与几何", "level": 2 },
    { "name": "图形的变化", "level": 3 },
    { "name": "图形的旋转", "level": 4 },
    { "name": "中心对称", "level": 5 }  // ← 5层深的知识体系
  ],
  "depth": 5
}
```

**结论**：
- ✅ **知识体系**：初中知识点 → 图形与几何 → 图形的变化 → 图形的旋转 → 中心对称
- ✅ **教材定位**：某章节（从 目录id 获取）
- ✅ 更深的知识层级（5层）

## 🎓 两个维度的区别和用途

### 维度1：知识点层级路径（认知维度）

**特点**：
- 按照**知识之间的逻辑关系**组织
- 层级深度：1-7层不等
- 跨章节、跨教材

**示例**：
```
数与代数 (认知大类)
  └─ 方程与方程组
      └─ 一元二次方程
          └─ 解一元二次方程
              └─ 因式分解法
                  └─ 十字相乘法因式分解
```

**用途**：
1. **知识体系导航** - 学生了解知识之间的关系
2. **相似题推荐** - 找到同一知识点下的其他题目
3. **知识图谱** - 构建完整的知识体系
4. **学习路径** - 从基础到高级的学习顺序

### 维度2：教材目录信息（教学维度）

**特点**：
- 按照**教材编排顺序**组织
- 对应具体的课文/章节
- 与实际教学同步

**示例**：
```
第一章 有理数
  1.1 有理数的概念
  1.2 有理数的运算
第二章 方程
  2.1 一元一次方程
  2.2 一元二次方程  // ← 教材章节
```

**用途**：
1. **课程规划** - 按教材顺序安排教学
2. **同步练习** - 配合教材章节出题
3. **教材适配** - 支持不同版本教材（人教版、北师大版等）
4. **家校沟通** - 家长知道孩子学到哪一课了

## 🛠️ 技术实现

### 获取知识点层级路径

**已实现的API**：
```typescript
// MCP工具: get_node_path
POST /tools/get_node_path
{
  "nodeId": "1998702114322394012"  // 知识点ID
}

// 返回
{
  "subject": { "id": "...", "name": "初中-语文" },
  "path": [
    { "id": "...", "name": "初中知识点", "level": 1 },
    { "id": "...", "name": "识字与写字", "level": 2 },
    { "id": "...", "name": "字形辨析", "level": 3 }
  ],
  "depth": 3
}
```

### 获取教材目录信息

**数据来源**：
- Excel文件中的 `目录id` 和 `目录名称` 字段
- 导入到数据库后，关联到题目

**需要实现的API**：
```typescript
// 建议新增 MCP工具: get_directory_info
POST /tools/get_directory_info
{
  "directoryId": "1999010056556797953"  // 目录ID
}

// 返回
{
  "id": "1999010056556797953",
  "name": "1　社戏",
  "subject": "初中-语文",
  "grade": "初中",
  "chapter": "第一单元",
  "sequence": 1,  // 顺序
  "relatedKnowledgePoints": [
    "字形辨析", "文言文阅读", ...
  ]
}
```

## 📱 UI展示建议

### 题目详情页面

```
┌─────────────────────────────────────┐
│ 题目内容                             │
│ 下列汉字书写正确的是...              │
├─────────────────────────────────────┤
│ 📚 知识点（认知维度）                │
│   初中知识点 > 识字与写字 > 字形辨析 │
│   [查看相似题目] [练习此知识点]      │
├─────────────────────────────────────┤
│ 📖 教材位置（教学维度）              │
│   初中语文 > 第一单元 > 1. 社戏      │
│   [同步练习] [查看课文]              │
└─────────────────────────────────────┘
```

### 知识点面包屑

```html
<breadcrumb>
  <item>初中-语文</item>
  <separator>/</separator>
  <item>初中知识点</item>
  <separator>></separator>
  <item>识字与写字</item>
  <separator>></separator>
  <item class="current">字形辨析</item>
</breadcrumb>

<directory-tag>
  📖 教材: 1. 社戏
</directory-tag>
```

## 🔗 完整的数据流

### 从题目到完整信息

```typescript
// 步骤1: 获取题目详情
const quiz = await getQuiz(quizId);
// {
//   id: "...",
//   content: "...",
//   directoryId: "1999010056556797953",
//   directoryName: "1　社戏"
// }

// 步骤2: 获取知识点标注
const tags = await getKnowledgePointTags(quizId);
// [
//   {
//     id: "1998702114322394012",
//     name: "字形辨析",
//     source: "question",
//     ...
//   }
// ]

// 步骤3: 获取每个知识点的层级路径
const paths = await Promise.all(
  tags.map(tag => getNodePath(tag.id))
);
// [
//   {
//     subject: { name: "初中-语文" },
//     path: ["初中知识点", "识字与写字", "字形辨析"],
//     depth: 3
//   }
// ]

// 步骤4: 获取目录详情（如果需要）
const directory = await getDirectory(quiz.directoryId);
// {
//   id: "1999010056556797953",
//   name: "1　社戏",
//   chapter: "第一单元",
//   ...
// }

// 完整的题目信息
return {
  quiz,
  knowledgePoints: {
    tags,
    paths  // ← 知识体系路径
  },
  directory  // ← 教材章节信息
};
```

## 📊 应用场景

### 场景1：智能推荐

```typescript
// 基于知识点推荐（认知维度）
function recommendByKnowledge(knowledgePointId) {
  return findQuizzes({
    knowledgePoints: [knowledgePointId]
  });
  // 返回：所有包含"字形辨析"的题目（可能来自不同课文）
}

// 基于目录推荐（教学维度）
function recommendByDirectory(directoryId) {
  return findQuizzes({
    directory: directoryId
  });
  // 返回：课文《社戏》的所有练习题
}
```

### 场景2：学习路径规划

```typescript
// 按知识点层级规划（从基础到高级）
function planLearningPath(targetKnowledgePoint) {
  const path = getNodePath(targetKnowledgePoint);
  // ["初中知识点", "识字与写字", "字形辨析"]

  // 为每一层推荐练习题
  return path.map(node => ({
    level: node.name,
    exercises: findQuizzes({ knowledgePoints: [node.id] })
  }));
}

// 按教材顺序规划（同步教学进度）
function planByTextbook(subject, grade) {
  const directories = getDirectoriesByGrade(subject, grade);
  // ["1. 社戏", "2. 回忆鲁迅先生", ...]

  return directories.map(dir => ({
    chapter: dir.name,
    exercises: findQuizzes({ directory: dir.id })
  }));
}
```

### 场景3：错题分析

```typescript
function analyzeWrongQuizzes(studentId) {
  const wrongQuizzes = getWrongQuizzes(studentId);

  // 按知识点分组（找薄弱知识点）
  const byKnowledge = groupBy(wrongQuizzes, q => q.knowledgePoints);
  // { "字形辨析": [quiz1, quiz2], "词语运用": [quiz3] }

  // 按目录分组（找薄弱章节）
  const byDirectory = groupBy(wrongQuizzes, q => q.directory);
  // { "1. 社戏": [quiz1, quiz2], "2. 回忆鲁迅先生": [quiz3] }

  return {
    weakKnowledgePoints: byKnowledge,  // 认知维度分析
    weakChapters: byDirectory          // 教学维度分析
  };
}
```

## 🎯 总结

### 是的，通过知识点可以定位目录信息！

| 问题 | 答案 |
|------|------|
| 能定位知识点层级路径吗？ | ✅ 是的，用 `get_node_path` API |
| 能定位教材章节吗？ | ✅ 是的，题目中有 `目录id` 和 `目录名称` |
| 两者有什么区别？ | 认知维度 vs 教学维度 |
| 能否同时使用？ | ✅ 是的，互补使用，效果更好 |

### 数据完整性

```
✅ 知识点 → 层级路径：完整（已实现 get_node_path）
✅ 知识点 → 科目：完整（返回 subject 信息）
✅ 题目 → 目录信息：完整（Excel数据中已有）
⏳ 目录 → 详细信息：需要扩展（建议新增 get_directory_info）
```

### 核心价值

1. **双维度定位**：既能按知识体系导航，又能按教材同步
2. **完整的教学支持**：适配不同的教学场景
3. **智能推荐基础**：支持基于知识或教材的多种推荐策略
4. **学习路径规划**：既可以按认知规律，也可以按教学进度

### 金句

> **"一个题目，两个维度：认知体系告诉我们'是什么'，教材章节告诉我们'学到哪'"**

这个设计非常完善！👏
