# v1 Changelog

## 改动文件

### Backend
- `backend/src/classroom/dto/step.dto.ts` — 新建，StepDto (step: 0-4)
- `backend/src/classroom/dto/notify.dto.ts` — 新建，NotifyDto (message + type)
- `backend/src/classroom/dto/ai-ask.dto.ts` — 新建，AiAskDto (studentId + question + step)
- `backend/src/classroom/classroom.service.ts` — 新增 currentStepMap、setStep()、notify()、aiAsk()、broadcastNamed()
- `backend/src/classroom/classroom.controller.ts` — 新增 POST /step、POST /notify、POST /ai/ask 三个端点

### Frontend
- `frontend/src/hooks/useClassroom.ts` — 新增 useStudentStream hook (addEventListener 监听命名事件)
- `frontend/src/components/teacher/TeacherShell.tsx` — step rail/action 按钮调 API；quick-push 按钮绑定 apiNotify；Timer 倒计时实现
- `frontend/src/components/student/StudentShell.tsx` — 接入 useStudentStream；step_sync 自动切步；notification toast 显示
- `frontend/src/components/student/AiPanel.tsx` — 新增 lessonId/studentId/step props；sendCustom 调 POST /ai/ask + loading 状态
- `frontend/src/styles/student.css` — 新增 .stu-toast 通知样式

## 对应维度
- D1: 三个新端点全部可达 (POST /step, /notify, /ai/ask)，backend nest build 通过，frontend tsc 通过
- D2: Teacher step rail onClick → API → SSE step_sync → Student 自动切步；"进入 Step N →" 和 "← 上一步" 也调 API
- D3: 4 个 quick-push 按钮绑定预设消息 → API → SSE notification → Student toast 显示 (5s 自动消失)
- D4: AiPanel sendCustom → POST /ai/ask → 后端关键词匹配回答 → loading 状态 → 渲染 Q&A
- D5: Timer 使用 setInterval 1s 倒计时，显示 MM:SS 格式；"延长 2 min" 按钮增加 extraMinutes
- D6: broadcast() 方法完全未改动；useTeacherStream 的 es.onmessage 不受影响；join/submit/state/stream 端点未变

## 本轮重点
首轮完整实现 4 个 feature group (Step Sync、Push Notifications、AI Ask、Timer)，所有改动保持向后兼容。
