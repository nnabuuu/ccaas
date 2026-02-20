# External Documentation

This directory contains documentation for external partners and clients.

## Files

### 即见平台介绍与集成指南.md
Original markdown version of the platform introduction and integration guide.

### 即见平台介绍与集成指南_带图.md
Version with online Mermaid diagrams (using mermaid.ink API).

### 即见平台介绍与集成指南_完整版.md
Final version with local rendered diagrams for PDF generation.

### mermaid_diagrams/
Contains all Mermaid diagram sources (.mmd) and rendered PNG images used in the documentation.

## Purpose

These materials are designed for:
- Partner integration meetings
- Third-party team onboarding
- Platform capability demonstrations
- Technical integration guidance

## Language

Chinese (中文)

## Maintenance

When updating the integration guide:
1. Edit the source markdown file
2. Update Mermaid diagrams if needed (in mermaid_diagrams/)
3. Re-render diagrams using extract_and_render_mermaid.py
4. Regenerate PDF using pandoc

See scripts/temp/ for diagram rendering tools.
