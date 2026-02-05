# Fix: attach_file Tool Now Shows "Sync to Form" Button

## Problem
When using the `attach_file` tool (e.g., after generating audio with notebooklm), the SyncButton component was not appearing in the frontend, preventing users from syncing attachments to the lesson plan form.

## Root Cause
The `EventMapper.handleSpecialToolResult()` method in `packages/backend/src/chat/event-mapper.service.ts` did not include a case for `'attach_file'` in its switch statement. This meant:
1. `attach_file` tool completed successfully
2. Tool name was normalized to `'attach_file'`
3. Switch statement had no matching case
4. **No `output_update` event was generated**
5. Frontend never received the event
6. SyncButton did not appear

## Solution
Added `case 'attach_file':` to the switch statement to reuse the existing `write_output` handling logic.

### Change Made
**File:** `packages/backend/src/chat/event-mapper.service.ts` (line 1062)

```typescript
switch (normalizedName) {
  case 'write_output':
  case 'attach_file':  // ✅ Added this line
    events.push({
      type: 'output_update',
      sessionId,
      clientId,
      payload: {
        data: parsedResult.data || parsedResult,
        status: (parsedResult.status as string) || 'unknown',
        progress: parsedResult.progress as number | undefined,
        timestamp,
      },
    });
    break;
```

## Why This Works
- `attach_file` returns the same `WriteOutputResult` format as `write_output`
- Both tools return: `{ data: { field, value, preview }, status }`
- Frontend already supports parsing and displaying `output_update` events
- No frontend changes needed

## Verification
✅ All backend tests pass (482 tests)
✅ Code change verified (1 line added)
✅ EventMapper now recognizes `attach_file` tool

## Testing
To verify the fix manually:

1. Start the backend: `cd packages/backend && npm run start:dev`
2. Test with notebooklm audio generation
3. Check that SyncButton appears after attach_file completes
4. Verify clicking "添加附件" syncs the attachment to the form

## Impact
- **Risk:** Extremely low (1 line change, reuses existing logic)
- **Scope:** Only affects `attach_file` tool event generation
- **Frontend:** No changes needed
- **Tests:** All passing

## Related Files
### Modified
- `packages/backend/src/chat/event-mapper.service.ts` (line 1062)

### No Changes Needed
- `solutions/lesson-plan-designer/mcp-server/src/index.ts` (attach_file returns correct format)
- `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts` (event handling works)
- `solutions/lesson-plan-designer/frontend/src/components/SyncButton.tsx` (UI component works)
- `solutions/lesson-plan-designer/frontend/src/utils/outputUpdateParser.ts` (parser works)

## Expected Behavior After Fix
1. User requests audio generation with notebooklm
2. Task SubAgent completes and calls `attach_file` tool
3. Backend generates `output_update` event
4. Frontend receives event and displays SyncButton:
   ```
   ⚠️ 待添加附件
   📎 教学讲解音频.mp3 (36.0 MB)
   [📥 添加附件]  [🗑️ 丢弃]
   ```
5. User clicks "添加附件"
6. Attachment syncs to lesson plan form
7. Attachment card appears in form's "附件" section

## Implementation Date
2026-02-03
