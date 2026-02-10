# Temporary Scripts

This directory contains one-time use scripts for documentation generation and maintenance tasks.

## Files

### render_mermaid.py
Initial attempt to render Mermaid diagrams using mermaid.ink online API.
- Status: Deprecated (network issues with pandoc)
- Replaced by: extract_and_render_mermaid.py

### extract_and_render_mermaid.py
Extracts Mermaid code blocks from markdown and renders them to local PNG files.

**Usage:**
```bash
python extract_and_render_mermaid.py
```

**Requirements:**
```bash
npm install -g @mermaid-js/mermaid-cli
```

**Process:**
1. Extracts all ````mermaid` code blocks from source markdown
2. Saves each block to `mermaid_diagrams/diagram_N.mmd`
3. Renders each using `mmdc` command to PNG
4. Creates new markdown with local image references
5. Output: `即见平台介绍与集成指南_完整版.md`

## Maintenance

These scripts are kept for reference but may be deleted after the documentation generation workflow is stabilized.

Consider moving to a permanent `scripts/docs/` directory if they become part of the regular workflow.
