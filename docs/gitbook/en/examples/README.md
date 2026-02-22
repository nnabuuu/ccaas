# Solution Gallery

Real solutions built on KedgeAgentic, each illustrating a distinct architectural pattern. Each entry links to a solution overview and one or more focused sub-pages that explain **why** a design decision was made — not just how to implement it.

---

## Solutions

| Solution | Business Scenario | Interesting Layer | Sub-page |
|----------|------------------|-------------------|----------|
| [Quiz Analyzer](quiz-analyzer/README.md) | AI tags quiz questions with the most specific matching knowledge points from a 31,000-node hierarchy | MCP layer: hierarchical data search with leaf-only filtering | [MCP Design: Hierarchical Data](quiz-analyzer/mcp-design.md) |
| [Lesson Plan Designer](lesson-plan-designer/README.md) | AI assists teachers in designing 14-field lesson plans with human approval before applying changes | Solution protocol: write_output two-step sync | [Form Protocol & SYNC\_FIELDS](lesson-plan-designer/form-protocol.md) |
| [Rehab Motion Renderer](rehab-motion-renderer/README.md) | Medical report → personalized rehab plan rendered as SVG skeleton animations | Output structure: AI decides content, frontend decides presentation | [Dual Output Design](rehab-motion-renderer/dual-output.md) |

---

## How to Read These Examples

Each solution page answers two questions:

1. **What problem does it solve?** — One-sentence business context and a data-flow diagram.
2. **What design is worth borrowing?** — A focused sub-page on the single most transferable architectural decision.

The goal is not to document every file. It is to extract patterns you can apply to your own solutions.
