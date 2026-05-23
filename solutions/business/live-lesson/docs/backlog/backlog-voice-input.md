# Backlog: Voice Input — Push-to-Talk Mic Button via Doubao ASR

**Status**: Backlog (deferred)
**Created**: 2026-05-01

> **⚠️ Note (2026-05-24):** This backlog was written before the clean-arch refactor. Paths like `backend/src/classroom/asr.service.ts` should now target `backend/src/application/ai/asr.service.ts` (or wherever an ASR service naturally fits in the new layout). Controllers go in `backend/src/adapters/http/`. Module wiring goes in `backend/src/infra/classroom.module.ts`. See [CLAUDE.md](../../CLAUDE.md) "Backend Architecture" for the current layer map.

## Summary

Add an actual microphone button to student text inputs using **Doubao-ASR (火山引擎大模型语音识别)** for speech-to-text. Push-to-talk interaction, bilingual (en/zh) auto-detect.

## Integration Points

Voice input needed in 3 components:
- `DiscussPhase.tsx` — probe textarea, follow-up textarea, extra discussion input
- `MatrixExercise.tsx` — what/why inputs per non-demo row
- `MapExercise.tsx` — reason textarea per placed card

## Architecture

```
Browser (MediaRecorder → PCM 16kHz)
  → POST /api/classroom/:code/asr
  → Backend AsrService
  → WebSocket → wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
  → text → HTTP response → Browser appends to input
```

## Key Details

- **Doubao ASR endpoint**: `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`
- **Auth**: `appid` + `token` + `cluster=volcengine_streaming_asr`
- **Audio**: PCM 16-bit, 16kHz, mono, ~200ms chunks
- **Env vars needed**: `VOLCENGINE_ASR_APPID`, `VOLCENGINE_ASR_TOKEN`
- **Console setup**: [豆包语音控制台](https://console.volcengine.com/speech/app) → 创建应用 → 开通大模型流式语音识别
- **API docs**: [大模型流式语音识别API](https://www.volcengine.com/docs/6561/1354869)

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/classroom/asr.service.ts` | NEW — Doubao ASR WebSocket client |
| `backend/src/classroom/classroom.controller.ts` | Add POST :code/asr endpoint |
| `backend/src/classroom/classroom.module.ts` | Register AsrService + Multer |
| `frontend/src/hooks/useAudioRecorder.ts` | NEW — mic capture → PCM 16kHz |
| `frontend/src/components/student/MicButton.tsx` | NEW — push-to-talk button |
| `frontend/src/components/student/DiscussPhase.tsx` | Add MicButton to 3 inputs |
| `frontend/src/components/student/exercises/MatrixExercise.tsx` | Add MicButton + focus tracking |
| `frontend/src/components/student/exercises/MapExercise.tsx` | Add MicButton per card |
| `frontend/src/styles/student.css` | Add .stu-mic-btn styles |
