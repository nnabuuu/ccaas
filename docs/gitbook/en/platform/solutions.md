# Solution Showcase

Solutions are vertical applications built on the KedgeAgentic platform. Each Solution includes a dedicated frontend interface, business backend, MCP tools, and AI Skills, demonstrating the platform's capabilities across different domains.

## Lesson Plan Designer

### Overview

Teachers describe their lesson design standards once in a Skill. The AI applies them consistently across every request, connected to curriculum resources via MCP — no re-prompting required.

### Key Features

- **60/40 Split Layout** -- Lesson plan editor on the left, AI chat on the right
- **Sync Button** -- AI-generated content is applied to the form via a sync button; teachers can accept or modify
- **AI Change Tracking** -- Fields modified by AI are highlighted for easy teacher review
- **Textbook Cascading Selection** -- Subject > Grade > Publisher > Volume > Chapter
- **9 MCP Tools** -- Including write\_output, curriculum standard search, textbook search, teaching resource search, and more

### Technical Highlights

- React 18 + NestJS backend + Socket.io real-time communication
- SQLite data persistence with lesson plan CRUD operations
- Structured output sync across 14 fields (objectives, standards, materials, activities, assessments, differentiated instruction, etc.)

---

## Problem Explainer

### Overview

AI-powered intelligent problem explanation that supports text and image input, automatically generating explanation scripts, audio, and presentations.

### Key Features

- **Five-Stage Workflow** -- Analyze problem > Generate script > Generate audio > Generate PPT > Output files
- **Text/Image Input** -- Supports text descriptions or photo uploads of problems
- **Intelligent Recognition** -- Automatically identifies problem types and knowledge points
- **Step-by-Step Explanation** -- Generates detailed explanations broken down into steps
- **Knowledge Linking** -- Automatically links related knowledge points and practice variations
- **Multi-Format Output** -- Markdown scripts, MP3 audio, PPTX presentations

### Technical Highlights

- REST API-based MCP Server (6 tool endpoints)
- 8 sync fields (problem analysis, key knowledge, solution steps, answer, common mistakes, etc.)
- Automated difficulty assessment formula

---

## CCAAS Demo

### Overview

A demo application showcasing core platform capabilities including Skill management, chat interactions, and file downloads.

### Key Features

- **Skill Management** -- Enable/disable Skill toggles
- **Chat Interface** -- Full AI conversation experience
- **File Downloads** -- Download management for AI-generated files
- **Session Restart** -- One-click session restart

### Built-in Example Skills

- **hello-world** -- Basic greeting Skill
- **report-generator** -- Report generation Skill
- **file-creator** -- File creation Skill

---

## Build Your Own Solution

The KedgeAgentic platform provides a complete Solution development framework, enabling developers to quickly build applications for specific use cases.

For details, see the [Solution Development Guide](../guide/solution-dev.md).

### Standard Solution Structure

```
my-solution/
├── frontend/        # Frontend application
├── backend/         # Business backend (optional)
├── mcp-server/      # MCP tool services
├── skills/          # AI Skill definitions
├── solution.json    # Solution configuration
├── setup.sh         # One-click startup script
└── inject-skills.sh # Skill injection script
```

### Key Configuration -- solution.json

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "Solution description",
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Custom tool services"
    }
  },
  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "Skill description",
      "triggers": [{ "type": "keyword", "value": "keyword" }],
      "allowedTools": ["write_output", "my_tool"],
      "skillFile": "skills/my-skill/SKILL.md"
    }
  ]
}
```
