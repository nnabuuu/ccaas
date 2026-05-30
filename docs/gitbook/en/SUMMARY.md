# Table of contents

* [What is KedgeAgentic](README.md)

## Platform Introduction <a href="#platform" id="platform"></a>

* [Platform Overview](platform/README.md)
* [Key Concepts](platform/concepts.md)
* [Core Value: Skills + MCP](platform/value.md)
* [Platform Architecture](platform/architecture.md)
* [Runtime Architecture (sandbox + workspace + materializer)](platform/runtime-architecture.md)
* [Core Capabilities](platform/capabilities.md)
* [Solution Showcase](platform/solutions.md)
* [Pricing](platform/pricing.md)

## Ontology & Workflow <a href="#ontology" id="ontology"></a>

* [Overview](ontology/README.md)
* [What is an Ontology](ontology/what-is-ontology.md)
* [Schema Primitives](ontology/schema-primitives.md)
* [Trigger + Workflow Engine](ontology/trigger-and-workflow-engine.md)
* [Observation Pipeline](ontology/observation-pipeline.md)
* [Indicator Catalog](ontology/indicator-catalog.md)
* [Dashboard Contract](ontology/dashboard-contract.md)
* [Cross-Process Events](ontology/cross-process-events.md)
* [Session Lifecycle](ontology/session-lifecycle.md)

## Getting Started <a href="#getting-started" id="getting-started"></a>

* [Overview](getting-started/README.md)
* [Installation](getting-started/installation.md)
* [5-Minute Quickstart](getting-started/quickstart.md)
* [Local Self-Host (stage-1 sandbox)](getting-started/local-self-host.md)

## Solution Builder Tutorial <a href="#tutorial" id="tutorial"></a>

* [Tutorial Overview](tutorial/README.md)
* [1. Understanding Solution Architecture](tutorial/01-architecture.md)
* [2. Designing the Domain Model](tutorial/02-domain-model.md)
* [3. Mapping User Journeys](tutorial/03-user-journeys.md)
* [4. Data Flow and State Management](tutorial/04-data-flow.md)
* [5. Forms and output\_update Protocol](tutorial/05-form-protocol.md)
* [6. Implementation Walkthrough](tutorial/06-implementation/README.md)
  * [6.1 Project Setup](tutorial/06-implementation/01-setup.md)
  * [6.2 Backend Implementation](tutorial/06-implementation/02-backend.md)
  * [6.3 MCP Server](tutorial/06-implementation/03-mcp-server.md)
  * [6.4 Skills](tutorial/06-implementation/04-skills.md)
  * [6.5 Frontend](tutorial/06-implementation/05-frontend.md)
  * [6.6 Testing](tutorial/06-implementation/06-testing.md)
  * [6.7 Conversation Persistence](tutorial/06-implementation/07-conversation-persistence.md)
* [7. Deployment](tutorial/07-deployment.md)
* [8. Adding Sandbox Capabilities (Advanced)](tutorial/08-sandbox.md)

## Examples <a href="#examples" id="examples"></a>

* [Solution Gallery](examples/README.md)
* [Smart Agri Service](examples/smart-agri-service/README.md)
  * [MCP Design: Multi-Source Data Integration](examples/smart-agri-service/mcp-design.md)
* [McKinsey CLI](examples/mckinsey-cli/README.md)
  * [Pure Skill Design: Zero-MCP Architecture](examples/mckinsey-cli/skill-design.md)
* [Article Analyzer UI/UX Redesign](examples/article-analyzer-ui-redesign.md)
* [Context Layer @ Reference Picker](examples/reference-picker.md)
* [demo-sandbox (sandbox full-stack case)](examples/demo-sandbox.md)

## Developer Guide <a href="#guide" id="guide"></a>

* [Guide Overview](guide/README.md)
* [Core Concepts](guide/concepts.md)
* [Solution Development Guide](guide/solution-dev.md)
* [Builder Flow Tutorial](guide/builder-flow.md)
* [Skill Writing Guide](guide/skill-writing.md)
* [MCP Server Development](guide/mcp-server.md)
* [write\_output Best Practices](guide/write-output.md)
* [Bundles (Capability Packages)](guide/bundles.md)
* [Frontend Integration Guide](guide/frontend.md)
* [Chat Integration with React SDK](guide/chat-integration.md)
* [Interactive Prompting](guide/interactive-prompting.md)
* [Layout System Quick Start](guide/solution-layout-quickstart.md)
* [File Explorer Component](guide/file-explorer.md)
* [Conversation Persistence](guide/conversation-persistence.md)
* [Context Layer](guide/context-layer.md)
* [Harness Engineering](guide/harness-engineering.md)
* [Solution Runtime Extension Points](guide/extending-runtime.md)

## Advanced Configuration <a href="#advanced" id="advanced"></a>

* [Bundles: Advanced Configuration](guide/bundles-advanced.md)
* [Admin API Key Management](guide/admin-api-keys.md)
* [Session Templates Management](guide/admin-session-templates.md)
* [Session Timeout Configuration](guide/admin-session-ttl.md)

## API Reference <a href="#api" id="api"></a>

* [API Overview](api/README.md)
* [REST API Endpoints](api/rest.md)
* [SSE Transport (Recommended)](api/sse.md)
* [WebSocket Events (Deprecated)](api/websocket.md)
* [Error Handling](api/error-handling.md)
* [@kedge-agentic/common Types](api/shared-types.md)
* [Context Layer API](api/context-layer.md)

## Reference <a href="#reference" id="reference"></a>

* [solution.json Reference (v3.0)](reference/solution-json.md)
* [Best Practices](reference/best-practices.md)
* [Runtime REST API (fs + metadata)](reference/runtime-api.md)
* [@kedge-agentic/agent-runtime Package Reference](reference/agent-runtime.md)
