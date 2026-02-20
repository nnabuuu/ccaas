# KedgeAgentic Documentation

Welcome to the KedgeAgentic (即见Agentic) documentation.

## 📚 Documentation Structure

### [Guides](guides/) - Solution Development Tutorials

Step-by-step guides for creating KedgeAgentic solutions:

- **[Solution Quick Start](guides/SOLUTION_QUICK_START.md)** - Create a solution in 10 minutes
- **[Creating a Solution - Complete Guide](guides/CREATING_A_SOLUTION.md)** - Comprehensive solution development guide
- **[File Upload Customization](guides/FILE_UPLOAD_CUSTOMIZATION.md)** - File attachment system guide
- **[Solution Troubleshooting](guides/solution-troubleshooting.md)** - Debugging common issues
- **[Migrating to Solution Lib](guides/migrating-to-solution-lib.md)** - Migration guide

### [SDK Documentation](sdk/) - Client SDK Libraries

Complete documentation for React and Vue SDK client libraries:

- **[SDK Comparison](sdk/SDK_COMPARISON.md)** - Feature comparison between React and Vue SDKs
- **[Choosing an SDK](sdk/CHOOSING_SDK.md)** - Decision guide for selecting the right SDK
- **[Migration Guide](sdk/MIGRATION_GUIDE.md)** - Upgrading and migrating between SDKs

**React SDK Documentation:**
- **[API Reference](../packages/react-sdk/docs/API.md)** - Complete API for hooks and components
- **[Advanced Patterns](../packages/react-sdk/docs/ADVANCED_PATTERNS.md)** - Custom hooks, error handling, state management
- **[Troubleshooting](../packages/react-sdk/docs/TROUBLESHOOTING.md)** - Common issues and debugging

**Vue SDK Documentation (Bilingual 双语):**
- **[API Reference](../packages/vue-sdk/docs/API.md)** | **[API 参考](../packages/vue-sdk/docs/API_ZH.md)**
- **[Advanced Patterns](../packages/vue-sdk/docs/ADVANCED_PATTERNS.md)** | **[高级模式](../packages/vue-sdk/docs/ADVANCED_PATTERNS_ZH.md)**
- **[Architecture](../packages/vue-sdk/docs/ARCHITECTURE_EN.md)** | **[架构文档](../packages/vue-sdk/docs/ARCHITECTURE.md)**

### [GitBook](gitbook/) - Comprehensive Platform Documentation

Main documentation for the KedgeAgentic platform, available in English and Chinese.

- **[English](gitbook/en/)** - Full English documentation
- **[中文](gitbook/zh/)** - 完整中文文档

Topics covered:
- Platform overview and architecture
- Getting started guides
- Developer guides (Solutions, Skills, MCP Servers)
- API reference (REST, WebSocket, Types)
- Best practices and migration guides

### [ADR](adr/) - Architecture Decision Records

Key architectural decisions and their rationale:

- **[0001](adr/0001-core-must-not-contain-domain-entities.md)** - Core must not contain domain entities
- **[0002](adr/0002-rest-resource-naming-principles.md)** - REST resource naming principles
- **[0003](adr/0003-tenant-level-mcp-server-management.md)** - Tenant-level MCP server management
- **[0004](adr/0004-single-entry-point-for-messages.md)** - Single entry point for messages
- **[0006](adr/0006-ai-assisted-development-workflow.md)** - AI-assisted development workflow
- **[0007](adr/0007-messaging-hierarchy-and-resource-ownership.md)** - Messaging hierarchy and resource ownership
- **[0009](adr/0009-conversation-persistence-architecture.md)** - Conversation persistence architecture
- **[0011](adr/0011-solution-json-v3-simplification.md)** - Solution.json v3 simplification

### [Advanced](advanced/) - Internal Implementation Guides

Deep-dive documentation for platform internals:

- **[SSE Session Event Flow](advanced/SSE_SESSION_EVENT_FLOW.md)** - Complete REST/SSE message pipeline with sequence diagrams
- **[AgentEngine Lifecycle](advanced/AGENT_ENGINE_LIFECYCLE.md)** - CLI process management details
- **[Engine Integration Guide](advanced/ENGINE_INTEGRATION_GUIDE.md)** - Implementing custom AgentEngine types

### [Testing](testing/) - Testing Documentation

- **[Backend SubAgent Testing Guide](testing/BACKEND_SUBAGENT_TESTING_GUIDE.md)**
- **[FilesView Testing Guide](testing/FILESVIEW_TESTING_GUIDE.md)**
- **[AgentActivityLine Testing Guide](testing/AGENTACTIVITYLINE_TESTING_GUIDE.md)**
- **[Manual Test Instructions](testing/MANUAL_TEST_INSTRUCTIONS.md)**

### [Design & Designs](design/) - Design Documents

- **[Session Workspace File API](design/session-workspace-file-api.md)** - API design spec
- **[Admin Sessions Phase 2 PRD](designs/admin-sessions-phase-2-prd.md)**
- **[Sync Card Optimization](designs/sync-card-optimization-design.md)**

### [Migration](migration/) - Migration Guides

- **[Solution JSON v2 → v3](migration/solution-json-v2-to-v3.md)**

---

## 🚀 Quick Links

### For Solution Developers
1. **[Solution Quick Start](guides/SOLUTION_QUICK_START.md)** - 10-minute tutorial
2. **[Creating a Solution](guides/CREATING_A_SOLUTION.md)** - Complete guide with tenant setup, MCP, skills
3. **[Solution Best Practices](SOLUTION_BEST_PRACTICES.md)**
4. **[Auto Discovery](AUTO_DISCOVERY.md)** - solution.json v3 format reference
5. **[Skill Frontmatter](SKILL_MD_FRONTMATTER.md)** - SKILL.md format reference
6. **[MCP REST Migration](SOLUTION_MCP_REST_MIGRATION.md)** - stdio → REST API migration

### For Frontend Developers
1. **[SDK Documentation](sdk/)** - Client SDK libraries for React & Vue
2. **[Frontend Integration Guide](gitbook/zh/guide/frontend.md)**
3. **[SSE Event Flow](advanced/SSE_SESSION_EVENT_FLOW.md)** - Understanding the event pipeline

### For Backend Developers
1. **[REST API Endpoints](gitbook/zh/api/rest.md)**
2. **[Session Workspace API](design/session-workspace-file-api.md)**
3. **[SSE Session Event Flow](advanced/SSE_SESSION_EVENT_FLOW.md)**
4. **[ADR Index](adr/README.md)** - Architectural decisions

### For Skill Writers
1. **[Skill Writing Guide](gitbook/zh/guide/skill-writing.md)**
2. **[Skill Frontmatter Spec](SKILL_MD_FRONTMATTER.md)**
3. **[write_output Best Practices](BEST_PRACTICE_WRITE_OUTPUT.md)**

---

## 📝 Document Organization

```
docs/
├── README.md                      # This file
│
├── adr/                           # Architecture Decision Records
├── advanced/                      # Internal implementation deep-dives
├── design/                        # API design specs
├── designs/                       # Feature design docs & PRDs
├── external/                      # Partner/client-facing materials (Chinese)
├── features/                      # Feature-specific documentation
├── gitbook/                       # Full platform docs (EN + ZH)
├── guides/                        # Step-by-step developer tutorials
├── migration/                     # Migration guides between versions
├── prd/                           # Product requirement documents
├── quickstart/                    # Quick start references
├── sdk/                           # SDK comparison & selection guides
├── testing/                       # Testing guides & procedures
│
├── AUTO_DISCOVERY.md              # solution.json auto-discovery spec
├── BEST_PRACTICE_WRITE_OUTPUT.md  # write_output tool guidelines
├── CONVERSATION_PERSISTENCE.md    # Conversation persistence architecture
├── DEVELOPMENT_PRINCIPLES.md      # Core development principles
├── PROJECT_MANAGEMENT_GUIDE.md    # When & how to create docs
├── SKILL_MD_FRONTMATTER.md        # SKILL.md frontmatter spec
├── SOLUTION_BEST_PRACTICES.md     # Solution development best practices
├── SOLUTION_DEVELOPER_GUIDE.md    # Comprehensive developer guide
├── SOLUTION_MCP_REST_MIGRATION.md # MCP stdio → REST migration guide
├── SOLUTION_TEMPLATE.md           # Solution scaffolding template
└── WORKFLOW.md                    # Development workflow guide
```

---

## 🌐 Language Availability

Most documentation is available in both English and Chinese:
- **English**: [`docs/gitbook/en/`](gitbook/en/)
- **中文**: [`docs/gitbook/zh/`](gitbook/zh/) and [`docs/zh/`](zh/)

## 🔗 External Resources

- **Claude API Docs**: [docs.anthropic.com](https://docs.anthropic.com)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
