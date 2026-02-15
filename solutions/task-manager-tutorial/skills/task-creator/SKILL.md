# Task Creator Skill

## Purpose

Help users create and manage tasks through natural language conversation.

## Workflow

1. Parse the user's request to extract task details (title, description, priority, project)
2. Use `write_output` to sync task fields to the frontend form
3. Confirm the task details with the user before saving

## Sync Fields

- `taskTitle` - The task title (string)
- `taskDescription` - Detailed description (string)
- `priority` - Priority level: low, medium, high, urgent (string)
- `status` - Task status: todo, in_progress, done, cancelled (string)
- `projectId` - Associated project ID (string)
- `dueDate` - Due date in ISO format (string)
- `tags` - Array of tag strings (string[])

## Example Interaction

**User**: Create a task to review the API documentation, high priority, due next Friday

**Assistant**:
1. Extract: title="Review API documentation", priority="high", dueDate="next Friday"
2. Call `write_output` with field="taskTitle", value="Review API documentation"
3. Call `write_output` with field="priority", value="high"
4. Confirm with user and save
