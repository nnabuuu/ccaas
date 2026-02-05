# CCAAS Documentation

Welcome to the Claude Code as a Service (CCAAS) documentation. This documentation is organized into several sections to help you find what you need quickly.

## 📚 Documentation Structure

### [GitBook](gitbook/) - Comprehensive Platform Documentation
Main documentation for the CCAAS platform, available in English and Chinese.

- **[English](gitbook/en/)** - Full English documentation
- **[中文](gitbook/zh/)** - 完整中文文档

Topics covered:
- Platform overview and architecture
- Getting started guides
- Developer guides (Solutions, Skills, MCP Servers)
- API reference (REST, WebSocket, Types)
- Best practices and migration guides

### [Implementation](implementation/) - Feature Implementation Guides
Detailed implementation documentation for various platform features:

- **[Attachments](implementation/attachments/)** - File attachment system implementation
- **[Subagents](implementation/subagents/)** - Background agent system
- **[File Explorer](implementation/file-explorer/)** - Workspace file browser UI
- **[Skills](implementation/skills/)** - Skill system enhancements
- **[API Integration](implementation/api-integration/)** - Backend API integrations

### [Testing](testing/) - Testing Documentation
Testing guides and procedures:

- Backend testing guides
- Integration test documentation
- Test coverage requirements

### [Design](design/) - Design Documents
Architecture and design decision documents:

- API design specifications
- Feature design documents
- System architecture diagrams

### [Reference](reference/) - Quick References
Quick reference guides for developers:

- API quick reference
- Common patterns
- Troubleshooting checklists

## 🚀 Quick Links

### For New Users
1. [What is LoopAI?](gitbook/zh/README.md) (中文) / [What is LoopAI?](gitbook/en/README.md) (English)
2. [Installation Guide](gitbook/zh/getting-started/installation.md)
3. [5-Minute Quickstart](gitbook/zh/getting-started/quickstart.md)

### For Developers
1. [Solution Development Guide](gitbook/zh/guide/solution-dev.md)
2. [Skill Writing Guide](gitbook/zh/guide/skill-writing.md)
3. [Frontend Integration Guide](gitbook/zh/guide/frontend.md)
4. [API Reference](gitbook/zh/api/README.md)

### For Contributors
1. [Best Practices](SOLUTION_BEST_PRACTICES.md)
2. [write_output Guidelines](BEST_PRACTICE_WRITE_OUTPUT.md)
3. [Testing Guide](testing/BACKEND_SUBAGENT_TESTING_GUIDE.md)

## 📖 Documentation by Role

### Solution Developers
- [Solution Development Guide](gitbook/zh/guide/solution-dev.md) - Complete guide to building solutions
- [MCP Server Development](gitbook/zh/guide/mcp-server.md) - Create custom MCP servers
- [File Explorer Component](gitbook/zh/guide/file-explorer.md) - Use the file browser UI
- [Best Practices](SOLUTION_BEST_PRACTICES.md)

### Frontend Developers
- [Frontend Integration Guide](gitbook/zh/guide/frontend.md)
- [File Explorer Implementation](implementation/file-explorer/)
- [WebSocket Events](gitbook/zh/api/websocket.md)
- [@ccaas/common Types](gitbook/zh/api/shared-types.md)

### Backend Developers
- [REST API Endpoints](gitbook/zh/api/rest.md)
- [Session Workspace API](design/session-workspace-file-api.md)
- [Backend Testing Guide](testing/BACKEND_SUBAGENT_TESTING_GUIDE.md)

### Skill Writers
- [Skill Writing Guide](gitbook/zh/guide/skill-writing.md)
- [write_output Best Practices](gitbook/zh/guide/write-output.md)
- [Skill Implementation Examples](implementation/skills/)

## 🔍 Finding Specific Topics

### Platform Capabilities
- [Core Capabilities](gitbook/zh/platform/capabilities.md)
- [Human-in-the-Loop](gitbook/zh/platform/value.md)
- [Solution Showcase](gitbook/zh/platform/solutions.md)

### API Documentation
- [REST API](gitbook/zh/api/rest.md) - HTTP endpoints
- [WebSocket API](gitbook/zh/api/websocket.md) - Real-time events
- [Shared Types](gitbook/zh/api/shared-types.md) - TypeScript interfaces

### Implementation Features
- [Attachment System](implementation/attachments/) - File upload/download
- [Subagent System](implementation/subagents/) - Background agents
- [File Explorer](implementation/file-explorer/) - Workspace file browser
- [File Service Integration](implementation/api-integration/CCAAS_FILE_SERVICE_INTEGRATION.md)

### Testing & Quality
- [Backend Testing](testing/BACKEND_SUBAGENT_TESTING_GUIDE.md)
- [Best Practices](SOLUTION_BEST_PRACTICES.md)
- Test coverage requirements in individual packages

## 📝 Document Organization

```
docs/
├── README.md (this file)          # Main documentation index
├── gitbook/                       # GitBook documentation
│   ├── en/                        # English version
│   └── zh/                        # Chinese version
├── implementation/                # Implementation guides
│   ├── attachments/
│   ├── subagents/
│   ├── file-explorer/
│   ├── skills/
│   └── api-integration/
├── testing/                       # Testing documentation
├── design/                        # Design documents
├── reference/                     # Quick references
├── articles/                      # Technical articles
├── SOLUTION_BEST_PRACTICES.md     # Solution development best practices
├── BEST_PRACTICE_WRITE_OUTPUT.md  # write_output usage guide
└── SOLUTION_DEVELOPER_GUIDE.md    # Comprehensive developer guide
```

## 🌐 Language Availability

Most documentation is available in both English and Chinese:
- **English**: [`docs/gitbook/en/`](gitbook/en/)
- **中文**: [`docs/gitbook/zh/`](gitbook/zh/)

## 🔗 External Resources

- **GitHub Repository**: [anthropics/claude-code](https://github.com/anthropics/claude-code)
- **Claude API Docs**: [docs.anthropic.com](https://docs.anthropic.com)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## 📮 Contributing to Documentation

Found an issue or want to improve the docs? Here's how:

1. **Typos/Fixes**: Submit a PR with the fix
2. **New Features**: Add implementation docs in `implementation/`
3. **API Changes**: Update both `gitbook/en/` and `gitbook/zh/`
4. **Examples**: Add to relevant solution directories

## 🔄 Documentation Updates

This documentation is continuously updated. Check the git history for recent changes:

```bash
git log -- docs/
```

## 💡 Need Help?

- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anthropics/claude-code/discussions)
- **Email**: support@anthropic.com

---

**Last Updated**: 2026-02-05
**Version**: Platform v1.0.0
