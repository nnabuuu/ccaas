# Image-to-LEGO Mosaic Converter 前端开发需求

## 项目概述
构建一个 Web 应用前端，将用户上传的图片转换为可建造的 LEGO 马赛克设计。后端 API 已完成，前端需要对接这些 API 并提供直观的用户界面。

## 技术栈要求
- **框架**: React 18+ with TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS v4
- **状态管理**: Zustand
- **Canvas渲染**: Konva.js (react-konva) - 用于马赛克预览
- **路由**: React Router v6
- **HTTP客户端**: Axios 或原生 fetch

## API 端点 (后端已实现)

### 1. 一次性转换
```http
POST /api/v1/convert
Content-Type: multipart/form-data

请求:
- image: File (必填, JPEG/PNG/WebP, <10MB)
- width_studs: number (8-128, 默认48)
- height_studs: number (8-128, 默认48)
- layer_count: number (2-3, 默认2)
- color_palette: number[] (可选, BrickLink颜色ID)
- brick_pool: string[] (可选, BrickLink零件ID)
- llm_provider: "auto"|"openai"|"claude"|"gemini" (默认auto)

响应:
{
  success: true,
  mosaic: Mosaic,
  processing_time_ms: number,
  warnings?: string[]
}
```

### 2. 会话管理 (迭代模式)
```http
POST /api/v1/sessions          # 创建会话
GET /api/v1/sessions/:id       # 获取会话状态
POST /api/v1/sessions/:id/decision  # 提交决定 (approve/reject/refine)
GET /api/v1/sessions/:id/history    # 获取迭代历史
POST /api/v1/sessions/:id/abandon   # 放弃会话
```

### 3. 目录数据
```http
GET /api/v1/colors             # 获取所有LEGO颜色
GET /api/v1/colors/defaults    # 获取默认颜色
GET /api/v1/bricks             # 获取所有砖块类型
GET /api/v1/bricks/defaults    # 获取默认砖块
```

## 核心数据类型

```typescript
interface LegoColor {
  bricklink_id: number;
  name: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hex_color: string;
  is_transparent: boolean;
  is_metallic: boolean;
}

interface BrickPart {
  bricklink_id: string;
  part_type: 'plate' | 'tile' | 'wedge' | 'slope' | 'brick';
  width_studs: number;
  height_studs: number;
  coverage_pattern: Array<{ x: number; y: number }>;
  is_rectangular: boolean;
}

interface Placement {
  brick_id: string;
  color_id: number;
  x: number;
  y: number;
  layer: number;  // 0 = 底层
  rotation: 0 | 90 | 180 | 270;
}

interface BillItem {
  brick_id: string;
  color_id: number;
  quantity: number;
}

interface Mosaic {
  width_studs: number;
  height_studs: number;
  layer_count: number;
  placements: Placement[];
  bill_of_materials: BillItem[];
  metadata: {
    total_brick_count: number;
    unique_colors_used: number;
    coverage_percent: number;
  };
}

interface LLMAssessment {
  overallScore: number;      // 0.0-1.0
  colorAccuracy: number;
  structuralIntegrity: number;
  visualAppeal: number;
  summary: string;
  issues: string[];
  suggestions: RefinementSuggestion[];
}

interface RefinementSuggestion {
  type: 'color' | 'placement' | 'structure' | 'coverage';
  priority: number;
  description: string;
  region?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

type SessionStatus = 'in_progress' | 'approved' | 'abandoned' | 'expired';
type DecisionType = 'approve' | 'reject' | 'refine';

interface Session {
  session_id: string;
  status: SessionStatus;
  config: SessionConfig;
  current_iteration: number;
  max_iterations: number;
  current_result?: IterationResult;
  created_at: string;
  updated_at: string;
}

interface SessionConfig {
  width_studs: number;
  height_studs: number;
  layer_count: number;
  color_palette?: number[];
  brick_pool?: string[];
  llm_provider?: 'auto' | 'openai' | 'claude' | 'gemini';
}

interface IterationResult {
  iteration_number: number;
  mosaic: Mosaic;
  preview_url?: string;
  llm_assessment?: LLMAssessment;
  processing_time_ms: number;
  created_at: string;
}
```

## 页面结构

### 页面 1: 首页 (`/`)
- 大型拖拽上传区域，支持点击选择
- 支持 JPEG, PNG, WebP (最大10MB)
- 上传后显示图片预览和尺寸
- 两个按钮: [快速转换] 和 [开始迭代会话]

### 页面 2: 配置页 (`/configure`)
- **尺寸设置**: 宽度/高度滑块 (8-128格)，预设按钮 (16x16, 32x32, 48x48, 64x64)
- **层数选择**: 2层或3层 (单选)
- **颜色选择器**: 40色网格，可搜索，支持透明/金属色过滤
- **砖块选择器**: 按类型过滤 (plate/tile等)
- **高级选项**: 重采样算法、背景色、LLM提供商
- [生成马赛克] 按钮

### 页面 3: 审核页 (`/session/:id`)
- **顶部**: 迭代时间线 (水平滚动卡片)
- **左侧**: 马赛克预览 (Canvas渲染)
  - 层切换按钮
  - 缩放/平移控制
  - 网格线开关
- **右侧**: 评估面板
  - 总分仪表盘
  - 分项得分条
  - 问题列表
  - 改进建议
- **底部**: 决定按钮
  - [✓ 批准] (绿色)
  - [✗ 拒绝] (红色)
  - [↻ 改进] (蓝色，打开反馈表单)

### 页面 4: 结果页 (`/result/:id`)
- 最终马赛克预览
- 物料清单 (BOM) 表格
  - 按颜色或砖块分组
  - 可排序
  - 总砖块数
- 导出按钮: [下载PNG] [导出CSV] [在BrickLink打开]

## 关键组件

### 1. ImageUpload
- 拖拽区域 + 文件选择按钮
- 上传进度条
- 图片预览 (带尺寸信息)
- 客户端验证 (类型、大小)

### 2. MosaicPreview
- 使用 Konva.js 的 Canvas 渲染
- 每个格子按 LEGO 颜色填充
- 支持多层显示/隐藏切换
- 缩放 (fit/100%/放大/缩小)
- 平移拖拽
- 可选: 点击砖块高亮 BOM 对应行

### 3. BillOfMaterials
- 表格列: 颜色色块+名称, 砖块类型, 数量
- 分组切换: 按颜色 / 按砖块
- 导出 CSV 按钮
- 生成 BrickLink Wanted List

### 4. AssessmentPanel
- 圆形进度条显示总分
- 分项条形图 (颜色准确度、结构完整性、视觉吸引力)
- 问题列表 (可折叠)
- 建议列表 (带优先级徽章)

### 5. IterationTimeline
- 水平滚动卡片列表
- 每张卡片: 缩略图 + 分数 + 决定图标
- 点击切换查看历史迭代

## 状态管理 (Zustand Store)

```typescript
interface AppState {
  // 上传
  sourceImage: {
    file: File | null;
    preview: string | null;
    dimensions: { width: number; height: number } | null;
  };

  // 配置
  config: {
    widthStuds: number;
    heightStuds: number;
    layerCount: 2 | 3;
    colorPalette: number[];
    brickPool: string[];
    llmProvider: 'auto' | 'openai' | 'claude' | 'gemini';
  };

  // 目录 (应用启动时加载一次)
  catalog: {
    colors: LegoColor[];
    bricks: BrickPart[];
    loading: boolean;
  };

  // 会话
  session: {
    id: string | null;
    status: SessionStatus | null;
    currentIteration: number;
    iterations: IterationResult[];
    loading: boolean;
  };

  // 当前结果
  currentResult: {
    mosaic: Mosaic | null;
    assessment: LLMAssessment | null;
  };

  // UI状态
  ui: {
    visibleLayers: boolean[];
    previewZoom: number;
    bomGroupBy: 'color' | 'brick';
  };

  // Actions
  uploadImage: (file: File) => void;
  setConfig: (config: Partial<Config>) => void;
  startSession: () => Promise<void>;
  submitDecision: (decision: DecisionType, feedback?: string) => Promise<void>;
  quickConvert: () => Promise<void>;
}
```

## UI/UX 要求

### 响应式设计
- 移动端 (<768px): 垂直堆叠布局
- 平板 (768-1024px): 适度调整
- 桌面 (>1024px): 双栏布局

### 加载状态
- 上传时显示进度条
- API调用时显示骨架屏或spinner
- 转换过程显示步骤提示 ("上传中...", "处理图片...", "生成布局...")

### 错误处理
- 表单字段内联错误提示
- API错误使用 Toast 通知
- 提供重试按钮
- 不可恢复错误提供"重新开始"选项

### 无障碍 (WCAG 2.1 AA)
- 键盘可访问所有交互元素
- 颜色对比度 ≥ 4.5:1
- 表单标签关联
- 图片有 alt 文本
- 颜色选择器需有文字标签

## 性能要求

- 马赛克预览必须使用 Canvas，不能用 DOM 元素
- 颜色/砖块列表需虚拟滚动 (>100项)
- 配置滑块变化需防抖 (300ms)
- 图片上传前生成缩略图预览 (最大800px宽)
- API 请求超时: 上传30秒，其他60秒
- 失败重试: 指数退避 (1s, 2s, 4s)

## 目录结构

```
frontend/
├── src/
│   ├── components/
│   │   ├── ImageUpload/
│   │   ├── ConfigPanel/
│   │   ├── MosaicPreview/
│   │   ├── BillOfMaterials/
│   │   ├── AssessmentPanel/
│   │   ├── IterationTimeline/
│   │   └── common/ (Button, Card, Modal, Toast等)
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Configure.tsx
│   │   ├── Review.tsx
│   │   └── Results.tsx
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useCatalog.ts
│   │   └── useMosaicRenderer.ts
│   ├── services/
│   │   └── api.ts
│   ├── store/
│   │   └── appState.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── colors.ts
│   │   └── export.ts
│   ├── App.tsx
│   └── main.tsx
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## 开始提示

1. 先创建项目结构和路由
2. 实现 API 客户端和类型定义
3. 创建 Zustand store
4. 按页面顺序实现组件:
   - Home (上传) → Configure (配置) → Review (审核) → Results (结果)
5. 最后添加响应式样式和无障碍特性

API 基础路径: `http://localhost:3000/api/v1`

请生成完整的前端代码，包括所有页面和组件。
