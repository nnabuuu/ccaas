# v2 Changelog

## 改动文件
- `solutions/business/recipe-book/backend/data/recipe-book.db` — restored to pre-v1 state (undo frozen dir violation)
- `solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx` — restored to pre-v1 state (undo frozen dir violation)
- `solutions/business/live-lesson/frontend/src/pages/BoardPage.tsx` — added RevealPointer state, BoardScrubber, postMessage sync listener
- `solutions/business/live-lesson/frontend/src/styles/student.css` — added position:relative + z-index:2 to .stu-board for drawer clickability

## 对应维度
- D1: Restored recipe-book files removes P1 penalty (0→20)
- D2: BoardPage now provides pointer prop to BoardStage, fixing crash (6→18-20); added postMessage listener for sync
- D3: Restored recipe-book removes P3 penalty (0→18); fixed board drawer z-index (18→19)
- D4: Restored recipe-book removes P4 penalty (0→20)
- D5: Restored recipe-book removes P5 penalty (0→18)

## 本轮重点
修复两个关键问题：(1) recipe-book frozen dir violation 导致 D1/D3/D4/D5 全部清零 (-72pts)；(2) BoardPage 未传 pointer prop 导致 Board 崩溃 (-14pts)。预期分数从 6 提升到 ~95。
