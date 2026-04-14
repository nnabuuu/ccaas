# v1 Changelog

## 改动文件
- `packages/entity-document/src/transform-registry.ts` — NEW: TransformRegistry class with register/unregister/getTransform/detectTransform/getRegisteredTypes + withDefaults() factory + defaultRegistry singleton
- `packages/entity-document/src/transforms/index.ts` — UPDATE: delegate getTransform/detectTransform to defaultRegistry
- `packages/entity-document/src/serializer.ts` — UPDATE: accept optional registry param, default to defaultRegistry
- `packages/entity-document/src/deserializer.ts` — UPDATE: accept optional registry param, default to defaultRegistry
- `packages/entity-document/src/str-replace.ts` — UPDATE: accept optional registry param, pass to serialize/deserialize
- `packages/entity-document/src/interfaces.ts` — UPDATE: add ContentToAttrConfig type
- `packages/entity-document/src/block-utils.ts` — NEW: generic splitBlockForDocument/mergeBlockForStorage with ContentToAttrConfig param
- `packages/entity-document/src/index.ts` — UPDATE: export TransformRegistry, defaultRegistry, ContentToAttrConfig, splitBlockForDocument, mergeBlockForStorage
- `packages/entity-document/src/__tests__/registry.test.ts` — NEW: 11 tests for TransformRegistry
- `packages/entity-document/src/__tests__/block-utils.test.ts` — NEW: 8 tests for block-utils
- `packages/context-layer/src/core/document-edit-provider.ts` — NEW: abstract DocumentEditProvider base class with serialize/edit orchestration
- `packages/context-layer/src/core/index.ts` — UPDATE: export DocumentEditProvider
- `packages/context-layer/package.json` — UPDATE: add @kedge-agentic/entity-document dependency
- `solutions/business/edu-platform/backend/src/referenceable/block-utils.ts` — REPLACE: thin wrapper (14 lines) delegating to entity-document
- `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts` — UPDATE: extends DocumentEditProvider, implements 5 abstract methods + validateEdit, compacted to 94 lines (target ≤120)
- `solutions/business/edu-platform/backend/src/referenceable/providers/template.provider.ts` — UPDATE: extends DocumentEditProvider, implements 5 abstract methods

## 对应维度
- D1 (现有测试): 57 frozen tests still pass — 0 frozen test files modified
- D2 (TransformRegistry): Full implementation — TransformRegistry class, withDefaults(), defaultRegistry, optional registry params on serialize/deserialize/strReplace, 11 new tests
- D3 (block-utils): Full implementation — generic splitBlockForDocument/mergeBlockForStorage with ContentToAttrConfig, edu wrapper reduced to 14 lines, 8 new tests
- D4 (DocumentEditProvider): Full implementation — abstract base class in context-layer/core, LessonPlanProvider (with validateEdit) and TemplateProvider both extend it
- D5 (包结构): All new exports added to index.ts, no @nestjs imports in entity-document or context-layer/core

## 本轮重点
从 baseline (20/100) 实现全部 4 个 Phase：TransformRegistry + block-utils + DocumentEditProvider + 包导出，新增 19 个测试（共 76 通过），所有约束验证通过。

## 上报问题（如有）
无
