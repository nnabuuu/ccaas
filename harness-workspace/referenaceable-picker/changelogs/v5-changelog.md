# v5 Changelog

## 改动文件
- `solutions/business/edu-platform/backend/src/referenceable/providers/template.provider.ts` — 添加 LESSON_TYPE_MAP（与 lesson-plan.provider.ts 相同映射），修复 buildSummary 和 buildListSummary 中 lesson_type 使用 raw 值的问题；修复 version 双 v 前缀（`v${tpl.version}` → `tpl.version`，因为 TemplateService.toDetail() 已通过 formatVersion() 添加了 v 前缀）
- `solutions/business/edu-platform/backend/src/referenceable/adapters/edu-browse-provider.ts` — 同步修复 template browse/search 中 subtitle 和 summary 的 lesson_type 中文映射（之前只有 lesson_plan 做了映射，template 遗漏）

## 修复的 Bug
1. **lesson_type 中文映射缺失**（template.provider.ts）: summary 显示 "new模板" → 修复为 "新授课模板"。buildSummary 和 buildListSummary 都已修复。
2. **version 双 v 前缀**（template.provider.ts）: summary 显示 "vv1.0" → 修复为 "v1.0"。根因：TemplateService.toDetail() 中 formatVersion(tpl.version) 已将 number 转为 "v1.0"，buildSummary 又加了 `v` 前缀。
3. **browse/search subtitle 未映射**（edu-browse-provider.ts）: browse subtitle 显示 "district new" → 修复为 "district 新授课"；browse summary 同步更新。

## 对应维度
- D4 (数据质量): template summary 中 lesson_type 和 version 修复。browse/search 同步。score 5/5 巩固。

## 冻结约束验证
- core/ 零 NestJS import: 未改动 core
- 现有端点 response 格式不变: 仅 summary/subtitle 内容修正
- TemplateService 源文件不改: 未触碰 template.service.ts
- DB schema 不变: 未改动任何 entity

## 验证结果
- tsc --noEmit: 零错误
- entity summary: "新授课标准模板 (district作用域) 新授课模板 v1.0"（之前 "new模板 vv1.0"）
- browse subtitle: "district 新授课"（之前 "district new"）
- browse summary: "新授课标准模板 district 新授课模板"（之前 "新授课标准模板 district模板"）
