# Mermaid Diagram Rendering Scripts

Temporary scripts for generating PNG diagrams from Mermaid code blocks in markdown files.

## Scripts

### extract_and_render_mermaid.py
Extracts Mermaid code blocks from markdown and renders them to local PNG files.

**Usage**:
```bash
python tools/debug/extract_and_render_mermaid.py
```

**Requirements**:
```bash
npm install -g @mermaid-js/mermaid-cli
```

**Process**:
1. Extracts all ````mermaid` code blocks from source markdown
2. Saves each block to `mermaid_diagrams/diagram_N.mmd`
3. Renders each using `mmdc` command to PNG
4. Creates new markdown with local image references

### render_mermaid.py
**Status**: Deprecated (replaced by extract_and_render_mermaid.py)

Initial attempt using mermaid.ink online API (had network issues with pandoc).

---

## Status

These scripts were used for one-time documentation generation and may be deleted after the documentation workflow is stabilized.
