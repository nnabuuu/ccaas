# attach_file Tool Implementation

## Overview

The `attach_file` tool has been successfully implemented in the MCP server, allowing Claude to attach generated files (teaching scripts, audio, PPT, PDF, etc.) to lesson plans.

## Implementation Details

### MCP Server Changes

**File:** `mcp-server/src/index.ts`

**New Tool Definition:**
```typescript
const attachFileTool: Tool = {
  name: 'attach_file',
  description: 'Attach a generated file to the current lesson plan',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to file in session workspace' },
      fileType: { type: 'string', enum: ['script', 'audio', 'ppt', 'pdf', 'other'] },
      description: { type: 'string', description: 'Optional file description' }
    },
    required: ['filePath', 'fileType']
  }
}
```

**Handler Implementation:**
The handler performs the following steps:
1. Resolves the file path relative to the session workspace (process.cwd())
2. Checks if the file exists using `fs.existsSync()`
3. Gets file metadata using `fs.statSync()` (size, modification time)
4. Infers MIME type from file extension
5. Creates a `LessonPlanAttachment` object with:
   - Unique attachment ID (UUID)
   - Placeholder file ID (to be replaced by backend)
   - File name, type, size, MIME type
   - Placeholder download URL
   - Upload timestamp
   - Optional description
6. Returns result in the same format as `write_output`:
   ```json
   {
     "data": {
       "field": "attachments",
       "value": [{ ...attachment }],
       "preview": "📎 教学讲稿.md (15KB)"
     },
     "status": "success"
   }
   ```

**Special Fields:**
- `_originalPath`: Non-standard field added to help backend locate and copy the file from session workspace to persistent storage

## Usage Example

### Teaching Script Workflow

```typescript
// Step 1: Generate teaching script content
const scriptContent = "# 教学讲稿\n\n## 第一章节\n...";

// Step 2: Save as both extraProperties (for inline viewing) and file (for downloading)
write_output({
  field: 'extraProperties',
  value: { '讲稿': scriptContent },
  preview: '📝 教学讲稿 (2500字)'
});

// Step 3: Write the file to workspace
Write({
  file_path: '教学讲稿.md',
  content: scriptContent
});

// Step 4: Attach the file
attach_file({
  filePath: '教学讲稿.md',
  fileType: 'script',
  description: '教学讲稿 - 包含9个章节的完整授课指南'
});
```

**Result:** User sees TWO sync buttons:
1. "同步到表单" - Syncs text to extraProperties['讲稿']
2. "添加附件" - Syncs file to attachments array

### Audio File Workflow

```typescript
// After NotebookLM generates audio file
attach_file({
  filePath: '教学讲解音频.mp3',
  fileType: 'audio',
  description: '教学讲解音频 - 基于教学讲稿生成的中文讲解'
});
```

**Result:** User sees ONE sync button:
- "添加附件" - Syncs audio file to attachments array

### PPT File Workflow

```typescript
// After PPTX skill generates PowerPoint
attach_file({
  filePath: '教学PPT.pptx',
  fileType: 'ppt',
  description: '教学PPT - 包含8-12页幻灯片'
});
```

**Result:** User sees ONE sync button:
- "添加附件" - Syncs PPT file to attachments array

## File Type Mapping

| Extension | File Type | MIME Type |
|-----------|-----------|-----------|
| .md, .txt | script | text/markdown, text/plain |
| .mp3 | audio | audio/mpeg |
| .wav | audio | audio/wav |
| .ogg | audio | audio/ogg |
| .m4a | audio | audio/mp4 |
| .ppt | ppt | application/vnd.ms-powerpoint |
| .pptx | ppt | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| .pdf | pdf | application/pdf |
| others | other | application/octet-stream |

## Error Handling

**File Not Found:**
```json
{
  "data": {
    "error": "File not found: 教学讲稿.md"
  },
  "status": "error"
}
```

**Missing Required Parameters:**
Tool call will fail with MCP validation error if `filePath` or `fileType` is missing.

## Integration with CCAAS Backend

The attach_file tool returns data in the same format as write_output, which means:

1. **EventMapper** will receive the tool result
2. **output_update event** will be emitted to frontend with:
   ```typescript
   {
     field: 'attachments',
     value: [{ ...attachment, _originalPath: 'path/to/file' }],
     preview: '📎 教学讲稿.md (15KB)'
   }
   ```
3. **Frontend** will display sync button with preview text
4. **User clicks sync** → Frontend calls `PATCH /lesson-plans/:id/field`
5. **Backend** receives the attachment data including `_originalPath`
6. **Backend should**:
   - Copy file from session workspace to persistent storage
   - Generate real fileId (AgentFile record)
   - Replace placeholder fileId and downloadUrl
   - Save to lesson_plans.attachments column

## Backend Integration Requirements

The backend needs to be enhanced to handle the `_originalPath` field when syncing attachments:

```typescript
// In lesson-plans.service.ts patchField method
if (field === 'attachments' && Array.isArray(value)) {
  const processedAttachments = await Promise.all(
    value.map(async (att) => {
      if (att._originalPath) {
        // Copy file from session workspace to persistent storage
        const agentFile = await this.filesService.copyFromWorkspace({
          sessionId: currentSessionId,
          workspacePath: att._originalPath,
          messageId: currentMessageId,
          tenantId: currentTenantId,
        });

        // Return attachment with real file ID and download URL
        return {
          ...att,
          fileId: agentFile.id,
          downloadUrl: `/api/v1/files/${agentFile.id}/download`,
          size: agentFile.size,
          _originalPath: undefined, // Remove temp field
        };
      }
      return att;
    })
  );

  value = processedAttachments;
}
```

## Testing

### Build Verification
```bash
cd mcp-server
npm run build  # ✅ Builds successfully
```

### Manual Testing Checklist
- [ ] Create a test file in session workspace
- [ ] Call attach_file with the file path
- [ ] Verify tool returns success with attachment metadata
- [ ] Verify file size is calculated correctly
- [ ] Verify MIME type is inferred correctly
- [ ] Verify error handling for non-existent files
- [ ] Test with different file types (script, audio, ppt, pdf)

## Next Steps

1. **Backend Enhancement**: Implement file copying logic in backend when processing attachments
2. **Frontend UI**: Create AttachmentCard component to display attachments
3. **Skill Updates**: Update teaching-script-generator skill to use attach_file
4. **Integration Testing**: End-to-end test of the full workflow

## Known Limitations

1. **Placeholder IDs**: The tool generates placeholder UUIDs for fileId. Backend must replace these with real AgentFile IDs.
2. **File Persistence**: Files remain in session workspace until backend copies them to persistent storage.
3. **No File Validation**: Tool doesn't validate file content, only checks existence.
4. **Session Dependency**: Requires session workspace to be accessible via process.cwd().

## Compatibility

- ✅ Backward compatible - existing tools continue to work
- ✅ Type-safe - uses TypeScript interfaces from types.ts
- ✅ Follows existing patterns - mimics write_output tool structure
- ✅ No breaking changes to API contracts
