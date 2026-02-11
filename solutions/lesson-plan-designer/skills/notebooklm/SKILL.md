---
name: notebooklm
description: Automate Google NotebookLM - create notebooks, add sources, generate podcasts/videos/quizzes, download artifacts. Activates on explicit /notebooklm or intent like "create a podcast about X"
---
<!-- notebooklm-py v0.2.1 -->


# NotebookLM Automation

Automate Google NotebookLM: create notebooks, add sources, chat with content, generate artifacts (podcasts, videos, quizzes), and download results.

## Installation

**From PyPI (Recommended):**
```bash
pip install notebooklm-py
```

**From GitHub (use latest release tag, NOT main branch):**
```bash
# Get the latest release tag (using curl)
LATEST_TAG=$(curl -s https://api.github.com/repos/teng-lin/notebooklm-py/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
pip install "git+https://github.com/teng-lin/notebooklm-py@${LATEST_TAG}"
```

⚠️ **DO NOT install from main branch** (`pip install git+https://github.com/teng-lin/notebooklm-py`). The main branch may contain unreleased/unstable changes. Always use PyPI or a specific release tag, unless you are testing unreleased features.

After installation, install the Claude Code skill:
```bash
notebooklm skill install
```

## Prerequisites

**IMPORTANT:** Before using any command, you MUST authenticate:

```bash
notebooklm login          # Opens browser for Google OAuth
notebooklm list           # Verify authentication works
```

If commands fail with authentication errors, re-run `notebooklm login`.

### CI/CD, Multiple Accounts, and Parallel Agents

For automated environments, multiple accounts, or parallel agent workflows:

| Variable | Purpose |
|----------|---------|
| `NOTEBOOKLM_HOME` | Custom config directory (default: `~/.notebooklm`) |
| `NOTEBOOKLM_AUTH_JSON` | Inline auth JSON - no file writes needed |

**CI/CD setup:** Set `NOTEBOOKLM_AUTH_JSON` from a secret containing your `storage_state.json` contents.

**Multiple accounts:** Use different `NOTEBOOKLM_HOME` directories per account.

**Parallel agents:** The CLI stores notebook context in a shared file (`~/.notebooklm/context.json`). Multiple concurrent agents using `notebooklm use` can overwrite each other's context.

**Solutions for parallel workflows:**
1. **Always use explicit notebook ID** (recommended): Pass `-n <notebook_id>` (for `wait`/`download` commands) or `--notebook <notebook_id>` (for others) instead of relying on `use`
2. **Per-agent isolation:** Set unique `NOTEBOOKLM_HOME` per agent: `export NOTEBOOKLM_HOME=/tmp/agent-$ID`
3. **Use full UUIDs:** Avoid partial IDs in automation (they can become ambiguous)

## Agent Setup Verification

Before starting workflows, verify the CLI is ready:

1. `notebooklm status` → Should show "Authenticated as: email@..."
2. `notebooklm list --json` → Should return valid JSON (even if empty notebooks list)
3. If either fails → Run `notebooklm login`

## When This Skill Activates

**Explicit:** User says "/notebooklm", "use notebooklm", or mentions the tool by name

**Intent detection:** Recognize requests like:
- "Create a podcast about [topic]"
- "Summarize these URLs/documents"
- "Generate a quiz from my research"
- "Turn this into an audio overview"
- "Add these sources to NotebookLM"
- "Generate slides from my research" (when sources exist)

## NotebookLM vs PPTX Skill - When to Use Which

**Use NotebookLM for slides when:**
- ✅ User wants slides **generated from existing sources/content** (research, documents, URLs)
- ✅ Content-driven slides (NotebookLM analyzes sources and creates slides automatically)
- ✅ Quick slide generation from research or documentation
- ✅ Output as **PDF slides** is acceptable (using `slide-deck`)
- ❌ NOT for study guides (study-guide produces Markdown, not PDF)
- Example: "Create slides from these research papers", "Generate a slide deck summarizing this content"

**Use lesson-plan-pptx (or example-skills:pptx) for slides when:**
- ✅ User wants **custom-designed slides** with specific layout/branding
- ✅ Design-focused slides (specific colors, fonts, visual elements)
- ✅ PowerPoint (.pptx) format is required
- ✅ Teaching-specific slides with interactive elements, activities, etc.
- Example: "Create teaching PPT", "Design slides for this lesson", "Make a presentation about [topic]" (no sources)

**Default behavior in lesson plan context:**
- If user says "生成PPT" or "创建课件" or "做PDF" → Use **lesson-plan-pptx** (teaching-focused, .pptx format)
- If user says "用NotebookLM生成幻灯片" → Use **NotebookLM slide-deck** (content-driven, .pdf format)
- If user says "生成学习指南" or "做学习资料" → Use **NotebookLM study-guide** (text-based, .md format)
- If user has added sources to NotebookLM and asks for slides → Use **NotebookLM slide-deck**
- If unclear, prefer **lesson-plan-pptx** for teaching context

## Response Language

**CRITICAL:** Match the user's input language in ALL aspects of the workflow.

### 1. Claude's Responses
- If user writes in **Chinese** (中文), respond in Chinese
- If user writes in **English**, respond in English
- Match the user's language for all explanations, progress updates, and artifact descriptions

### 2. NotebookLM Instructions (Most Important!)
When calling `notebooklm generate` commands, **the instructions parameter MUST be in the same language as the user's input**:

**Chinese input example:**
```bash
# ❌ Wrong - English instructions when user spoke Chinese
notebooklm generate audio "Focus on key mathematical concepts"

# ✅ Correct - Chinese instructions
notebooklm generate audio "重点讲解关键数学概念，使用中文，适合中国学生"
```

**English input example:**
```bash
# ✅ Correct - English instructions
notebooklm generate audio "Focus on key mathematical concepts, explain in English"
```

### 3. Generated Content Language
The instructions must explicitly specify the target language to ensure NotebookLM generates content in the correct language:

- **Chinese user** → Instructions like: "用中文讲解...", "以中文生成...", "适合中文用户"
- **English user** → Instructions like: "Explain in English...", "Generate in English...", "For English speakers"

### 4. Complete Workflow Example

**User says (Chinese):** "生成一个关于一元一次方程的播客"

```bash
# Step 1: Create notebook (title can be Chinese)
notebooklm create "一元一次方程教学"

# Step 2: Add sources
notebooklm source add "https://..."

# Step 3: Generate with Chinese instructions
notebooklm generate audio "请用中文讲解一元一次方程的概念、解法和应用，语言生动，适合初中生理解"

# Step 4: Respond to user in Chinese
# "正在生成关于一元一次方程的中文播客，大约需要5-8分钟..."
```

**User says (English):** "Create a podcast about linear equations"

```bash
# Step 1: Create notebook (title in English)
notebooklm create "Linear Equations Teaching"

# Step 2: Add sources
notebooklm source add "https://..."

# Step 3: Generate with English instructions
notebooklm generate audio "Explain linear equations in English, covering concepts, solving methods, and applications in an engaging way for middle school students"

# Step 4: Respond to user in English
# "Generating an English podcast about linear equations, will take about 5-8 minutes..."
```

### 5. Language Detection Rules
- Detect user's language from their **most recent message**
- If user switches language mid-conversation, switch accordingly
- If unclear, default to English
- For mixed language input, use the **primary language** (the one with more content)

## Autonomy Rules

**Run automatically (no confirmation):**
- `notebooklm status` - check context
- `notebooklm auth check` - diagnose auth issues
- `notebooklm list` - list notebooks
- `notebooklm source list` - list sources
- `notebooklm artifact list` - list artifacts
- `notebooklm artifact wait` - wait for artifact completion (in subagent context)
- `notebooklm source wait` - wait for source processing (in subagent context)
- `notebooklm research status` - check research status
- `notebooklm research wait` - wait for research (in subagent context)
- `notebooklm use <id>` - set context (⚠️ SINGLE-AGENT ONLY - use `-n` flag in parallel workflows)
- `notebooklm create` - create notebook
- `notebooklm ask "..."` - chat queries
- `notebooklm source add` - add sources

**Ask before running:**
- `notebooklm delete` - destructive
- `notebooklm generate *` - long-running, may fail
- `notebooklm download *` - writes to filesystem
- `notebooklm artifact wait` - long-running (when in main conversation)
- `notebooklm source wait` - long-running (when in main conversation)
- `notebooklm research wait` - long-running (when in main conversation)

## Quick Reference

| Task | Command |
|------|---------|
| Authenticate | `notebooklm login` |
| Diagnose auth issues | `notebooklm auth check` |
| Diagnose auth (full) | `notebooklm auth check --test` |
| List notebooks | `notebooklm list` |
| Create notebook | `notebooklm create "Title"` |
| Set context | `notebooklm use <notebook_id>` |
| Show context | `notebooklm status` |
| Add URL source | `notebooklm source add "https://..."` |
| Add file | `notebooklm source add ./file.pdf` |
| Add YouTube | `notebooklm source add "https://youtube.com/..."` |
| List sources | `notebooklm source list` |
| Wait for source processing | `notebooklm source wait <source_id>` |
| Web research (fast) | `notebooklm source add-research "query"` |
| Web research (deep) | `notebooklm source add-research "query" --mode deep --no-wait` |
| Check research status | `notebooklm research status` |
| Wait for research | `notebooklm research wait --import-all` |
| Chat | `notebooklm ask "question"` |
| Chat (new conversation) | `notebooklm ask "question" --new` |
| Chat (specific sources) | `notebooklm ask "question" -s src_id1 -s src_id2` |
| Chat (with references) | `notebooklm ask "question" --json` |
| Get source fulltext | `notebooklm source fulltext <source_id>` |
| Get source guide | `notebooklm source guide <source_id>` |
| Generate podcast | `notebooklm generate audio "instructions"` |
| Generate podcast (JSON) | `notebooklm generate audio --json` |
| Generate podcast (specific sources) | `notebooklm generate audio -s src_id1 -s src_id2` |
| Generate video | `notebooklm generate video "instructions"` |
| Generate quiz | `notebooklm generate quiz` |
| Check artifact status | `notebooklm artifact list` |
| Wait for completion | `notebooklm artifact wait <artifact_id>` |
| Download audio | `notebooklm download audio ./output.mp3` |
| Download video | `notebooklm download video ./output.mp4` |
| Download report | `notebooklm download report ./report.md` |
| Download study guide | `notebooklm download study-guide ./guide.md` |
| Download FAQ | `notebooklm download faq ./faq.md` |
| Download mind map | `notebooklm download mind-map ./map.json` |
| Download data table | `notebooklm download data-table ./data.csv` |
| Download quiz | `notebooklm download quiz quiz.json` |
| Download quiz (markdown) | `notebooklm download quiz --format markdown quiz.md` |
| Download flashcards | `notebooklm download flashcards cards.json` |
| Download flashcards (markdown) | `notebooklm download flashcards --format markdown cards.md` |
| Delete notebook | `notebooklm notebook delete <id>` |

**Parallel safety:** Use explicit notebook IDs in parallel workflows. Commands supporting `-n` shorthand: `artifact wait`, `source wait`, `research wait/status`, `download *`. Download commands also support `-a/--artifact`. Other commands use `--notebook`. For chat, use `--new` to start fresh conversations (avoids conversation ID conflicts).

**Partial IDs:** Use first 6+ characters of UUIDs. Must be unique prefix (fails if ambiguous). Works for: `use`, `delete`, `wait` commands. For automation, prefer full UUIDs to avoid ambiguity.

## Command Output Formats

Commands with `--json` return structured data for parsing:

**Create notebook:**
```
$ notebooklm create "Research" --json
{"id": "abc123de-...", "title": "Research"}
```

**Add source:**
```
$ notebooklm source add "https://example.com" --json
{"source_id": "def456...", "title": "Example", "status": "processing"}
```

**Generate artifact:**
```
$ notebooklm generate audio "Focus on key points" --json
{"task_id": "xyz789...", "status": "pending"}
```

**Chat with references:**
```
$ notebooklm ask "What is X?" --json
{"answer": "X is... [1] [2]", "conversation_id": "...", "turn_number": 1, "is_follow_up": false, "references": [{"source_id": "abc123...", "citation_number": 1, "cited_text": "Relevant passage from source..."}, {"source_id": "def456...", "citation_number": 2, "cited_text": "Another passage..."}]}
```

**Source fulltext (get indexed content):**
```
$ notebooklm source fulltext <source_id> --json
{"source_id": "...", "title": "...", "char_count": 12345, "content": "Full indexed text..."}
```

**Understanding citations:** The `cited_text` in references is often a snippet or section header, not the full quoted passage. The `start_char`/`end_char` positions reference NotebookLM's internal chunked index, not the raw fulltext. Use `SourceFulltext.find_citation_context()` to locate citations:
```python
fulltext = await client.sources.get_fulltext(notebook_id, ref.source_id)
matches = fulltext.find_citation_context(ref.cited_text)  # Returns list[(context, position)]
if matches:
    context, pos = matches[0]  # First match; check len(matches) > 1 for duplicates
```

**Extract IDs:** Parse the `id`, `source_id`, or `task_id` field from JSON output.

## Generation Types

All generate commands support:
- `-s, --source` to use specific source(s) instead of all sources
- `--json` for machine-readable output (returns `task_id` and `status`)

| Type | Command | Downloadable |
|------|---------|--------------|
| Podcast | `generate audio` | Yes (.mp3) |
| Video | `generate video` | Yes (.mp4) |
| Slides | `generate slide-deck` | Yes (.pdf) |
| Infographic | `generate infographic` | Yes (.png) |
| Report | `generate report` | Yes (.md) |
| Study Guide | `generate study-guide` | Yes (.md) |
| FAQ | `generate faq` | Yes (.md) |
| Mind Map | `generate mind-map` | Yes (.json) |
| Data Table | `generate data-table` | Yes (.csv) |
| Quiz | `generate quiz` | Yes (.json/.md/.html) |
| Flashcards | `generate flashcards` | Yes (.json/.md/.html) |

## Common Workflows

### Research to Podcast (Interactive)
**Time:** 5-10 minutes total

1. `notebooklm create "Research: [topic]"` — *if fails: check auth with `notebooklm login`*
2. `notebooklm source add` for each URL/document — *if one fails: log warning, continue with others*
3. Wait for sources: `notebooklm source list --json` until all status=READY — *required before generation*
4. `notebooklm generate audio "Focus on [specific angle]"` (confirm when asked) — *if rate limited: wait 5 min, retry once*
5. Note the artifact ID returned
6. Check `notebooklm artifact list` later for status
7. `notebooklm download audio ./podcast.mp3` when complete (confirm when asked)

### Research to Podcast (Automated with Subagent)
**Time:** 5-10 minutes, but continues in background

When user wants full automation (generate and download when ready):

1. Create notebook and add sources as usual
2. Wait for sources to be ready (use `source wait` or check `source list --json`)
3. Run `notebooklm generate audio "..." --json` → parse `artifact_id` from output
4. **Spawn a background agent** using Task tool:
   ```
   Task(
     prompt="Wait for artifact {artifact_id} in notebook {notebook_id} to complete, then download.
             Use: notebooklm artifact wait {artifact_id} -n {notebook_id} --timeout 600
             Then: notebooklm download audio ./podcast.mp3 -a {artifact_id} -n {notebook_id}",
     subagent_type="general-purpose"
   )
   ```
5. Main conversation continues while agent waits

**Error handling in subagent:**
- If `artifact wait` returns exit code 2 (timeout): Report timeout, suggest checking `artifact list`
- If download fails: Check if artifact status is COMPLETED first

**Benefits:** Non-blocking, user can do other work, automatic download on completion

### Document Analysis
**Time:** 1-2 minutes

1. `notebooklm create "Analysis: [project]"`
2. `notebooklm source add ./doc.pdf` (or URLs)
3. `notebooklm ask "Summarize the key points"`
4. `notebooklm ask "What are the main arguments?"`
5. Continue chatting as needed

### Bulk Import
**Time:** Varies by source count

1. `notebooklm create "Collection: [name]"`
2. Add multiple sources:
   ```bash
   notebooklm source add "https://url1.com"
   notebooklm source add "https://url2.com"
   notebooklm source add ./local-file.pdf
   ```
3. `notebooklm source list` to verify

**Source limits:** Max 50 sources per notebook
**Supported types:** PDFs, YouTube URLs, web URLs, Google Docs, text files

### Bulk Import with Source Waiting (Subagent Pattern)
**Time:** Varies by source count

When adding multiple sources and needing to wait for processing before chat/generation:

1. Add sources with `--json` to capture IDs:
   ```bash
   notebooklm source add "https://url1.com" --json  # → {"source_id": "abc..."}
   notebooklm source add "https://url2.com" --json  # → {"source_id": "def..."}
   ```
2. **Spawn a background agent** to wait for all sources:
   ```
   Task(
     prompt="Wait for sources {source_ids} in notebook {notebook_id} to be ready.
             For each: notebooklm source wait {id} -n {notebook_id} --timeout 120
             Report when all ready or if any fail.",
     subagent_type="general-purpose"
   )
   ```
3. Main conversation continues while agent waits
4. Once sources are ready, proceed with chat or generation

**Why wait for sources?** Sources must be indexed before chat or generation. Takes 10-60 seconds per source.

### Deep Web Research (Subagent Pattern)
**Time:** 2-5 minutes, runs in background

Deep research finds and analyzes web sources on a topic:

1. Create notebook: `notebooklm create "Research: [topic]"`
2. Start deep research (non-blocking):
   ```bash
   notebooklm source add-research "topic query" --mode deep --no-wait
   ```
3. **Spawn a background agent** to wait and import:
   ```
   Task(
     prompt="Wait for research in notebook {notebook_id} to complete and import sources.
             Use: notebooklm research wait -n {notebook_id} --import-all --timeout 300
             Report how many sources were imported.",
     subagent_type="general-purpose"
   )
   ```
4. Main conversation continues while agent waits
5. When agent completes, sources are imported automatically

**Alternative (blocking):** For simple cases, omit `--no-wait`:
```bash
notebooklm source add-research "topic" --mode deep --import-all
# Blocks for up to 5 minutes
```

**When to use each mode:**
- `--mode fast`: Specific topic, quick overview needed (5-10 sources, seconds)
- `--mode deep`: Broad topic, comprehensive analysis needed (20+ sources, 2-5 min)

**Research sources:**
- `--from web`: Search the web (default)
- `--from drive`: Search Google Drive

## Output Style

**Progress updates:** Brief status for each step
- "Creating notebook 'Research: AI'..."
- "Adding source: https://example.com..."
- "Starting audio generation... (task ID: abc123)"

**Fire-and-forget for long operations:**
- Start generation, return artifact ID immediately
- Do NOT poll or wait in main conversation - generation takes 5-45 minutes (see timing table)
- User checks status manually, OR use subagent with `artifact wait`

**JSON output:** Use `--json` flag for machine-readable output:
```bash
notebooklm list --json
notebooklm auth check --json
notebooklm source list --json
notebooklm artifact list --json
```

**JSON schemas (key fields):**

`notebooklm list --json`:
```json
{"notebooks": [{"id": "...", "title": "...", "created_at": "..."}]}
```

`notebooklm auth check --json`:
```json
{"checks": {"storage_exists": true, "json_valid": true, "cookies_present": true, "sid_cookie": true, "token_fetch": true}, "details": {"storage_path": "...", "auth_source": "file", "cookies_found": ["SID", "HSID", "..."], "cookie_domains": [".google.com"]}}
```

`notebooklm source list --json`:
```json
{"sources": [{"id": "...", "title": "...", "status": "ready|processing|error"}]}
```

`notebooklm artifact list --json`:
```json
{"artifacts": [{"id": "...", "title": "...", "type": "Audio Overview", "status": "in_progress|pending|completed|unknown"}]}
```

**Status values:**
- Sources: `processing` → `ready` (or `error`)
- Artifacts: `pending` or `in_progress` → `completed` (or `unknown`)

## Error Handling

**On failure, offer the user a choice:**
1. Retry the operation
2. Skip and continue with something else
3. Investigate the error

**Error decision tree:**

| Error | Cause | Action |
|-------|-------|--------|
| Auth/cookie error | Session expired | Run `notebooklm auth check` then `notebooklm login` |
| "No notebook context" | Context not set | Use `-n <id>` or `--notebook <id>` flag (parallel), or `notebooklm use <id>` (single-agent) |
| "No result found for RPC ID" | Rate limiting | Wait 5-10 min, retry |
| `GENERATION_FAILED` | Google rate limit | Wait and retry later |
| Download fails | Generation incomplete | Check `artifact list` for status |
| Invalid notebook/source ID | Wrong ID | Run `notebooklm list` to verify |
| RPC protocol error | Google changed APIs | May need CLI update |

## Exit Codes

All commands use consistent exit codes:

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | Error (not found, processing failed) | Check stderr, see Error Handling |
| 2 | Timeout (wait commands only) | Extend timeout or check status manually |

**Examples:**
- `source wait` returns 1 if source not found or processing failed
- `artifact wait` returns 2 if timeout reached before completion
- `generate` returns 1 if rate limited (check stderr for details)

## ⚠️ CRITICAL: Understanding Output Formats

### study-guide vs slide-deck: MUST Read Before Generating

**IMPORTANT**: These two commands produce **completely different formats**:

| Feature | study-guide | slide-deck |
|---------|-------------|------------|
| **Output Format** | Markdown text (.md) | PDF slides (.pdf) |
| **Content Type** | Text-based study guide | Visual presentation slides |
| **Generation Time** | 1-2 minutes | 5-15 minutes |
| **Use Case** | Reading/studying | Presenting/teaching |
| **Download Required** | Yes (`download study-guide`) | Yes (`download slide-deck`) |

### Decision Guide: Which Command to Use?

**Use `generate study-guide` when:**
- ✅ User wants a **text-based study guide** (Markdown format)
- ✅ User asks for "学习指南", "study guide", "学习资料"
- ✅ User prefers reading material over slides
- ✅ Faster generation is important (1-2 min vs 5-15 min)

**Use `generate slide-deck` when:**
- ✅ User wants **PDF slides** for presentation
- ✅ User asks for "幻灯片", "slides", "PPT", "PDF"
- ✅ User needs visual presentation format
- ✅ In lesson-plan context and user requests slides

**NEVER:**
- ❌ Use `study-guide` when user asks for PDF format
- ❌ Save study-guide output as `.pdf` (it's Markdown!)
- ❌ Assume study-guide produces PDF (it produces Markdown)

### Example: Correct Tool Selection

```bash
# User says: "制作PDF幻灯片"
# ✅ CORRECT: Use slide-deck
notebooklm generate slide-deck "讲解数学概念"
notebooklm artifact wait <id>
notebooklm download slide-deck ./幻灯片.pdf

# User says: "生成学习指南"
# ✅ CORRECT: Use study-guide
notebooklm generate study-guide "数学概念学习指南"
notebooklm artifact wait <id>
notebooklm download study-guide ./学习指南.md

# User says: "用notebooklm做教案的pdf"
# ✅ CORRECT: Use slide-deck (user wants PDF)
notebooklm generate slide-deck "教案内容幻灯片"
notebooklm artifact wait <id>
notebooklm download slide-deck ./教案.pdf

# ❌ WRONG: Don't use study-guide for PDF requests
# notebooklm generate study-guide "..."  # This returns Markdown, not PDF!
```

### File Format Verification

Before saving downloaded files:
- `slide-deck` → Verify file is PDF binary (starts with `%PDF`)
- `study-guide` → File will be Markdown text (starts with `#`)
- If study-guide output is saved as `.pdf`, it will be **corrupted and unreadable**

## Known Limitations

**Rate limiting:** Audio, video, quiz, flashcards, infographic, and slides generation may fail due to Google's rate limits. This is an API limitation, not a bug.

**Reliable operations:** These always work:
- Notebooks (list, create, delete, rename)
- Sources (add, list, delete)
- Chat/queries
- Mind-map (instant, .json)
- Study Guide (1-2 min, .md)
- FAQ (1-2 min, .md)
- Data Table (5-15 min, .csv)

**Unreliable operations:** These may fail with rate limiting:
- Audio (podcast) generation
- Video generation
- Quiz and flashcard generation
- Infographic and slides generation

**Workaround:** If generation fails:
1. Check status: `notebooklm artifact list`
2. Retry after 5-10 minutes
3. Use the NotebookLM web UI as fallback

**Processing times vary significantly.** Use the subagent pattern for long operations:

| Operation | Typical time | Suggested timeout |
|-----------|--------------|-------------------|
| Source processing | 30s - 10 min | 600s |
| Research (fast) | 30s - 2 min | 180s |
| Research (deep) | 15 - 30+ min | 1800s |
| Notes | instant | n/a |
| Mind-map | instant (sync) | n/a |
| Study Guide | 1 - 2 min | 120s |
| FAQ | 1 - 2 min | 120s |
| Quiz, flashcards | 5 - 15 min | 900s |
| Report, data-table | 5 - 15 min | 900s |
| Audio generation | 10 - 20 min | 1200s |
| Video generation | 15 - 45 min | 2700s |

**Polling intervals:** When checking status manually, poll every 15-30 seconds to avoid excessive API calls.

## Troubleshooting

```bash
notebooklm --help              # Main commands
notebooklm auth check          # Diagnose auth issues
notebooklm auth check --test   # Full auth validation with network test
notebooklm notebook --help     # Notebook management
notebooklm source --help       # Source management
notebooklm research --help     # Research status/wait
notebooklm generate --help     # Content generation
notebooklm artifact --help     # Artifact management
notebooklm download --help     # Download content
```

**Diagnose auth:** `notebooklm auth check` - shows cookie domains, storage path, validation status
**Re-authenticate:** `notebooklm login`
**Check version:** `notebooklm --version`
**Update skill:** `notebooklm skill install`

## Lesson Plan Integration

### ⚠️ CRITICAL: Always call attach_file after downloading artifacts

When using NotebookLM within the **Lesson Plan Designer** solution, you **MUST** attach all downloaded artifacts to the lesson plan using `attach_file`. This is **MANDATORY**, not optional.

**Workflow for any artifact download:**
1. Download the artifact (audio/video/slides/etc.)
2. **IMMEDIATELY call `attach_file` with the downloaded file path**
3. Confirm to user that file is attached and ready to sync

### Context Detection

Check if the `attach_file` MCP tool is available in the tool list. If it is, you're in the lesson-plan-designer context and **MUST** use it.

### Mandatory Workflow Examples

#### Slides (PDF) - COMPLETE WORKFLOW

```bash
# Step 1-4: Standard NotebookLM workflow
notebooklm create "教案幻灯片"
notebooklm source add <source>
notebooklm generate slide-deck "..."
notebooklm artifact wait <artifact_id>
notebooklm download slide-deck ./教学幻灯片.pdf

# Step 5: MANDATORY - Call attach_file
attach_file({
  filePath: '教学幻灯片.pdf',
  fileType: 'pdf',
  description: 'NotebookLM 生成的教学幻灯片'
})
```

**IMPORTANT:**
- ✅ **ALWAYS** call `attach_file` after successful download
- ✅ Use the EXACT file path from the download command
- ❌ **NEVER** skip this step in lesson-plan-designer context
- ❌ **NEVER** assume the user will manually attach the file

#### Audio (Podcast)

```bash
notebooklm download audio ./教学讲解音频.mp3

# MANDATORY:
attach_file({
  filePath: '教学讲解音频.mp3',
  fileType: 'audio',
  description: '教学讲解音频 - 约8分钟中文讲解'
})
```

#### Video

```bash
notebooklm download video ./教学视频.mp4

# MANDATORY:
attach_file({
  filePath: '教学视频.mp4',
  fileType: 'video',
  description: '教学视频 - 可视化讲解'
})
```

### Error Handling

**If attach_file fails:**
1. Report the error to the user
2. Provide the file path so they can manually attach it
3. Do **NOT** silently ignore the failure

### User Experience

After calling `attach_file`:
- A "添加附件" (Add Attachment) button appears in the chat
- User clicks it to add the file to the lesson plan
- File becomes downloadable in the lesson plan's attachments section

### Technical Details

**File path matching:**
- Use the EXACT file path passed to the download command
- If user specified custom path (e.g., `./my-slides.pdf`), use that
- Common patterns:
  - Audio: `./podcast.mp3`, `./教学讲解音频.mp3`
  - Video: `./video.mp4`, `./教学视频.mp4`
  - Slides: `./slides.pdf`, `./教学幻灯片.pdf`

**Supported file types:**
- `audio` - Audio files (.mp3, .wav)
- `video` - Video files (.mp4)
- `pdf` - PDF documents (.pdf)
- `image` - Images (.png, .jpg)
- `document` - Other documents (.md, .txt)

**Description customization:**
- **Audio**: Mention duration (e.g., "约8分钟"), language (e.g., "中文讲解")
- **Video**: Mention duration, content focus (e.g., "重点讲解方程解法")
- **Slides**: Mention format (e.g., "PDF格式"), page count if known
- Keep concise (under 50 characters)
