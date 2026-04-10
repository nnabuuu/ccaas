# v2 Changelog

## 改动文件
- `solutions/business/article-analyzer/backend/tsconfig.json` — 添加 `esModuleInterop: true`，修复 better-sqlite3 默认导入在 CJS 运行时崩溃（`TypeError: better_sqlite3_1.default is not a constructor`）
- `solutions/business/article-analyzer/backend/src/database/database.module.ts` — 从 1 行常量重构为完整的 `@Global() @Module` 类，含 `forRoot()` 工厂方法：创建 DB、启用 WAL、创建 schema（6 张表 + 3 索引），新增 `step_outputs` 和 `artifacts` 表
- `solutions/business/article-analyzer/backend/src/main.ts` — 移除所有 DB 初始化逻辑（47 行 → 9 行），改为调用 `AppModule.forRoot()` 无参版本
- `solutions/business/article-analyzer/backend/src/app.module.ts` — 改为从 `DatabaseModule.forRoot()` 获取 DB 实例；移除 `ArticleModule` 导入，改为直接注册 `ArticleController`/`RunController`/`ArticleService`（修复 NestJS DI 无法解析 `Orchestrator` 的问题）
- `solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts` — `saveStepOutput`/`getStepOutput` 改为 SQLite 持久化（`step_outputs` 表）；`saveArtifact`/`getLatestArtifact` 改为 SQLite 持久化（`artifacts` 表）；移除 in-memory Maps

## 对应维度
- D1 (TypeScript 编译): 保持 0 错误（backend + frontend）
- D5 (SQLite 持久化): DatabaseModule 从 stub 重构为完整 NestJS 模块；stepOutputs/artifacts 持久化到 SQLite
- D6 (端到端验证): 添加 `esModuleInterop: true` 修复运行时崩溃 + 修复 DI 解析错误，服务器成功启动并响应 API 请求

## 本轮重点
修复 D6 运行时崩溃（1-line tsconfig fix + DI 结构调整），使 backend 完全可用：启动成功、路由注册、API 可调用。

## 本轮跳过
- D2 (HarnessModule 集成): 已满分，无需改动
- D3 (Article 管理 API): 已满分，无需改动
- D4 (前端功能): 已满分，无需改动
