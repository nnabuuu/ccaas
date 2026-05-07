# Teacher Console v6 — 变更说明

## 核心理念

从"Step = 一个任务"变为"Step = 一个教学阶段（Phase）"，每个 Phase 内含多个子任务（Listen → Practice → Discuss → Takeaway）。教师既能宏观看进度，也能展开看细节。

---

## 1. Step 展开 = 子任务分层

**之前 (v4)**：Step 卡片点击弹出 modal，显示统计信息。学生 dots 平铺在 Step 卡片上，无法区分学生在 Step 内的具体位置。

**现在 (v6)**：
- **收起状态**：显示 Step 名称 + 人数 badge + 学生 dots（笼统）
- **展开状态**：显示 4 个子任务行（Listen / Practice / Discuss / Takeaway），每行下方显示该子任务的学生 dots
- 教师一眼能看到"26 人在 S3"中，18 人卡在 Practice，4 人已进入 Discuss，4 人已到 Takeaway
- 子任务行用颜色标签区分阶段类型

## 2. 子任务可点击 → 进入 Observe 视图

- Practice 和 Discuss 行支持点击，直接打开对应的 observe 页面
- Hover 时右侧出现「查看 →」提示
- 链接对应关系：
  - S1 Practice → `mc-observe.html`（选择题观察）
  - S2 Practice → `evidence-observe.html`（证据选取观察）
  - S3 Practice → `map-observe.html`（信息矩阵观察）
  - S4 Practice → `evidence-observe.html`
  - S5 Practice → `mc-observe.html`
  - 所有 Discuss → `discuss-observe.html`（AI 对话观察）

## 3. 右侧面板 Tab 化

**之前 (v4)**：右侧只有"问题聚类"，"观察要点"在左侧占大量空间。

**现在 (v6)**：右侧分为 4 个 Tab：

| Tab | 内容 |
|-----|------|
| **问题聚类** | 按分类（概念理解/课文内容/解题求助/阅读策略）聚合学生提问，可展开看 AI 回答 |
| **观察要点** | 实时 alert（紧急/警告）+ 知识指标条 + 历史观察记录 |
| **学生状态** | 按状态分组（卡住/活跃/顺畅/已完成）的学生 chip |
| **教学参考** | AI 生成的教学建议卡片，按优先级排列 |

## 4. 左侧极简化

左侧只保留：
- **健康卡**（4 格：最快进度、中位进度、卡点学生、AI 对话）
- **课堂进程**（可折叠的 Step 列表 + 进度分布条）

教学参考从左侧移到右侧 Tab，减少左侧滚动压力。

---

## 信息架构对比

```
v4 左侧                          v6 左侧
├─ 健康卡                        ├─ 健康卡
├─ 课堂进程（Step 卡片）          └─ 课堂进程（Step 卡片）
│   └─ 点击 → modal                  └─ 展开 → 子任务行
├─ 观察要点（alerts + 指标）              └─ 点击 → observe 页面
└─ 教学参考

v4 右侧                          v6 右侧
└─ 问题聚类                      ├─ Tab: 问题聚类
                                 ├─ Tab: 观察要点
                                 ├─ Tab: 学生状态
                                 └─ Tab: 教学参考
```

## 交互变化

| 操作 | v4 | v6 |
|------|----|----|
| 查看 Step 详情 | 点击 → 弹出 modal | 点击 → 原地展开子任务 |
| 查看某个任务的班级数据 | 无直接入口 | 点击子任务行 → 打开 observe 页面 |
| 查看观察要点 | 左侧滚动找到 | 右侧切 Tab |
| 查看教学建议 | 左侧底部折叠面板 | 右侧切 Tab |
