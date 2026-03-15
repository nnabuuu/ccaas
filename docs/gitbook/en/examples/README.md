# Solution Gallery

This section showcases real-world Solutions built on the KedgeAgentic platform, demonstrating different architectural patterns and design approaches.

## Featured Solutions

| Solution | Architecture Pattern | Key Highlight |
|----------|---------------------|---------------|
| [Smart Agri Service](smart-agri-service/README.md) | MCP + Dual Templates | 11 MCP tools, multi-source data integration, dual-persona design |
| [McKinsey CLI](mckinsey-cli/README.md) | Pure Skill, Zero MCP | Single powerful Skill replaces all tools, progressive disclosure |

## Demo Collection

The platform also includes **12 progressive demo examples** covering individual features:

| Demo | Feature Demonstrated |
|------|---------------------|
| 01-pure-chat | Basic AI chat with no tools |
| 02-multi-template | Multiple session templates |
| 03-sse-events | SSE real-time event streaming |
| 04-write-output | Structured output sync to frontend |
| 05-skill-frontmatter | Skill metadata and triggers |
| 06-skill-routing | Multi-skill routing logic |
| 07-workflow-skill | Multi-step workflow Skills |
| 08-output-operations | Output field operations |
| 09-skill-prompt-mode | Skill prompt mode configuration |
| 10-append-prompt | System prompt appending |
| 11-tool-event-triggers | Tool event trigger hooks |
| 12-sync-fields | SYNC_FIELDS real-time synchronization |

Demo source code is available in the public [kedge-agentic/examples](https://github.com/kedge-agentic/examples) repository under `demo/`. Each demo is a pure backend definition (Skills + optional MCP) with no frontend code. Use `setup.sh` to import any demo into `https://ccaas.zhushou.one` (configurable via `.env`), then interact via the REST API.

## How to Read These Examples

Each Solution case study follows a consistent structure:

1. **Architecture Overview** -- System diagram showing component relationships
2. **Key Design Decisions** -- Why the architecture was designed this way
3. **Transferable Patterns** -- What you can reuse in your own Solutions
4. **Deep-Dive Sub-Pages** -- Detailed analysis of specific design aspects

Focus on the **architectural patterns** rather than implementation details -- the same patterns apply across different domains.
