# 科目/目录数据结构说明 (Catalogs Schema)

## 用途 (Purpose)

存储科目、目录、章节等分类信息，用于题目归类和知识点组织。

This file stores subject, catalog, and chapter classification information for quiz categorization and knowledge point organization.

## 数据文件 (Data File)

- **文件名**: `catalogs.json`
- **大小**: ~27MB
- **记录数**: 116,235 个目录条目

⚠️ **数据质量说明**: 数据中存在大量重复的目录名（同名但不同 ID），可能来自多个教材版本或年级的相同章节。

## 顶层结构 (Top-Level Structure)

```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-15",
  "totalCount": 116235,
  "subjects": [...]
}
```

### 字段说明 (Top-Level Fields)

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 数据格式版本号 |
| `lastUpdated` | string | 最后更新日期 (YYYY-MM-DD) |
| `totalCount` | number | 科目/目录总数 |
| `subjects` | array | 科目/目录数组（详见下文） |

## 科目/目录对象结构 (Subject/Catalog Object)

```json
{
  "id": "e47b7954-62df-4b74-830d-7902259b61a8",
  "name": "八年级上册",
  "code": null,
  "description": "",
  "gradeLevels": [],
  "hasFormula": false,
  "createdAt": "2026-02-05 18:17:44"
}
```

### 字段说明 (Subject Fields)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 唯一标识符 (UUID) |
| `name` | string | ✅ | 科目/目录名称（如 "八年级上册"、"第1章"） |
| `code` | string/null | ❌ | 科目代码（大部分为 null） |
| `description` | string | ❌ | 描述（大部分为空字符串） |
| `gradeLevels` | array | ✅ | 年级范围列表（大部分为空数组 `[]`） |
| `hasFormula` | boolean | ✅ | 是否包含公式（false/true） |
| `createdAt` | string | ✅ | 创建时间（ISO 8601 格式） |

## 数据特点 (Data Characteristics)

### 1. 层级关系不明确

与知识点不同，科目/目录数据**没有显式的父子关系字段**（无 `parentId`）。层级关系需要通过名称解析：

```javascript
// 示例层级结构（通过名称推断）
"八年级上册"              // Level 1: 年级/学期
  → "第1章 走进实验室"   // Level 2: 章
    → "1 走进实验室"     // Level 3: 节
```

### 2. 重复条目

同一名称可能对应多个 ID（不同教材版本或科目）：

```json
[
  { "id": "uuid-1", "name": "*10.4 三元一次方程组的解法" },
  { "id": "uuid-2", "name": "*10.4 三元一次方程组的解法" },
  { "id": "uuid-3", "name": "*10.4 三元一次方程组的解法" }
]
```

### 3. 元数据缺失

大部分字段为空或默认值：
- `code`: 大部分为 `null`
- `description`: 大部分为空字符串
- `gradeLevels`: 大部分为空数组 `[]`
- `hasFormula`: 大部分为 `false`

## 查询方法 (Query Methods)

### 1. 按名称模糊搜索 (Fuzzy Search by Name)

```javascript
function searchCatalogs(keyword) {
  return subjects.filter(s => s.name.includes(keyword));
}

// 示例：搜索 "八年级"
const results = searchCatalogs('八年级');
// 返回所有包含 "八年级" 的目录
```

### 2. 按年级筛选 (Filter by Grade)

```javascript
function findByGradeLevel(gradeLevel) {
  return subjects.filter(s =>
    s.gradeLevels.includes(gradeLevel) ||
    s.name.includes(gradeLevel)
  );
}

// 示例：查找初中内容
const juniorHighSchool = findByGradeLevel('初中');
```

### 3. 去重查询 (Deduplicate)

```javascript
function getUniqueCatalogs() {
  const nameMap = new Map();
  subjects.forEach(s => {
    if (!nameMap.has(s.name)) {
      nameMap.set(s.name, s);
    }
  });
  return Array.from(nameMap.values());
}

// 去重后约 ~1-5 万条（取决于去重策略）
```

### 4. 提取层级路径 (Extract Hierarchical Path)

```javascript
function extractPath(catalogName) {
  // 示例：从 "第1章 走进实验室" 提取路径
  const parts = catalogName.split(/[章节]/);
  return parts.map(p => p.trim());
}

// "第1章 走进实验室" → ["第1", "走进实验室"]
```

## 使用场景 (Use Cases)

### 1. 题目归类

根据题目内容或知识点，自动匹配所属目录。

```javascript
// Agent 分析题目后，查找相关目录
const catalogs = searchCatalogs('二次函数');
// 返回：[{ id: 'uuid', name: '第二章 二次函数' }]
```

### 2. 知识点关联

将知识点与目录建立关联，通过 `subjectId` 字段。

```javascript
// 知识点 "二次函数基础" 关联到目录 "第二章 二次函数"
knowledgePoint.subjectId = catalog.id;
```

### 3. 学习路径构建

根据目录层级，构建学习路径。

```javascript
// 提取年级 → 章 → 节的路径
const path = extractPath(catalog.name);
// ["八年级上册", "第1章", "1"]
```

### 4. 前端目录树展示

虽然数据没有显式层级，但可以通过名称解析构建树形结构。

```javascript
function buildCatalogTree(catalogs) {
  // 简单的层级推断（基于名称前缀）
  const tree = {};
  catalogs.forEach(c => {
    const parts = c.name.split(/第|章|节/);
    // 构建树形结构...
  });
  return tree;
}
```

## 与知识点的关联 (Relationship with Knowledge Points)

知识点通过 `subjectId` 字段关联到目录：

```javascript
// 查找知识点所属的目录
const catalog = subjects.find(s => s.id === knowledgePoint.subjectId);

// 查找某个目录下的所有知识点
const knowledgePointsInCatalog = knowledgePoints.filter(
  kp => kp.subjectId === catalogId
);
```

## 数据质量说明 (Data Quality Notes)

### ✅ 优点

- 所有记录都有 `id` 和 `name`
- 名称规范，便于文本解析

### ⚠️ 缺点

- **大量重复**：同名条目多达数百个
- **元数据缺失**：`code`, `description`, `gradeLevels` 大部分为空
- **无显式层级**：需要通过名称推断父子关系
- **数据量大**：11 万+条目，但去重后可能仅 1-5 万

### 💡 改进建议

1. **去重处理**：合并同名条目，减少冗余
2. **补充元数据**：添加 `gradeLevel`, `subjectType` 等字段
3. **建立层级关系**：添加 `parentId` 字段，建立显式的树形结构
4. **标准化命名**：统一命名规范（如 "第1章" vs "1章"）

## 查询性能建议 (Query Performance Tips)

### 1. 索引优化

在使用时，建议构建内存索引：

```javascript
// 按名称索引
const nameIndex = new Map();
subjects.forEach(s => {
  if (!nameIndex.has(s.name)) {
    nameIndex.set(s.name, []);
  }
  nameIndex.get(s.name).push(s);
});

// 快速查询
const results = nameIndex.get('八年级上册') || [];
```

### 2. 去重缓存

如果只需要唯一名称，建议在启动时去重并缓存：

```javascript
const uniqueCatalogs = getUniqueCatalogs();
// 缓存到内存，避免重复查询
```

### 3. 模糊搜索优化

对于模糊搜索，考虑使用 Trie 树或倒排索引：

```javascript
// 构建倒排索引（关键词 → 目录列表）
const invertedIndex = {};
subjects.forEach(s => {
  const keywords = s.name.split(/\s+/);
  keywords.forEach(kw => {
    if (!invertedIndex[kw]) {
      invertedIndex[kw] = [];
    }
    invertedIndex[kw].push(s);
  });
});

// 快速查询
const results = invertedIndex['八年级'] || [];
```

## 版本历史 (Version History)

- **v1.0** (2026-02-15): 初始版本，从 SQLite 数据库导出

## 相关文件 (Related Files)

- `knowledge-points.json` - 知识点数据
- `knowledge-points.schema.md` - 知识点数据结构说明
- `quiz-analyzer.db` - SQLite 数据库（源数据）
