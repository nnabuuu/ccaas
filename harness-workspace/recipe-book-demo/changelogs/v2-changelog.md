# v2 Changelog

## 修改文件
- `solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` — 新增 `block_attr_set` 和 `block_content_set` 操作处理分支，更新 blocks 保存条件以覆盖 block ops
- `solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts` — 新增 3 个测试：frontmatter-only 编辑保留块属性、block_attr_set 修改 callout color、block_content_set 更新 callout text

## 对应维度
- D1 (TransformRegistry 自定义): 满分，未改动
- D2 (Surgical Diff): 新增 frontmatter-only preservation test (+4)
- D3 (Dual Edit Path): 新增 block_attr_set handler + test (+3)，block_content_set handler + test (+3)
- D4 (CCAAS 租户接入): 满分，未改动
- D5 (Solution 完整性): 满分，28 tests passing，tsc clean

## 本轮重点
修复 v1 eval 中全部 3 个扣分项（D2 frontmatter test、D3 block_attr_set、D3 block_content_set），预期 100/100。
