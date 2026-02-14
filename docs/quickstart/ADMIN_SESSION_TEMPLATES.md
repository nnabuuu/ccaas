# Quick Start: Session Templates Admin

**Time**: 5 minutes | **Prerequisites**: Admin API key

## What are Session Templates?

Session Templates let you pre-configure agent behavior (system prompts, skills, MCP servers) and reuse them across your application without hardcoding in frontend code.

## Step 1: Create an Admin API Key

```bash
# In packages/backend directory
export TENANT_ID=your-tenant-id

# Create admin API key
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"name\": \"Admin Key\",
    \"scopes\": [\"admin\"]
  }"
```

**Save the returned `rawKey` - it's only shown once!**

## Step 2: Access Admin Dashboard

1. Start the admin frontend:
   ```bash
   npm run dev:admin
   ```

2. Open browser: `http://localhost:5175`

3. Login with your admin API key

## Step 3: Create a Template

1. Navigate to **Session Templates** in sidebar

2. Click **"Create Template"** button

3. Fill in the form:
   - **Name**: `teacher-assistant` (lowercase, hyphens only)
   - **Description**: `Teacher view with full analysis features`

4. Go to **System Prompt** tab:
   ```
   You are an educational analyst assistant helping teachers.

   Your role:
   - Analyze student work and provide insights
   - Suggest teaching strategies
   - Provide curriculum alignment
   ```

5. Go to **Skills** tab:
   ```
   knowledge-matching, complete-analysis
   ```

6. Click **Save**

## Step 4: Use Template in Frontend

```typescript
import { useAgentChat } from '@ccaas/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    sessionTemplate: 'teacher-assistant', // ← Use your template
  })

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={() => chat.sendMessage(message)}>
        Send
      </button>
    </div>
  )
}
```

**That's it!** The agent will now use your configured system prompt and skills.

## Step 5: Create a Second Template for Students

Same steps but different configuration:

- **Name**: `student-practice`
- **Description**: `Student view with limited features`
- **System Prompt**: `You are a study buddy helping students learn...`
- **Skills**: `simple-hints` (more limited than teacher view)

## Switching Templates

```typescript
const [viewMode, setViewMode] = useState<'teacher' | 'student'>('student')

const chat = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'your-tenant-id',
  sessionTemplate: viewMode === 'teacher'
    ? 'teacher-assistant'
    : 'student-practice',
})
```

Now you have different agent behaviors for different user roles!

## Common Use Cases

### 1. Multi-tenant SaaS

```typescript
// Each tenant gets their own configured templates
useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: 'default-assistant',
})
```

### 2. A/B Testing

```typescript
const template = Math.random() > 0.5
  ? 'variant-a'
  : 'variant-b'

useAgentChat({ sessionTemplate: template })
```

### 3. Role-based Templates

```typescript
const templateMap = {
  admin: 'admin-assistant',
  teacher: 'teacher-assistant',
  student: 'student-practice',
}

useAgentChat({
  sessionTemplate: templateMap[user.role],
})
```

## Next Steps

- **[Full Documentation](../features/SESSION_TEMPLATES_ADMIN.md)** - Complete API reference
- **[Template Best Practices](../guides/SESSION_TEMPLATE_BEST_PRACTICES.md)** - Design patterns
- **[Troubleshooting](../features/SESSION_TEMPLATES_ADMIN.md#troubleshooting)** - Common issues

## Tips

✅ **DO**:
- Use descriptive template names (`teacher-analysis`, not `template1`)
- Document your templates in descriptions
- Test templates before deploying
- Use different templates for different user roles

❌ **DON'T**:
- Use uppercase or spaces in template names
- Put secrets in system prompts (they're stored in database)
- Create duplicate templates (use edit instead)
- Change template names (delete + create to rename)
