# JTBD Analysis: KedgeAgentic Solutions Optimization

## Context

Using the JTBD (Jobs to Be Done) framework to evaluate all 9 business solutions, combined with **Creator/Consumer user dichotomy**, to assess which are worth optimizing and how.

### Creator vs Consumer Definitions

| Dimension | Creator | Consumer |
|-----------|---------|----------|
| **Job** | "I want to **create** a professional deliverable with AI" | "I want to **receive** results AI prepared for me" |
| **Focus** | Process transparency: MCP tools, Skills, data sources | Result-oriented: just conclusions, patient waiting |
| **Emotional** | Sense of control, professional confidence | Peace of mind, feeling cared for |
| **Social** | "I'm the professional, AI is my tool" | "Someone is helping me" |
| **Typical roles** | Teacher lesson planning, bank credit officer, consultant | Farmer, student, rehab patient |

---

## Business Solutions JTBD Scores

### Scoring Criteria (0-10)

| Dimension | Weight | Assessment |
|-----------|--------|------------|
| Job Statement clarity | 20% | Clear "When [X], I want [Y], so I can [Z]" |
| Creator/Consumer distinction | 25% | Different interactions per role |
| Big Hire / Little Hire | 20% | First experience vs repeated use |
| Forces of Progress | 15% | Reduces Anxiety and Habit barriers |
| Non-obvious competitor awareness | 10% | Understands real competition |
| Emotional + Social dimensions | 10% | Beyond functional layer |

### Rankings

| Rank | Solution | Score | C/C Rating | Optimization ROI |
|------|----------|-------|------------|-----------------|
| 1 | Quiz Analyzer | 7.5 | Best practice | Medium |
| 2 | Smart Agri Service | 7.1 | Has framework, needs execution | **High** |
| 3 | LEGO Playground | 6.8 | Single-user dual-phase | Medium |
| 4 | Live Lesson | 6.2 | Natural dual-role | Medium-High |
| 5 | Lesson Plan Designer | 5.8 | Missing Consumer | **High** |
| 6 | Rehab Motion Renderer | 5.0 | Severely lacking | **Highest** |
| 7 | Problem Explainer | 5.0 | Creator only | Medium |
| 8 | EduAgent | 3.8 | No distinction | Low - consider merge |
| 9 | McKinsey Consultant | 3.8 | No distinction | Low - needs repositioning |

---

## Implementation: Smart Agri Service Creator/Consumer Distinction

### What Was Implemented

**Files Modified:**
- `solutions/business/smart-agri-service/frontend/src/types/index.ts` - Added Consumer/Creator types
- `solutions/business/smart-agri-service/frontend/src/components/ChatPanel.tsx` - Dual rendering

### Consumer Mode (Farmer View)

Friendly progress pipeline that hides technical details:

```
┌─────────────────────────────────┐
│  ✅ 已查询到您的信息            │
│  ✅ 已分析农业经营数据          │
│  ⏳ 正在整理财务状况...         │
│  ○ 匹配适合您的政策            │
│  ○ 生成个性化建议              │
│                                 │
│  💬 请稍等，正在为您整理信息... │
└─────────────────────────────────┘
```

**Design Principles:**
- Tool names replaced with human-readable stage labels
- Three-state progression: pending (gray) -> active (green spinner) -> completed (green check)
- Warm encouragement message during processing
- No technical jargon (no tool names, no timing data)

### Creator Mode (Bank View)

Professional tool chain tracker with data source awareness:

```
┌──────────────────────────────────────┐
│  🔧 工具链追踪                       │
│  ├ ✓ 查询农户信息   farmers表   0.3s │
│  ├ ✓ 获取土地信息   land表      0.2s │
│  ├ ⏳ 获取种植记录  crop表     进行中 │
│  ├ · 获取农机设备              待执行 │
│  ├ · 获取贷款记录              待执行 │
│  ├ · 计算汇总指标              待执行 │
│  ├ · 搜索贷款产品              待执行 │
│  ├ · 获取市场行情              待执行 │
│  └ · 输出分析结果              待执行 │
│                                      │
│  📊 数据源: farmers表, land表...     │
└──────────────────────────────────────┘
```

**Design Principles:**
- Full tool sequence shown upfront with expected order
- Per-tool timing and data source attribution
- write_output call counter (x1, x2... x8)
- Data source summary at bottom
- Professional terminology and monospace font

### Technical Implementation

**Tool Timeline Tracking:**
- `toolTimelineRef` (Map) accumulates all tool events, surviving the SDK's 2-second cleanup
- `seenTools` (derived Set) tracks all tool names ever observed
- `activeToolNames` (derived Set) tracks currently running tools (phase != 'end')
- Timeline resets on viewMode change and new processing round

**Stage Status Computation:**
```
active  = any tool in stage group currently running
completed = any tool in stage group has been seen (but none active)
pending = no tools in stage group observed yet
```

### Emotional Design Differences

| Aspect | Consumer (Farmer) | Creator (Bank) |
|--------|-------------------|----------------|
| Wait message | "正在查询您的信息..." | "查询农户信息 (farmers表)" |
| Error tone | "抱歉出了点问题" | Show toolError + retry |
| Completion | "已生成个性化建议" | "✓ 输出分析结果 x8, 3.2s" |
| Thinking | "正在准备为您服务..." | "正在初始化评估流程..." |
| Data sources | Hidden | "📊 数据源: farmers表, land表..." |

---

## Future Optimization Priorities

### Priority 1: Lesson Plan Designer (Student Consumer View)
- Add "classroom mode" for students consuming lesson content
- Creator mode: show AI reasoning chain for lesson design

### Priority 2: Rehab Motion Renderer (Patient Consumer View)
- Daily training view with animation demos and check-ins
- Creator mode: full rehab plan with contraindications and tool chain

### Priority 3: Live Lesson (Student Consumer Mode)
- Hide technical beat state machine from students
- Show "老师正在为你解答..." instead of tool logs
