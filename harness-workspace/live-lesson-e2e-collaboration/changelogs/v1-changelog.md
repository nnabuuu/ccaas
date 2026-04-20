# v1 Changelog

## 改动文件
- `solutions/business/live-lesson/backend/src/lesson/lesson.service.ts` — 添加 `onModuleInit` DB 自动播种机制，从 `../data/lessons/*/manifest.json` 读取课程数据并写入 SQLite
- `solutions/business/live-lesson/backend/data/` — 创建 SQLite 数据目录

## 对应维度
- D1: 解决 `GET /api/lessons` 返回空数组的问题 → 现在包含 `ideal-beauty-reading`（+3 分）
- D2: 后端 join/submit 管道已验证通过（pipeline 本身无 bug，只是缺少种子数据）
- D3: SSE stream 首条消息包含 metrics，broadcast 在 join/submit 后触发
- D5: 幂等 join 返回相同 studentId，upsert submit 更新数据，step=5 返回 400，空 name 返回 400

## 根因分析
代码审查发现后端管道（join→submit→state→stream）实现正确，SSE broadcast、幂等 join、upsert submit、输入校验全部工作正常。唯一的关键缺失是 **DB 播种机制**：
- `LessonService` 没有 `onModuleInit`，SQLite 的 `lessons` 表在 TypeORM `synchronize` 后为空
- `GET /api/lessons` 返回 `{"lessons":[]}` — 不包含 `ideal-beauty-reading`
- 这会导致 D1 检查 "grep ideal-beauty-reading" 直接失败

## 验证结果
全部 10 项 API 管道测试通过：
1. JOIN → 200 + studentId ✓
2. STEP 0-3 submit → `{ok:true}` ✓
3. GET /state → 4 个 submissions ✓
4. SSE stream → 首条包含 metrics ✓
5. 幂等 join → 相同 studentId ✓
6. step=5 → HTTP 400 ✓
7. 空 name → HTTP 400 ✓
8. Frontend tsc --noEmit ✓
9. Frontend vite build ✓
10. Backend nest build ✓

## 本轮重点
添加 DB 自动播种，修复 `GET /api/lessons` 返回空数组导致的 D1 评分失败。
