# Tool Usage Display — Progress

## v1-v6: Old 6-Dimension Rubric (D1:25 D2:20 D3:15 D4:15 D5:15 D6:10)

| Version | Score | D1 | D2 | D3 | D4 | D5 | D6 | Key Changes |
|---------|-------|----|----|----|----|----|----|-------------|
| v1 | 68 | 20 | 16 | 9 | 9 | 6 | 8 | Full rewrite: removed borders, monochrome SVGs, inline style |
| v2 | 83 | 25 | 20 | 12 | 9 | 9 | 8 | Font size 14px, tool-specific labels, internal label translation, Glob/Grep input simplification |
| v3 | 95* | 25 | 20 | 15 | 15 | 12 | 8 | Auto-collapse groups, output path shortening, Chinese labels throughout |
| v4 | 88 | 25 | 16 | 12 | 15 | 12 | 8 | Colored category badges (M/AI/F), English safety fallbacks, comprehensive label mapping |
| v5 | 91 | 25 | 16 | 15 | 15 | 12 | 8 | Agent input simplification (raw JSON → "描述:/类型:"), MCP key-value display |
| v6 | 95 | 25 | 20 | 15 | 15 | 12 | 8 | Contextual output labels (命令输出/文件内容), SPEC D2 alignment, Error→错误 |

*v3 score was inflated (user rejected: "这不行"). Real score ~85. v4 scores recalibrated honestly.

## v7+: New 7-Dimension Rubric (D1:20 D2:15 D3:15 D4:10 D5:15 D6:10 D7:15)

| Version | Score | D1 | D2 | D3 | D4 | D5 | D6 | D7 | Key Changes |
|---------|-------|----|----|----|----|----|----|-------|-------------|
| v7 | 95 | 20 | 15 | 15 | 10 | 12 | 8 | 15 | Send button position fix (margin-left:auto when attach hidden) |
