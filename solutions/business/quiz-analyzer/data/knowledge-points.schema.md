# 知识点数据结构说明 (Knowledge Points Schema)

## 用途 (Purpose)

存储层级化的知识点体系，用于题目知识点标注、推荐和难度评估。

This file stores a hierarchical knowledge point system for quiz tagging, recommendations, and difficulty assessment.

## 数据文件 (Data File)

- **文件名**: `knowledge-points.json`
- **大小**: ~15MB
- **记录数**: 31,497 个知识点
- **层级深度**: 1-10 级（level 1 为根节点）

## 顶层结构 (Top-Level Structure)

```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-15",
  "totalCount": 31497,
  "knowledgePoints": [...]
}
```

### 字段说明 (Top-Level Fields)

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 数据格式版本号 |
| `lastUpdated` | string | 最后更新日期 (YYYY-MM-DD) |
| `totalCount` | number | 知识点总数 |
| `knowledgePoints` | array | 知识点数组（详见下文） |

## 知识点对象结构 (Knowledge Point Object)

```json
{
  "id": "1998702114322374659",
  "subjectId": "b0e09778-0968-4313-a335-f61d541cc838",
  "parentId": null,
  "name": "2022版知识图谱",
  "code": null,
  "description": "",
  "level": 1,
  "gradeLevel": "小学",
  "difficultyContribution": 0.5,
  "commonProblemTypes": [],
  "relatedFormulas": [],
  "createdAt": "2026-02-08 03:46:22",
  "children": ["1998702114322374660", "1998702114322374882"]
}
```

### 字段说明 (Knowledge Point Fields)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 唯一标识符 (Unique identifier) |
| `subjectId` | string | ✅ | 所属科目/目录 ID，参考 `catalogs.json` |
| `parentId` | string/null | ✅ | 父知识点 ID，`null` 表示根节点 |
| `name` | string | ✅ | 知识点名称（如 "二次函数"） |
| `code` | string/null | ❌ | 知识点代码（可选） |
| `description` | string | ❌ | 知识点描述（可为空） |
| `level` | number | ✅ | 层级深度（1=根，2=章，3=节，4=小节...） |
| `gradeLevel` | string | ✅ | 年级范围（"小学"、"初中"、"高中"等） |
| `difficultyContribution` | number | ✅ | 难度权重（0.1-1.0，默认 0.5） |
| `commonProblemTypes` | array | ✅ | 常见题型列表（JSON 数组，可为空） |
| `relatedFormulas` | array | ✅ | 相关公式列表（JSON 数组，可为空） |
| `createdAt` | string | ✅ | 创建时间（ISO 8601 格式） |
| `children` | array | ✅ | 子知识点 ID 列表（构建树形结构用） |

## 层级关系 (Hierarchical Structure)

知识点采用**自引用树形结构**，通过 `parentId` 和 `children` 字段构建层级关系。

### 层级深度示例 (Level Depth Example)

- **Level 1** (根节点): "2022版知识图谱"
  - **Level 2** (章): "识字与写字"
    - **Level 3** (节): "拼音"
      - **Level 4** (小节): "声母"
        - **Level 5**: "声母 b, p, m, f"

### 统计数据 (Statistics by Level)

```javascript
{
  '1': 21,      // 21 个根节点
  '2': 206,     // 206 个一级分类
  '3': 1450,    // 1450 个二级分类
  '4': 8886,    // ...
  '5': 13615,
  '6': 5301,
  '7': 1564,
  '8': 384,
  '9': 67,
  '10': 3
}
```

## 查询方法 (Query Methods)

### 1. 按科目筛选 (Filter by Subject)

```javascript
const mathKnowledgePoints = knowledgePoints.filter(
  kp => kp.subjectId === 'math-subject-id'
);
```

### 2. 查找根节点 (Find Root Nodes)

```javascript
const rootNodes = knowledgePoints.filter(kp => kp.parentId === null);
```

### 3. 查找子节点 (Find Children)

```javascript
const children = knowledgePoints.filter(
  kp => kp.parentId === 'parent-id'
);

// 或使用 children 字段
const childrenIds = knowledgePoint.children;
```

### 4. 构建完整树形结构 (Build Full Tree)

```javascript
function buildTree(nodes) {
  const map = new Map(nodes.map(n => [n.id, { ...n, children: [] }]));
  const roots = [];

  map.forEach(node => {
    if (node.parentId) {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}
```

### 5. 模糊搜索知识点 (Fuzzy Search)

```javascript
function searchKnowledgePoints(keyword, subjectId = null) {
  return knowledgePoints.filter(kp => {
    const matchName = kp.name.includes(keyword);
    const matchSubject = !subjectId || kp.subjectId === subjectId;
    return matchName && matchSubject;
  });
}

// 示例：搜索包含 "函数" 的数学知识点
const results = searchKnowledgePoints('函数', 'math-subject-id');
```

## 使用场景 (Use Cases)

### 1. 题目知识点标注

AI Agent 分析题目后，从知识点树中查找最相关的知识点进行标注。

```javascript
// Agent 提取题目关键词：["二次函数", "最值"]
const tags = searchKnowledgePoints('二次函数');
// 返回：[{ id: 'kp_001', name: '二次函数基础', ... }]
```

### 2. 难度评估

根据知识点的 `difficultyContribution` 和数量计算题目难度。

```javascript
const totalDifficulty = tags.reduce(
  (sum, kp) => sum + kp.difficultyContribution,
  0
);
const difficulty = Math.min(5, Math.ceil(totalDifficulty));
```

### 3. 知识点推荐

基于题目关联的知识点，推荐相关学习内容。

```javascript
// 获取知识点的父节点和兄弟节点
const parent = knowledgePoints.find(kp => kp.id === tag.parentId);
const siblings = knowledgePoints.filter(kp => kp.parentId === tag.parentId);
```

### 4. 知识体系可视化

前端展示知识点树形结构，供用户浏览和选择。

```javascript
// 使用 buildTree() 构建树，传给前端组件渲染
const tree = buildTree(knowledgePoints);
```

## 数据质量说明 (Data Quality Notes)

- ✅ 所有知识点都有 `id`, `subjectId`, `name`
- ⚠️ 部分知识点的 `description` 为空字符串
- ⚠️ `commonProblemTypes` 和 `relatedFormulas` 大部分为空数组
- ✅ `children` 字段已自动生成，确保树形结构完整

## 版本历史 (Version History)

- **v1.0** (2026-02-15): 初始版本，从 SQLite 数据库导出

## 相关文件 (Related Files)

- `catalogs.json` - 科目/目录数据
- `catalogs.schema.md` - 科目数据结构说明
- `quiz-analyzer.db` - SQLite 数据库（源数据）
