# Bulk Import Skill

## Purpose

Import multiple tasks at once from text input, CSV data, or structured lists.

## Workflow

1. Parse the user's input to extract multiple tasks
2. Validate each task has at least a title
3. Use `write_output` to sync each task to the frontend
4. Provide a summary of imported tasks

## Supported Input Formats

### Plain Text List
```
- Review API docs
- Fix login bug
- Update deployment script
```

### CSV Format
```
title,priority,project
Review API docs,high,Backend
Fix login bug,urgent,Frontend
Update deployment script,medium,DevOps
```

### Numbered List
```
1. Review API docs (high priority)
2. Fix login bug (urgent)
3. Update deployment script
```

## Example Interaction

**User**: Import these tasks:
- Review API docs (high)
- Fix login bug (urgent)
- Write unit tests

**Assistant**:
1. Parse 3 tasks from the input
2. Create each task via the API
3. Report: "Successfully imported 3 tasks"
