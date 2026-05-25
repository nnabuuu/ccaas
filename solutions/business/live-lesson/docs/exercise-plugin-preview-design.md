# Exercise Plugin Preview System

> Design document — A standalone preview platform for trying out, visualizing, and rapidly scaffolding individual plugin bundles.
>
> Companion document: [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md) — the plugin architecture itself.

## 1. Problem Statement

### 1.1 Pain Points Without Preview

After the plugin architecture lands, the development loop for a new exercise type is:

```
Write plugin → integrate into live-lesson backend → edit manifest → start SQLite + NestJS + Vite +
MCP server → create classroom session → impersonate student to join → walk through listen/practice/discuss
→ submit answer → see effect
```

Every iteration requires walking the full integration path. The feedback loop is long (>2 min), the dependencies are heavy (4 processes), the noise is high (unrelated errors distract), and nothing is shareable (local dev-machine state cannot be shown to others).

### 1.2 Three Audiences with Different Needs

| Audience | Need | Current Gap |
|---------|------|-------------|
| Plugin **developer** | Seconds-level feedback on code changes; debug grade/sanitize inputs/outputs; isolate AI call noise | Needs a lightweight sandbox (Storybook-style) |
| Curriculum **editor / instructional designer** | Visually edit answerKey JSON; switch student/teacher perspective; save drafts | Needs an admin Playground |
| **End user / customer / prospect** | Public-accessible demo simulating real classroom; shareable link | Needs public deployment + short-code sharing |

### 1.3 Goals

- **Developers**: `npx exercise-preview .` starts in one command, hot reload, Inspector panel shows full lifecycle
- **Editors**: admin-next `/playground/:bundle` page, Monaco JSON editor, multi-perspective switching
- **Users**: Public demo site, each bundle has independent share link (e.g. `demo.kedge.com/p/long-division-abc123`)
- **Unification**: One Mini Backend + one Stories protocol, reused across three UI shells

---

## 2. Overall Architecture (Three Shells, One Core)

```
┌──────────────────────────────────────────────────────────┐
│  3 UI Shells (for different audiences)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ CLI Preview  │  │ Admin Embed  │  │ Public Demo  │    │
│  │ Dev sandbox  │  │ Playground   │  │ Showcase     │    │
│  │ Hot reload   │  │ JSON editing │  │ Share links  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────┬──────┴──────────────────┘            │
├──────────────────────────────────────────────────────────┤
│  Preview Runtime (TS library, shared by all 3 shells)     │
│  - defineStories() API                                    │
│  - StoryLoader (scan *.stories.ts)                        │
│  - PreviewSession (in-memory classroom simulation)        │
│  - RoleSwitcher (student / teacher / inspector)           │
├──────────────────────────────────────────────────────────┤
│  Mini Classroom Backend (NestJS, reuses real providers)   │
│  - ExerciseTypeRegistry  ← reused                          │
│  - GradingService        ← reused                          │
│  - AiPromptBuilder       ← reused (real LLM calls)         │
│  - InMemoryClassroomState (replaces SQLite/TypeORM)       │
│  - NOT loaded: Observer / Discuss / PersonalTouch / Snapshot │
└──────────────────────────────────────────────────────────┘
```

**Core thesis**: One Runtime layer + one Mini Backend, three UI shells. Mini Backend reuses real Plugin code (ensuring behavioral consistency) but strips out SQLite / Observer / Discuss / Snapshot — subsystems irrelevant to single-plugin preview.

> **2026-05 implementation note**: The CLI shell's stage rendering no longer uses hand-rolled vanilla JS templates. The chrome (`packages/exercise-preview/web/index.html`) now embeds the production frontend's `/exercise-demo?bundle=X&story=Y&role=Z&embed=1` route (`solutions/business/live-lesson/frontend/src/pages/PluginPreviewPage.tsx`) via an iframe. So the student view renders the real production component (`QuizExercise.tsx` etc.) and the teacher view renders the real `ObserveClassView` (`McClassView` / `MatrixClassView` / …) — what customers see is pixel-identical to a real classroom.
>
> - Preview-server (`:4321`) serves the chrome + bundles API
> - Frontend dev server (`:5283`) serves the iframe content; its own vite proxy routes `/preview/*` back to :4321
> - `FRONTEND_URL` is configurable: `?frontend=` URL param (persisted to `sessionStorage`) → `window.PREVIEW_FRONTEND_URL` global → default `http://localhost:5283`
> - 11 example bundles live in `packages/exercise-preview/bundles/`, one per exercise type; the six types with an `ObserveClassView` also ship a `classObserveData` mock so the teacher-toggle works
>
> See [`bundles/README.md`](../../../packages/exercise-preview/bundles/README.md) for usage.

### 2.1 Why embedded mini NestJS instead of pure-frontend mock

| Approach | Pros | Cons | Adopted |
|----------|------|------|---------|
| Pure-frontend in-memory mock | Fastest startup, no backend dependency | Behavioral drift: AI-graded types must mock LLM; Zod validation diverges from real env | ❌ |
| Embedded mini NestJS | Reuses real ExerciseTypeRegistry/GradingService code; Zod validation matches prod; AI scoring uses real LLM | Slightly slower startup (~2-3s); needs Node process | ✅ |
| Reuse real live-lesson backend | Zero new backend code | Preview shape gets bound to classroom semantics (must have session code/student/step), violating the "single-plugin preview" intent | ❌ |

**Key benefit**: The grade results developers see in preview are **identical** to production — because the same `plugin.grade()` code runs.

---

## 3. Stories File Format

### 3.1 Design Principles

Inspired by Storybook's CSF (Component Story Format):

- One `*.stories.ts` file = all preset scenarios for one plugin
- Default export binds the plugin; named exports define each scenario
- Stories files serve as test cases (consumable by vitest) + documentation (IDE navigation) + demo data source (public showcase)
- Single source of truth reused in three places

### 3.2 API

```typescript
// packages/exercise-pack-math/frontend/long-division.stories.ts

import { defineStories } from '@kedge-agentic/exercise-preview';
import { longDivisionPlugin } from './long-division.plugin';

export default defineStories({
  plugin: longDivisionPlugin,
  meta: {
    title: 'Long Division',
    description: 'Polynomial long division for middle school math',
    tags: ['math', 'grade-8'],
    docsUrl: 'https://docs.kedge.com/long-division',
  },
});

// Each export = one scenario
export const Default: Story = {
  name: 'Default empty',
  answerKey: {
    type: 'long-division',
    dividend: 'x^2 + 5x + 6',
    divisor: 'x + 2',
  },
};

export const PartiallyAnswered: Story = {
  name: 'Half answered',
  answerKey: { ... },
  initialAns: { steps: [{ quotient: 'x', remainder: '...' }] },
};

export const ReviewMode: Story = {
  name: 'Review view',
  answerKey: { ... },
  reviewData: {
    data: {...},
    checkItems: [
      { idx: 1, correct: true },
      { idx: 2, correct: false, hint: 'Watch the sign' },
    ],
  },
  initialPhase: 'review',
};

export const TeacherObserve: Story = {
  name: 'Teacher observe — 10 student submissions',
  answerKey: { ... },
  // Teacher-view specific: mock class-wide submissions
  classSubmissions: [
    { studentId: 's1', name: 'Alice', data: {...}, score: 100 },
    { studentId: 's2', name: 'Bob',   data: {...}, score: 60 },
    // ...
  ],
  initialRole: 'teacher',
};
```

### 3.3 Story Type Contract

```typescript
// @kedge-agentic/exercise-preview/src/core/types.ts

export interface StoryMeta {
  title: string;                // Display name
  description?: string;
  tags?: string[];              // For filtering, categorization
  docsUrl?: string;             // External docs link
  bundleVersion?: string;       // Version compatibility declaration
}

export interface DefineStoriesArgs {
  plugin: ExerciseUIPlugin;     // Frontend plugin instance
  meta: StoryMeta;
}

export interface Story {
  name: string;                                                // Scenario name
  answerKey: Record<string, unknown>;                          // Full answer key (with answers)
  initialAns?: Record<string, unknown>;                        // Student initial answer state
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> };
  initialPhase?: 'idle' | 'submitting' | 'review';             // Starting phase
  initialRole?: 'student' | 'teacher';                         // Starting role
  classSubmissions?: Array<MockSubmission>;                    // Mock data for teacher view
  notes?: string;                                              // Long description (Markdown, rendered into Inspector tab)
  skipInDemo?: boolean;                                        // Hidden on public demo (default false)
}

export interface MockSubmission {
  studentId: string;
  name: string;
  data: Record<string, unknown>;
  score?: number;
  submittedAt?: number;
}
```

### 3.4 Auto-discovery

```typescript
// At CLI startup
const stories = await loadStories({
  cwd: process.cwd(),
  patterns: ['**/*.stories.ts', '**/*.stories.tsx'],
  ignore: ['node_modules/**', 'dist/**'],
});

// Return structure
type LoadedStories = Array<{
  filePath: string;
  plugin: ExerciseUIPlugin;
  meta: StoryMeta;
  stories: Record<string, Story>;
}>;
```

### 3.5 Single Source, Three Uses

| Use case | How it's reused |
|----------|----------------|
| **Unit tests** | `for (const [name, story] of Object.entries(stories)) it(name, () => plugin.grade({key: story.answerKey, data: story.initialAns || {}}))` |
| **Preview sandbox** | `StoryLoader` scans and renders the scenario tree in the left panel |
| **Public demo** | Build-time packs stories into the static site |
| **Regression baseline** | Snapshot stories' grade results; PR checks detect behavioral drift |
| **Documentation examples** | `@example` JSDoc links to the stories file |

---

## 4. Mini Backend Design

### 4.1 NestJS Module Composition

```typescript
// @kedge-agentic/exercise-preview/src/backend/preview-backend.module.ts

@Module({
  imports: [DiscoveryModule, ConfigModule.forRoot()],
  controllers: [PreviewClassroomController],
  providers: [
    // ── Reused real providers ──
    AiPromptBuilder,              // Reused — live-lesson's AI calling layer
    ExerciseTypeRegistry,         // Reused — auto-discovers @ExerciseType()
    GradingService,               // Reused — calls registry.grade()

    // ── Preview-specific replacements ──
    InMemoryClassroomState,       // Replaces ClassroomService
    PreviewSessionService,        // In-memory session management (no SQLite)

    // ── Dynamically injected plugin bundles ──
    ...loadBundleProviders(process.env.PREVIEW_BUNDLES?.split(',') ?? []),
  ],
})
export class PreviewBackendModule {}
```

### 4.2 Stripping Principle

Anything only meaningful in "full classroom semantics" is not loaded in preview:

| Service / Subsystem | Loaded? | Reason |
|--------------------|---------|--------|
| `ExerciseTypeRegistry` + `GradingService` | ✅ Loaded | Core plugin grading pipeline |
| `AiPromptBuilder` | ✅ Loaded | Required for AI-graded types; calls real LLM |
| `ClassroomService` | ❌ Replaced with `InMemoryClassroomState` | No multi-user session, no step sync |
| `ObserverEngine` | ⚠️ Optional | Loaded on-demand only when story has `classSubmissions` and role=teacher |
| `DiscussService` / `PersonalTouchService` | ❌ Not loaded | Not the focus of single-plugin preview |
| `SnapshotService` / `MetricsAggregator` | ❌ Not loaded | Single-user preview doesn't need history replay |
| SQLite / TypeORM | ❌ Not loaded | `InMemoryClassroomState` replaces it |
| SSE endpoint / 3s polling | ❌ Not loaded | Single-user preview syncs via React state directly |
| Auth / Session code / Join flow | ❌ Not loaded | Preview skips identity semantics |

### 4.3 InMemoryClassroomState

```typescript
@Injectable()
export class InMemoryClassroomState {
  private sessions = new Map<string, PreviewSessionData>();

  createSession(storyId: string, story: Story): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      storyId,
      answerKey: story.answerKey,
      ans: story.initialAns ?? {},
      submissions: story.classSubmissions ?? [],
      checkResults: [],
      gradeHistory: [],
    });
    return sessionId;
  }

  getAnswerKey(sessionId: string): unknown { ... }
  recordGrade(sessionId: string, input: unknown, output: GradeResult, durationMs: number): void { ... }
  getInspectorTrace(sessionId: string): InspectorTrace { ... }
}
```

### 4.4 API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/preview/stories` | List all loaded stories |
| `POST` | `/preview/sessions` | Create preview session `{ storyId }` → `{ sessionId, sanitizedSpec }` |
| `POST` | `/preview/sessions/:id/check` | Submit check `{ ans }` → `{ gradeResult, checkItems }` |
| `GET` | `/preview/sessions/:id/inspector` | Get Inspector trace (grade call history, AI prompts, etc.) |
| `GET` | `/preview/sessions/:id/teacher-state` | Teacher-perspective aggregated data (based on `classSubmissions`) |
| `POST` | `/preview/sessions/:id/reset` | Reset session to initial state |

### 4.5 Code Reuse with Real Backend

```typescript
// @kedge-agentic/exercise-preview/src/backend/preview-controller.ts

@Controller('preview/sessions/:id')
export class PreviewClassroomController {
  constructor(
    private readonly state: InMemoryClassroomState,
    private readonly gradingService: GradingService,  // ← Real one
    private readonly registry: ExerciseTypeRegistry,  // ← Real one
  ) {}

  @Post('check')
  async check(@Param('id') id: string, @Body() body: { ans: unknown }) {
    const session = this.state.get(id);
    const key = session.answerKey;
    const data = body.ans;

    // Reuse real grading pipeline
    const t0 = performance.now();
    const gradeResult = await this.gradingService.grade(key, data);  // ← Real code
    const durationMs = performance.now() - t0;

    const checkItems = this.registry.buildCheckItems(key, data, gradeResult);  // ← Real code

    // Inspector recording
    this.state.recordGrade(id, { key, data }, gradeResult, durationMs);

    return { gradeResult, checkItems };
  }
}
```

**Key**: `gradingService.grade()` and `registry.buildCheckItems()` are the **exact same source code** from live-lesson backend — preview only swaps the controller and state storage.

---

## 5. Three UI Shells

### 5.1 Form Comparison

| Dimension | CLI Preview | Admin Embed | Public Demo |
|-----------|-------------|-------------|-------------|
| **Startup** | `npx exercise-preview .` | admin-next `/playground/:bundle` | Static deployment + share link short code |
| **Stories source** | Local filesystem watch | Upload bundle zip or pick installed bundle | Build-time packed |
| **AI grading** | Developer's API key | Admin user's quota | Rate-limited demo API key |
| **answerKey editing** | File-is-source (IDE) | Inline Monaco editor | Read-only |
| **Inspector panel** | ✅ Full | ✅ Full | ❌ Hidden |
| **Teacher observe preview** | ✅ Uses `classSubmissions` mock | ✅ Same | ✅ Same |
| **Share link** | ❌ | ⚠️ Internal link (requires admin auth) | ✅ Public short code |
| **Hot reload** | ✅ Vite HMR | ❌ | ❌ |
| **Offline operation** | ✅ Except AI-graded types | ❌ (depends on admin server) | ❌ |
| **Multi-bundle coexistence** | ✅ CLI glob | ✅ Selector | ✅ Route dispatch |

### 5.2 CLI Preview

**Install & start:**

```bash
# Global / npx
npx @kedge-agentic/exercise-preview .
# Or inside the bundle package
npm run preview     # package.json scripts: "preview": "exercise-preview ."
```

**Directory convention:**

```
packages/exercise-pack-math/
├── frontend/
│   ├── long-division.plugin.ts
│   ├── long-division.stories.ts        ← preview auto-discovers
│   └── LongDivisionExercise.tsx
├── backend/
│   └── plugins/long-division.plugin.ts
└── package.json
   └── scripts: { "preview": "exercise-preview ." }
```

**Process topology:**

```
exercise-preview . command
   ├── Start Mini NestJS (port 4321)
   │   └── Scan backend/**/*.plugin.ts → dynamic import → inject into module
   └── Start Vite dev server (port 5283)
       └── Scan frontend/**/*.stories.ts → HMR watch
Browser http://localhost:5283
   ↓ API requests /preview/* proxied to 4321
```

### 5.3 Admin Embed (Playground)

**Route**: `admin-next/src/pages/playground/[bundleId].tsx`

**UI sketch:**

```
┌─ Playground / Long Division ──────────────────────────────────┐
│ Bundle: exercise-pack-math v1.2.0                              │
│ Story: [Default ▼]   Role: [Student ▼]   [Reset] [Share]      │
├──────────────────┬───────────────────────┬─────────────────────┤
│ AnswerKey JSON   │ Student View          │ Inspector           │
│ (Monaco editor)  │ (renders plugin)      │ (state + grade log) │
│                  │                       │                     │
│ {                │   ┌────────────────┐  │ canSubmit: true     │
│   "type": "...", │   │ <plugin.Comp>  │  │ ans: {...}          │
│   ...            │   │                │  │ Last grade: 80      │
│ }                │   └────────────────┘  │ AI prompt: [open]   │
│                  │   [Submit]            │                     │
└──────────────────┴───────────────────────┴─────────────────────┘
```

**Features:**

- Left pane Monaco editor: real-time Zod validation + JSON schema autocomplete (schema derived from `plugin.answerKeySchema`)
- Middle pane: renders `<plugin.Component>` or `<plugin.ObserveClassView>` (depending on Role)
- Right pane Inspector: see §6
- Save drafts: admin backend's `playground_drafts` table, indexed by bundle + user id
- One-click export: copy answerKey JSON to clipboard / push to lesson manifest draft

### 5.4 Public Demo

**Deployment shape:**

```
demo.kedge.com/
├── /p/long-division-abc123        # bundle: long-division, story: Default
├── /p/quiz-pythagoras-xyz789      # short code auto-generated
└── /catalog                        # bundle marketplace
```

**Build flow:**

```bash
exercise-preview build \
  --bundles ./packages/exercise-pack-* \
  --output ./dist \
  --base-url https://demo.kedge.com
# → static HTML/JS + stories embedded as JSON + short code mapping table
```

**Features:**

- Static packaging: each story is a route, no backend needed (AI-graded types proxy through)
- Rate limiting: demo API key with RPM limit (prevents abuse)
- Share short codes: `abc123` auto-generated, expiration configurable
- Hidden Inspector / editor: end users see only the exercise itself
- Lead-gen: bottom-right "Learn about KedgeAgentic platform" button

### 5.5 Shared Code Across Shells

```
@kedge-agentic/exercise-preview/
├── src/
│   ├── core/                       # Shared by all 3 shells
│   │   ├── define-stories.ts       # API entry
│   │   ├── types.ts                # Story / StoryMeta / MockSubmission
│   │   ├── story-loader.ts         # Filesystem scan
│   │   └── preview-session.ts      # In-memory session abstraction
│   ├── backend/                    # Mini NestJS (shared CLI + Admin)
│   │   ├── preview-backend.module.ts
│   │   ├── preview-classroom.controller.ts
│   │   └── in-memory-classroom-state.ts
│   ├── ui/                         # React component library (shared by all 3 shells)
│   │   ├── PreviewApp.tsx          # Main layout
│   │   ├── StoryList.tsx           # Left panel scenario tree
│   │   ├── StudentStage.tsx        # Renders <plugin.Component>
│   │   ├── TeacherStage.tsx        # Renders <plugin.ObserveClassView>
│   │   ├── Inspector.tsx           # Right panel inspector
│   │   ├── AnswerKeyEditor.tsx     # Monaco editor (Admin only)
│   │   └── RoleSwitcher.tsx
│   ├── cli/                        # CLI entry
│   │   ├── index.ts                # bin entry
│   │   ├── dev-server.ts           # Vite + NestJS concurrent start
│   │   └── build.ts                # Static packaging (public demo)
│   └── embed/                      # Admin embedding interface
│       └── PlaygroundShell.tsx     # iframe safe shell + postMessage protocol
└── package.json
```

---

## 6. Inspector Panel Design

The Inspector is the most useful part for developers — it fully exposes "plugin lifecycle + grading internals".

### 6.1 Panel Structure

```
┌─ Inspector ─────────────────────────────┐
│ ▼ AnswerKey (sanitize before/after)     │
│   raw:       {...full key with answers} │
│   sanitized: {...student-safe spec}     │
│   diff:      [highlighted stripped keys]│
├─────────────────────────────────────────┤
│ ▼ Current State                         │
│   ans:               {...}              │
│   checkResultState:  {...}              │
│   allDone:           false              │
│   softDone:          false              │
│   canSubmit:         true               │
├─────────────────────────────────────────┤
│ ▼ Last Grade Call                       │
│   input:    {ans, key}                  │
│   output:   {total: 80, byDimension}    │
│   duration: 1.2s (AI call)              │
│   prompt:   [click to expand]           │
│   response: [click to expand]           │
├─────────────────────────────────────────┤
│ ▼ Check Items                           │
│   #1 correct  ✓                         │
│   #2 wrong    ✗ hint: "..."             │
├─────────────────────────────────────────┤
│ ▼ Plugin Lifecycle                      │
│   enrichFromApi:      called (2.3ms)    │
│   enrichFromManifest: not called        │
│   canSubmit:          12 calls          │
│   handleCheckResult:  1 call (3.1ms)    │
│   localGrade:         not implemented   │
├─────────────────────────────────────────┤
│ ▼ Validation                            │
│   answerKeySchema: ✓ valid              │
│   sanitize output: ✓ matches ExerciseSpec│
├─────────────────────────────────────────┤
│ ▼ Notes                                 │
│   [Markdown from story.notes]           │
└─────────────────────────────────────────┘
```

### 6.2 Key Observations

| Section | Data Source | Value |
|---------|------------|-------|
| AnswerKey diff | `plugin.answerKeySchema.parse(key)` + `plugin.sanitize(...)` | Exposes "answer leakage" — whether sanitize actually strips sensitive fields |
| Current State | Real-time React state snapshot | Debugging canSubmit/handleCheckResult errors at a glance |
| Last Grade Call | Mini Backend `recordGrade` trace | For AI-graded types: see prompt + response directly, locate LLM call errors |
| Check Items | `plugin.buildCheckItems()` return value | Verify hint/walkthrough paths |
| Plugin Lifecycle | Proxy-wrapped plugin methods record calls | Spot "should-have-been-called-but-wasn't" callback gaps |
| Validation | Zod safeParse results | Instantly catch schema drift (common when hand-writing manifests) |

### 6.3 Call Tracing Implementation

```typescript
// Proxy-wrap the plugin to record all method calls
function instrumentPlugin(plugin: ExerciseUIPlugin, tracer: Tracer): ExerciseUIPlugin {
  return new Proxy(plugin, {
    get(target, prop) {
      const value = (target as any)[prop];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const t0 = performance.now();
        try {
          const result = value.apply(target, args);
          tracer.record(String(prop), { args, result, durationMs: performance.now() - t0 });
          return result;
        } catch (err) {
          tracer.recordError(String(prop), { args, error: err });
          throw err;
        }
      };
    },
  });
}
```

---

## 7. Data Flow (End-to-End)

Using CLI Preview + Student view as example:

```
1. Developer runs `npx exercise-preview .`
   ↓
2. CLI starts:
   a. StoryLoader scans ./**/*.stories.ts → gets Plugin + Stories
   b. BundleLoader scans ./backend/**/*.plugin.ts → dynamic require → inject into Mini Backend
   c. Start Vite dev server (5283) + Mini NestJS (4321)
   ↓
3. Browser opens http://localhost:5283
   PreviewApp loads → left panel StoryList shows [Default, PartiallyAnswered, ReviewMode, TeacherObserve]
   ↓
4. User clicks "Default"
   → POST /preview/sessions { storyId: 'long-division/Default' }
   → Mini Backend creates sessionId, stores answerKey + initialAns
   → Returns { sessionId, sanitizedSpec }
   ↓
5. StudentStage renders <plugin.Component
       exercise={sanitizedSpec}
       ans={story.initialAns ?? {}}
       setAns={setAns}
       checkResultState={{}}
       onDone={onDone}
     />
   ↓
6. Student interactions: filling, selecting, drawing...
   ans state syncs to Inspector in real time
   ↓
7. Click "Submit":
   a. plugin.canSubmit(ex, ans, checkResultState) → true
   b. plugin.formatSubmitData(ans, checkResultState) → submitPayload
   c. POST /preview/sessions/:id/check { ans: submitPayload }
   ↓
8. Mini Backend:
   a. Call gradingService.grade(answerKey, submitPayload)  ← real code path
      - registry.get(type).grade(ctx) → GradeResult
      - For AI-graded: AiPromptBuilder calls real LLM
   b. Call registry.buildCheckItems(key, data, gradeResult) → CheckItem[]
   c. state.recordGrade(...)  ← Inspector trace
   d. Return { gradeResult, checkItems }
   ↓
9. Frontend plugin.handleCheckResult(result, ex, currentState) → { checkResultState, allDone, ... }
   ↓
10. setCheckResultState(...) → re-render
    Inspector panel updates: grade history + checkItems + lifecycle calls
    ↓
11. Developer changes plugin code → Vite HMR → state preserved, component re-renders
```

---

## 8. Implementation Path

5 stages, incremental, each shippable:

| Stage | Goal | Key Deliverables | Validation |
|-------|------|------------------|------------|
| **P0** | Core library scaffolding | `defineStories` API + Story types + StoryLoader | Unit test: extract plugin + stories from `.stories.ts` (with vitest) |
| **P1** | Mini NestJS + CLI single-bundle works | preview-backend + preview-classroom.controller + cli/dev-server | E2E: CLI starts → browser shows quiz → submit → grade correct |
| **P2** | PreviewApp three-pane layout + Inspector + Role switching | PreviewApp / StoryList / StudentStage / TeacherStage / Inspector | Manual: Teacher view with mock submissions renders ObserveClassView |
| **P3** | Admin embed | admin-next `/playground/:bundle` + Monaco editor + draft save | Manual: admin picks bundle → edit answerKey → live preview |
| **P4** | Public demo | `exercise-preview build` static pack + short-code service + rate-limited demo API key | Manual: generate share link → open in private window → demo works |

### 8.1 P0 — Core Library Scaffolding

**Deliverables:**
- `@kedge-agentic/exercise-preview` package init
- `defineStories()` API + `Story` / `StoryMeta` types
- `StoryLoader.load(cwd)` scan function
- Unit tests covering stories parsing

**Not in scope**: UI, backend, CLI

### 8.2 P1 — Mini NestJS + CLI MVP

**Deliverables:**
- `PreviewBackendModule` + `PreviewClassroomController`
- `InMemoryClassroomState`
- `cli/dev-server.ts` starts two processes
- Minimum viable PreviewApp (only student view + submit button)

**Key dependency**: Plugin architecture P1 must land first (at least quiz + match + order migrated to plugin mode)

**Validation**: Run full flow with quiz plugin

### 8.3 P2 — Full Three-Pane UI

**Deliverables:**
- StoryList (left)
- StudentStage / TeacherStage (middle, switchable)
- Inspector (right, with Proxy call tracing)
- RoleSwitcher

**Validation criteria**: All 11 existing exercise types runnable in Preview

### 8.4 P3 — Admin Embed

**Deliverables:**
- admin-next new `pages/playground/[bundleId].tsx`
- Monaco editor integration (with Zod schema → JSON schema conversion)
- `playground_drafts` table + draft CRUD API
- iframe + postMessage security shell (isolates admin token)

**Note**: Admin doesn't directly reuse CLI's dev-server; instead uses the same Mini Backend library + custom controller wired into admin auth.

### 8.5 P4 — Public Demo

**Deliverables:**
- `exercise-preview build` command: static pack stories → HTML/JS
- Short code service (can reuse existing URL shortener or new)
- Rate-limited demo API key configuration
- Demo site scaffold (landing + catalog + share link routes)

**Note**: AI-graded types need a backend proxy in static deployment — can reuse admin backend or stand up a thin proxy.

---

## 9. Key Design Decisions

| Decision | Choice | Alternative | Reason |
|----------|--------|-------------|--------|
| Backend: NestJS vs pure-frontend mock | ✅ NestJS | Pure-frontend mock | Reuses ExerciseTypeRegistry / Zod validation / AiPromptBuilder real code; avoids behavioral drift |
| Stories file vs runtime JSON | ✅ Stories file | Runtime JSON only | Code-as-documentation; reused across tests/Preview/Demo |
| Admin allows runtime editing | ⚠️ Admin shell yes, CLI shell no | Both | CLI respects file-is-source; Admin is for non-engineers who need GUI editing |
| Mini Backend standalone process | ✅ Standalone NestJS process | Same-process worker thread | NestJS startup needs full IoC; standalone process easier to isolate + debug |
| Multi-bundle preview | ✅ Supported | One at a time | `exercise-preview ./pack-math ./pack-reading` — same process injects multiple plugins, left panel groups them |
| Inspector visible on public demo | ❌ Hidden | Visible | Don't expose grading internals (answers / AI prompt) to end users |
| Stories support async answerKey generation | ❌ Not in v1 | Supported | Sync declaration is sufficient; async introduces build/load timing complexity |
| Teacher observe mock submissions | Inline in story | Auto-generator | Don't introduce "class-wide data generator" — authors write a few samples; keep stories simple |
| AI grading: real LLM vs fixed fixture | ✅ Real LLM (default) | Fixed fixture | Real experience; `--mock-ai` flag switches to fixture mode (for CI) |
| Bundle loading mechanism | Dynamic import + DiscoveryModule | Static import | Supports both monorepo + npm package sources; consistent with plugin architecture's auto-discover |
| Short code service | Standalone service (decoupled) | Embedded in demo site | Decoupled; future reusable for other share scenarios |
| Draft storage | admin-next backend SQL table | localStorage | Cross-device + team collaboration |
| iframe security isolation (Admin embed) | ✅ iframe + postMessage | Direct render | Prevents plugin code from reading admin token / manipulating main frame DOM |

---

## 10. Relation to Plugin Architecture

### 10.1 Dependency Direction

```
@kedge-agentic/exercise-preview
   ↓ depends on
ExerciseTypeRegistry / GradingService / AiPromptBuilder
(plugin infrastructure already extracted from live-lesson backend)
   ↓ depends on
@kedge-agentic/exercise-pack-* (concrete bundles)
```

Preview package **only depends on plugin infrastructure (interfaces + registry)**, not on concrete bundles. Concrete bundles are injected via CLI flags or admin UI selection.

### 10.2 Stories Protocol as Plugin Architecture Extension Point

Plugin architecture defines 9 contracts (answerKeySchema / sanitize / grade / buildCheckItems / Component / canSubmit / handleCheckResult / enrichFromApi / ObserveClassView). Preview introduces a **10th contract**:

```typescript
// Recommended but not mandatory: every plugin bundle should export a stories file
// Naming convention: same name as plugin + .stories.ts
export const longDivisionStories = defineStories({ plugin: longDivisionPlugin, meta: {...} });
```

Bundles without stories still work (preview shows "no scenarios, please add .stories.ts"), but lose dev-time feedback loop and public showcase capability.

### 10.3 Timeline Alignment

| Plugin Architecture Stage | Preview Companion |
|--------------------------|-------------------|
| Plugin Stage 0 (Infrastructure) | Preview P0 (Core library) |
| Plugin Stage 1 (quiz+match+order migration) | Preview P1 (Mini Backend + CLI MVP) |
| Plugin Stage 2-5 (other type migrations) | Preview P2 (Full three-pane UI) |
| Plugin Stage 6 (Remove legacy code) | Preview P3 (Admin embed) |
| Plugin Stage 7 (Example pack + docs) | Preview P4 (Public demo) |

Preview P1 must wait for Plugin Stage 1 to complete (at least 1 type migrated to plugin mode). Recommend the two tracks proceed in lockstep: each migration group (A/B/C) completed, Preview validates one round.

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI-graded types call real LLM frequently in preview → cost | Medium | `--mock-ai` flag switches to fixed fixture; public demo rate-limited |
| Mini Backend behavioral drift from real backend | High | Strictly reuse `GradingService` / `ExerciseTypeRegistry`, no copy-paste; CI adds snapshot tests comparing grade outputs |
| Stories files become stale (answerKey schema changed without updating) | Medium | CI runs `vitest stories.test.ts`: each story does `safeParse(answerKeySchema, story.answerKey)`, fails on mismatch |
| Public demo abused (malicious traffic, info extraction) | Medium | Demo API key RPM limit; hide Inspector; short codes expirable |
| Admin Monaco editor out of sync with plugin Zod schema | Low | `zod-to-json-schema` auto-conversion; plugin schema change invalidates admin schema cache |
| iframe-embedded postMessage protocol abuse | Low | Origin whitelist + strongly-typed protocol fields (zod-validated) |
| Bundle multi-version conflicts | Medium | Preview only allows one version of same-named plugin at a time; multi-version testing uses multiple processes |

---

## 12. Appendix

### 12.1 Bundle Package Structure (with stories)

```
packages/exercise-pack-math/
├── backend/
│   ├── index.ts
│   └── plugins/
│       ├── long-division.plugin.ts
│       ├── long-division.schema.ts
│       └── long-division.observe.ts
├── frontend/
│   ├── index.ts                          # registerExerciseType()
│   ├── long-division.plugin.ts           # ExerciseUIPlugin
│   ├── long-division.stories.ts          # ← Preview entry
│   ├── LongDivisionExercise.tsx
│   ├── LongDivisionClassView.tsx
│   └── LongDivisionStudentView.tsx
├── tests/
│   └── stories.test.ts                   # Auto-generated from stories.ts
├── package.json
│   └── scripts: { "preview": "exercise-preview ." }
└── README.md
```

### 12.2 CLI API

```bash
# Start dev server
exercise-preview [bundle-paths...]
  --port <n>                # default 5283
  --backend-port <n>        # default 4321
  --mock-ai                 # AI-graded types use fixture
  --watch                   # auto-restart on file change (default true)

# Static pack public demo
exercise-preview build
  --bundles <glob>
  --output <dir>
  --base-url <url>
  --share-code-service <url>  # short code service URL

# Stories testing
exercise-preview test
  --bundles <glob>
  --reporter vitest
```

### 12.3 Relation to Existing Storybook

Why not just use Storybook:

| Dimension | Storybook | Exercise Preview |
|-----------|-----------|------------------|
| Focus | Generic React components | Exercise type plugins (with backend grade pipeline) |
| Backend integration | None | Embedded NestJS |
| Story data model | `args` + `render` | `answerKey` + `initialAns` + teacher mock |
| Inspector | Args/Controls panel | Plugin lifecycle + grade trace + Zod validation |
| Public demo | DIY scaffolding | Built-in build command |

**Trade-off**: Borrow CSF file format directly (familiar to developers), but write the runtime and UI ourselves — because what's previewed is "full-stack plugins," not "components".

### 12.4 Relation to Lesson Manifest

| Scenario | Data Source |
|----------|------------|
| Production classroom | `data/lessons/<id>/manifest.json`'s `readingSteps[].answerKey` |
| Preview | `*.stories.ts`'s `answerKey` |
| Admin draft | `playground_drafts` table |

Preview **does not read lesson manifest** — it's independent of classroom semantics, focusing only on a single answerKey's behavior under the plugin. This is intentional: preview = plugin trial run; manifest = course orchestration.

Future consideration: reverse tool — "extract step as story from manifest" in admin. Export a course step into a stories file, helping plugin authors regression-test with real data.

---

## 13. Multi-Step Plugin Preview (via reviewData reuse)

> Decision record — decided 2026-05-23

### 13.1 Decision Summary

Reuse the existing `useReviewRestore` mechanism + `ReviewData` type. **No new fields added to Plugin/Story contracts.**

**Reasons:**

- Zero new API, forward-compatible
- All 11 existing plugins already implement the review-restore pattern (see [`live-lesson/CLAUDE.md`](../CLAUDE.md) "Exercise Review Restore Pattern") — the "restore state from completed steps" code path already exists
- Story is straightforward to write: `reviewData.data` directly describes answers from completed steps

### 13.2 Story Pattern

Generic template:

```typescript
export const Step3Started: Story = {
  name: 'Start at step 3',
  answerKey: { ... },
  // Steps 1-2 completed, step 3 blank
  reviewData: {
    data: {
      // Data structure determined by plugin's parseXxxReview (see useReviewRestore)
      steps: [
        { stepId: 'observation_1', completed: true, ans: { ... } },
        { stepId: 'formula_1',     completed: true, ans: { ... } },
        // step 2/3 empty → student starts here
      ],
    },
    checkItems: [
      { idx: 0, correct: true },
      { idx: 1, correct: true },
    ],
  },
  initialPhase: 'idle',  // ← NOT 'review' — allows continued answering
};
```

**Key**: Set `initialPhase: 'idle'` (not `'review'`) — plugin's `useReviewRestore` restores completed-step state but UI still allows continued answering (i.e. "resume" rather than "review").

### 13.3 Concrete Example: guided-discovery 4 steps

```typescript
export const StartAtDerivation: Story = {
  name: 'Start at step 3 (polynomial verification)',
  answerKey: { type: 'guided-discovery', steps: [...] },
  reviewData: {
    data: {
      stepAnswers: {
        observation_choice_1: { choices: { c1: 0, c2: 1 } },
        formula_blanks_1:     { blanks:  { b1: 'a^2', b2: 'b^2' } },
        // derivation_blank_1 / text_blanks_1 empty → start here
      },
      completedStepIds: ['observation_choice_1', 'formula_blanks_1'],
    },
    checkItems: [],
  },
};
```

### 13.4 Concrete Example: rich-content-quiz parts

```typescript
export const StartAtPart3: Story = {
  name: 'Start at part 3',
  answerKey: { type: 'rich-content-quiz', parts: [q1, q2, q3] },
  reviewData: {
    data: {
      partAnswers: {
        q1: { imageUrls: ['mock-image.png'], score: 100 },
        q2: { imageUrls: ['mock-image.png'], score: 100 },
      },
      completedPartIds: ['q1', 'q2'],
    },
    checkItems: [],
  },
};
```

### 13.5 Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| Scaffold history not restored | rich-content-quiz's scaffold trigger records (which parts used which hint levels) default-lost | Story can use `metadata` to pass extra fields, consumed by custom plugin wrapper (rare scenario) |
| AI grading prompt/response not in reviewData | Cannot reproduce "last step's AI grading prompt" | Use §14 AI Prompt Debugger in combination |
| `enrichFromApi` may re-trigger | After reviewData restore, clicking submit again may invoke enrich twice | Plugin authors ensure `enrichFromApi` idempotency |
| Data structure determined by plugin | Story author needs to know plugin's `parseXxxReview` expected data format | IDE type support (via plugin schema inference) |

### 13.6 Fallback: Custom Wrapper

In rare cases where reviewData still isn't enough, the plugin can export a custom wrapper in `*.stories.ts`:

```typescript
// long-division.stories.ts
import { defineStories } from '@kedge-agentic/exercise-preview';
import { longDivisionPlugin } from './long-division.plugin';
import { LongDivisionExerciseWithInitial } from './LongDivisionExerciseWithInitial';

// Override original Component with wrapper
export default defineStories({
  plugin: { ...longDivisionPlugin, Component: LongDivisionExerciseWithInitial },
  meta: { ... },
});

export const CustomState: Story = {
  answerKey: { ... },
  metadata: { customStartStep: 3 },  // wrapper consumes metadata itself
};
```

`Story.metadata` is an open passthrough field, a private convention between custom wrapper and stories — not part of the generic contract.

---

## 14. AI Prompt Debugger (Three Levels)

> Decision record — decided 2026-05-23

### 14.1 Three-Level Capability Overview

| Level | Version | Capability | Plugin Contract Change |
|-------|---------|------------|------------------------|
| **L1** | v1 (MVP) | Inspector displays full system/user prompt + response (read-only) | None |
| **L2** | v2 | Edit prompt and re-run LLM call; original plugin parse path | None |
| **L3** | v3 | Edit response and re-run parse logic (bypass LLM) | **Required**: plugin splits grade into `buildGradePrompt` + `parseGradeResponse` |

### 14.2 L1 MVP: Read-Only Prompt + Response

**Implementation**: Add trace hook to `AiPromptBuilder.callLlm`.

```typescript
@Injectable()
export class AiPromptBuilder {
  private tracer: PreviewTracer | null = null;

  setTracer(tracer: PreviewTracer): void {
    this.tracer = tracer;
  }

  async callLlm(systemPrompt: string, userMessage: string, options): Promise<string> {
    const callId = randomUUID();
    this.tracer?.recordPromptStart(callId, { systemPrompt, userMessage, options });

    const t0 = performance.now();
    const response = await this.actuallyCall(systemPrompt, userMessage, options);
    const durationMs = performance.now() - t0;

    this.tracer?.recordPromptEnd(callId, { response, durationMs });
    return response;
  }
}
```

Inspector UI:

```
▼ AI Calls (3 total)
  └─ Call 1 (1.2s)
     systemPrompt: [click to expand]
     userMessage:  [click to expand]
     response:     [click to expand]
     options:      { responseFormat: 'json', temperature: 0 }
  └─ Call 2 (0.8s)
     ...
```

**Complexity**: Low. AiPromptBuilder adds ~30 lines; Inspector UI adds 1 component.

### 14.3 L2: Editable Prompt Re-run (record-and-replay)

**Core idea**: plugin.grade may call LLM multiple times. Inspector lets you edit one of them, but **other calls remain unchanged** — via record-and-replay caching other calls' old responses.

```typescript
@Injectable()
export class AiPromptBuilder {
  private replayCache = new Map<string, string>();  // callKey → mocked response

  async callLlm(systemPrompt: string, userMessage: string, options): Promise<string> {
    const callKey = hash(systemPrompt + userMessage);

    // Replay mode: cache hit → direct return (avoids re-calling real LLM)
    if (this.replayCache.has(callKey)) {
      return this.replayCache.get(callKey)!;
    }

    // Otherwise normal call
    const response = await this.actuallyCall(systemPrompt, userMessage, options);
    this.tracer?.recordCall(callKey, { systemPrompt, userMessage, response });
    return response;
  }

  /** Preview API: re-run with edited prompt */
  async rerunWithEditedPrompt(
    targetCallId: string,
    newSystemPrompt: string,
    newUserMessage: string,
    gradeCtx: GradeContext,
  ): Promise<GradeResult> {
    // 1. Cache other LLM calls' responses to replayCache
    for (const call of this.tracer.allCalls.filter(c => c.id !== targetCallId)) {
      this.replayCache.set(call.key, call.response);
    }
    // 2. Re-run plugin.grade — most calls hit cache, only target hits real LLM
    try {
      return await this.gradingService.grade(gradeCtx.key, gradeCtx.data);
    } finally {
      this.replayCache.clear();
    }
  }
}
```

Inspector UI:

```
▼ AI Call 1 (1.2s)
  systemPrompt:
    [textarea, editable]
    You are a middle school math teaching assistant...
  userMessage:
    [textarea, editable]
    Student answer: 3x + 5 = 11...
  response:
    {"score": 80, ...}
  [Rerun with these edits]  ← triggers rerunWithEditedPrompt
```

**Complexity**: Medium. AiPromptBuilder adds record-and-replay; Preview Inspector adds prompt editor + Rerun button + API endpoint.

### 14.4 L3: Editable Response Re-run Parse

**Prerequisite**: plugin contract upgrade — split `grade()` into "construct prompt" and "parse response" stages.

#### Plugin Contract Extension (optional, backward-compatible)

```typescript
export interface ExerciseTypePlugin {
  // ── Existing fields ──
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  // ── L3 New (optional): two-stage grade ──

  /** Stage 1: construct LLM call specs from answerKey + student data */
  buildGradePrompt?(ctx: GradeContext): GradePromptSpec[];

  /** Stage 2: parse LLM response array into GradeResult */
  parseGradeResponse?(responses: string[], ctx: GradeContext): GradeResult;
}

interface GradePromptSpec {
  systemPrompt: string;
  userMessage: string;
  options?: LlmCompletionOptions;
}
```

Plugins without `buildGradePrompt`/`parseGradeResponse` still use single-stage `grade()`; L3 debugger isn't available for them.

#### Preview API Endpoint

```typescript
@Controller('preview/sessions/:id')
export class PreviewClassroomController {
  @Post('rerun-parse')
  async rerunParse(
    @Param('id') id: string,
    @Body() body: { editedResponses: string[] },
  ) {
    const session = this.state.get(id);
    const plugin = this.registry.get(session.answerKey.type);

    if (!plugin.parseGradeResponse) {
      throw new BadRequestException(`Plugin "${plugin.type}" does not support parse-only mode`);
    }

    // Call parse stage directly, fully bypass LLM
    const gradeResult = plugin.parseGradeResponse(body.editedResponses, {
      key: session.answerKey,
      data: session.ans,
    });

    return {
      gradeResult,
      checkItems: this.registry.buildCheckItems(session.answerKey, session.ans, gradeResult),
    };
  }
}
```

Inspector UI:

```
▼ AI Call 1 — Response Editor (v3, only for upgraded plugins)
  response:
    [textarea, editable]
    {"score": 80, "explanation": "..."}
  [Rerun parser with edited response]  ← triggers rerunParse
```

**Complexity**: High. Requires:
1. Plugin contract upgrade (backward-compatible, but new plugins should follow)
2. Refactor 6 existing AI-graded plugins
3. Preview Inspector + API endpoint

**Benefit**: Debugging "parse logic" needs no LLM call (saves 1-3s + token cost per iteration).

### 14.5 L3 Migration Effort for 6 AI Plugins

| Plugin | Current state | Effort |
|--------|--------------|--------|
| `matrix` | Single LLM call in grade() | **Low** — extract prompt construction and response parsing |
| `map` | Same | **Low** |
| `fill-blank` | Same | **Low** |
| `image-upload` | Single LLM + image base64 encoding | **Medium** — image payload already prepared in buildGradePrompt stage |
| `rich-content-quiz` | Multi-part parallel LLM calls | **Medium** — buildGradePrompt returns array (one spec per part); parseGradeResponse accepts array |
| `guided-discovery` | Multi-step LLM + image OCR cache (see commit `d3ded228`) | **High** — preserve OCR cache logic; parallelization + cache + parse interweave is complex |

Overall feasible, but guided-discovery refactor needs careful OCR cache handling.

### 14.6 Implementation Path

| Stage | Content | Dependency |
|-------|---------|-----------|
| **Preview P2.5** | L1 MVP: AiPromptBuilder trace hook + Inspector read-only display | Preview P2 complete |
| **Preview P3.5** | L2: record-and-replay + editable prompt rerun | L1 complete + Mini Backend stable |
| **Plugin Stage 8** | L3: `buildGradePrompt` / `parseGradeResponse` contract + 6 AI plugin refactor | All 11 existing plugins migrated to plugin mode (Plugin Stage 6) |

**Key**: L3 is not standalone Preview work — it depends on plugin contract upgrade, so belongs in plugin architecture's new stage (suggested name: "Plugin Stage 8 — Two-Stage Grade").

### 14.7 record-and-replay Invalidation Scenarios

L2's record-and-replay uses prompt hash as cache key. The following break the cache:

1. **Prompt contains timestamp / random ID** — different hash every time, replay fails
2. **Plugin uses `temperature > 0`** — same prompt yields different response
3. **Streaming response** — not supported (Preview L2 only supports non-streaming calls)

**Mitigation**: Plugin authors avoid timestamps in prompts; AI-graded types recommend `temperature=0`.

---

## 15. Resource Mock Design (fixtures + upload + URL abstraction)

> Decision record — decided 2026-05-23

### 15.1 Decision Summary

| Sub-decision | Choice |
|-------------|--------|
| Fixtures git strategy | Threshold-based: <200KB in git; over uses Git LFS or placeholder |
| URL abstraction | Introduce `uploadFile` / `resolveResourceUrl` as platform capabilities (injected into `ExercisePluginProps`) |
| Landing stage | Preview P2 (same window as full three-pane UI) |

### 15.2 Three Resource Pipelines Compared

| Pipeline | Production | Preview |
|----------|-----------|---------|
| Student upload | `POST /api/lessons/<id>/upload` → object storage → CDN URL | `POST /preview/upload` → `/tmp/preview-uploads/` → `/preview/uploads/<id>` |
| Static resource | `GET /api/lessons/<id>/resources/<filename>` | `GET /preview/fixtures/<bundle>/<filename>` |
| AI visual grading | Backend fetches CDN URL → base64 → vision model | Backend fetches `http://localhost:4321/preview/...` → base64 → vision model (same model) |

### 15.3 Fixtures Static Resources

#### Directory convention

```
packages/exercise-pack-math/
├── fixtures/                              ← Mini Backend auto-serves
│   ├── handwriting-correct.png            (< 200KB, in git)
│   ├── handwriting-wrong.png              (< 200KB, in git)
│   ├── scene-square-plot.webp             (1.2MB, Git LFS)
│   └── placeholder-large-image.json       (metadata placeholder when LFS unavailable)
└── frontend/
    └── long-division.stories.ts
```

#### Story usage

```typescript
import { fixture } from '@kedge-agentic/exercise-preview';

export const ClassroomFullSubmissions: Story = {
  name: '10 student submissions',
  initialRole: 'teacher',
  classSubmissions: [
    {
      studentId: 's1', name: 'Alice',
      data: { imageUrls: [fixture('handwriting-correct.png')] },
      score: 100,
    },
    {
      studentId: 's2', name: 'Bob',
      data: { imageUrls: [fixture('handwriting-wrong.png')] },
      score: 50,
    },
  ],
};
```

`fixture(name)` returns `/preview/fixtures/<bundle-name>/<name>`, auto-served by Mini Backend via bundle metadata.

#### 200KB Threshold Rule

| Size | Strategy | Tool |
|------|----------|------|
| < 200KB | In git directly | None (regular commit) |
| 200KB - 5MB | Git LFS | `git lfs track "*.webp" "*.png"` |
| > 5MB | Placeholder + metadata | 1x1 pixel placeholder + `.meta.json` (real size/checksum) |

Reason: Uncontrolled bundle git size slows monorepo clone (CCAAS monorepo's npm install is already heavy). 200KB threshold balances usability and size.

#### Mini Backend Auto-discovery

```typescript
@Module({
  providers: [
    {
      provide: 'FIXTURES_DIRS',
      useFactory: () => process.env.PREVIEW_BUNDLES?.split(',')
        .map(b => ({ bundle: path.basename(b), dir: path.join(b, 'fixtures') }))
        .filter(x => fs.existsSync(x.dir)) ?? [],
    },
  ],
})
export class PreviewFixturesModule {}

@Controller('preview/fixtures')
export class PreviewFixturesController {
  constructor(@Inject('FIXTURES_DIRS') private dirs: Array<{ bundle: string; dir: string }>) {}

  @Get(':bundle/:filename')
  serve(@Param('bundle') bundle: string, @Param('filename') filename: string, @Res() res) {
    const entry = this.dirs.find(d => d.bundle === bundle);
    if (!entry) throw new NotFoundException();
    const fullPath = path.join(entry.dir, filename);
    if (!fullPath.startsWith(entry.dir)) throw new ForbiddenException();  // path traversal guard
    res.sendFile(fullPath);
  }
}
```

### 15.4 Mock Upload Endpoint

#### Implementation

```typescript
@Controller('preview')
export class PreviewUploadController {
  constructor(private readonly state: InMemoryClassroomState) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(@UploadedFile() file: Express.Multer.File): { url: string } {
    if (!file) throw new BadRequestException('No file uploaded');
    const id = randomUUID();
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const tmpDir = process.env.PREVIEW_UPLOAD_DIR ?? '/tmp/preview-uploads';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, filename), file.buffer);
    return { url: `/preview/uploads/${filename}` };
  }

  @Get('uploads/:filename')
  serveUpload(@Param('filename') filename: string, @Res() res) {
    const tmpDir = process.env.PREVIEW_UPLOAD_DIR ?? '/tmp/preview-uploads';
    const fullPath = path.join(tmpDir, filename);
    if (!fullPath.startsWith(tmpDir)) throw new ForbiddenException();
    res.sendFile(fullPath);
  }
}
```

#### Lifecycle

- Preview session ends (browser closed / `/preview/sessions/:id/reset`) → async cleanup of files uploaded in that session
- Mini Backend restart → `/tmp/preview-uploads` fully cleared (startup hook)
- File size limit: 10MB (matches prod, makes "exceed limit" errors reproducible)

### 15.5 Platform Capability Extension (ExercisePluginProps)

#### New fields

```typescript
// frontend/src/components/student/exercise/exercise-type-plugin.ts

export interface ExercisePluginProps {
  // ── Existing fields ──
  exercise, ans, setAns, allDone, reviewData, checkResultState,
  onDone, stepIdx, taskId, locale,
  onOverlayChange, onScaffoldPush, submit, studentId, sessionCode,

  // ── New (optional): resource handling capabilities ──

  /**
   * Upload file, returns accessible URL.
   * Prod: calls /api/lessons/<id>/upload. Preview: calls /preview/upload.
   * When not injected, plugin should fall back to legacy logic (compat).
   */
  uploadFile?: (file: File, options?: UploadOptions) => Promise<{ url: string }>;

  /**
   * Resolve resource relative path to absolute URL.
   * Prod: `/api/lessons/<id>/resources/handwriting.png`
   * Preview: `/preview/fixtures/<bundle>/handwriting.png`
   */
  resolveResourceUrl?: (relativePath: string) => string;
}

export interface UploadOptions {
  /** Upload progress callback (0-1) */
  onProgress?: (pct: number) => void;
  /** Business-side correlation (e.g. part id) */
  context?: Record<string, unknown>;
}
```

#### Injection Points

| Environment | Injection Site | Implementation |
|------------|---------------|----------------|
| Production (PracticePhase) | `<plugin.Component uploadFile={prodUploadFile} />` | `prodUploadFile = file => POST(/api/lessons/${lessonId}/upload, file)` |
| Preview (PreviewApp) | `<plugin.Component uploadFile={previewUploadFile} />` | `previewUploadFile = file => POST(/preview/upload, file)` |

#### Plugin Usage

**Before refactor (image-upload plugin hardcoded):**

```typescript
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/lessons/${lessonId}/upload`, { method: 'POST', body: formData });
  const { url } = await res.json();
  setAns(prev => ({ ...prev, imageUrls: [...(prev.imageUrls ?? []), url] }));
};
```

**After refactor (using platform capability):**

```typescript
const handleUpload = async (file: File) => {
  if (!props.uploadFile) throw new Error('uploadFile capability not injected');
  const { url } = await props.uploadFile(file);
  setAns(prev => ({ ...prev, imageUrls: [...(prev.imageUrls ?? []), url] }));
};
```

### 15.6 AI Grading Pipeline (Vision Model)

#### Backend image URL fetching

Vision models (qwen3-vl-plus) need base64, not URL. `AiPromptBuilder` internally fetches image and converts to base64:

```typescript
async fetchImageAsBase64(url: string): Promise<string> {
  // Handle relative URL: preview env prepends PREVIEW_BASE_URL, prod env prepends API_BASE_URL
  const absoluteUrl = url.startsWith('http')
    ? url
    : `${process.env.PREVIEW_BASE_URL ?? process.env.API_BASE_URL ?? ''}${url}`;

  const response = await fetch(absoluteUrl);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
```

Mini Backend startup sets `PREVIEW_BASE_URL=http://localhost:4321`; AiPromptBuilder can fetch fixtures and uploads normally.

#### OCR Cache Compatibility (guided-discovery)

guided-discovery has an OCR cache mechanism (commit `d3ded228`): identical images hash to cached OCR results, avoiding redundant calls. Under Preview:

- Fixtures images: stable hash → high OCR cache hit rate (saves tokens across preview runs)
- Mock uploads: random UUID → different hash → fresh OCR every time

Doesn't break cache logic; just means mock uploads' OCR isn't reused. Acceptable.

### 15.7 Existing AI/Upload Plugin Refactor Effort

| Plugin | Refactor Point | Effort |
|--------|---------------|--------|
| `image-upload` | Replace hardcoded `/api/lessons/<id>/upload` with `props.uploadFile()` | Low (1-2 replacements) |
| `rich-content-quiz` | Same + `props.uploadFile` must propagate to internal part components under `selfManagedSubmit=true` | Medium |
| `guided-discovery` | Same + use `props.resolveResourceUrl()` for resource references (e.g. embedded hint images) | Medium |
| Other 8 plugins | No image resources | 0 |

#### Backward Compatibility Strategy

For environments without `uploadFile` injected (very old callers) → plugin can fall back to legacy logic:

```typescript
const upload = props.uploadFile ?? legacyUpload(`/api/lessons/${lessonId}/upload`);
```

But recommend **switching during Plugin Stage 2-3 migration** to avoid long-term dual-path maintenance.

### 15.8 Subtasks Within Preview P2

| Subtask | Deliverable | Validation |
|---------|------------|------------|
| P2.a | `fixture(name)` helper + `PreviewFixturesController` | Unit test: serves bundle/fixtures/*.png |
| P2.b | `PreviewUploadController` + tmp file management | E2E: browser upload image → URL returned → `<img>` displays |
| P2.c | `ExercisePluginProps.uploadFile` / `resolveResourceUrl` fields + PracticePhase injects prod impl | Type test: post-injection types correct |
| P2.d | image-upload / rich-content-quiz / guided-discovery refactor | Existing E2E (`04-exercise-check.spec.ts`) still passes |
| P2.e | AiPromptBuilder `PREVIEW_BASE_URL` support | E2E: vision model call succeeds in preview env |
| P2.f | Git LFS config + bundle template README explains fixtures threshold rule | Doc verification |

Total effort estimate: 1-2 weeks (in parallel with P2 three-pane UI).

### 15.9 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `uploadFile` capability not injected in some call paths → plugin throws | TypeScript marks `?` optional; plugin adds runtime guard + friendly error |
| Mock upload's `/tmp/preview-uploads` cleaned by production OS | Startup `mkdir -p` + `PREVIEW_UPLOAD_DIR` config override |
| Large fixtures in git slow monorepo clone | 200KB threshold + Git LFS monitoring (CI checks files > 200KB) |
| Preview fetches fixtures fail (path error) | Path traversal guard + startup-time fixtures dir validation + 404 with clear error (incl. expected path) |
| Vision model token cost (fixtures repeated calls) | OCR/vision cache by image hash; preview docs recommend stable fixture filenames |

---

## 16. Internationalization (i18n)

> Decision record — decided 2026-05-23

### 16.1 Decision Summary

| Sub-decision | Choice |
|-------------|--------|
| Audience (A) | **A3**. Data + all UI (CLI + Admin + Demo three shells all i18n) |
| Data mode (B) | **B2**. `story.locale` multi-version (naming suffix `Default_zh` / `Default_en`) |
| Timing (C) | **C2**. v2 ships formally with demo launch; v1 i18n-ready but only configures zh-CN |
| Languages (D) | **D2**. Chinese + English |

**Coordination strategy**: A3 (full UI i18n) + C2 (ship in v2) = **v1 code must be i18n-ready, but locale only configures zh-CN**. All UI text uses `t('key')`, avoiding v2 retrofit searching for hardcoded Chinese.

### 16.2 Data Layer Mode (B2)

#### Naming convention

```
long-division.stories.ts
  ├── export const Default_zh
  ├── export const Default_en
  ├── export const PartiallyAnswered_zh
  └── export const PartiallyAnswered_en
```

`<storyName>_<locale>` suffix. Preview UI filters by current locale.

#### Story example

```typescript
export const Default_zh: Story = {
  name: 'Default (Chinese)',
  locale: 'zh',
  answerKey: {
    type: 'quiz',
    answers: [{
      questionText: '哪个结构产生这个结果?',
      options: ['a²+b²', 'a²-b²', '2ab', 'ab'],
      correct: 1,
    }],
  },
};

export const Default_en: Story = {
  name: 'Default (English)',
  locale: 'en',
  answerKey: {
    type: 'quiz',
    answers: [{
      questionText: 'Which structure produces this result?',
      options: ['a²+b²', 'a²-b²', '2ab', 'ab'],
      correct: 1,
    }],
  },
};
```

#### Story type extension

```typescript
export interface Story {
  // ... existing fields
  locale?: 'zh' | 'en';  // v2 new (optional in v1)
}
```

#### Relation to Existing manifest `xxxZh` Pattern

Story uses B2 multi-version; manifest still uses `xxxZh` dual-field. Two interoperate via converters:

- **manifest → story**: scan manifest, split fields by locale → generate single-language answerKey
- **story → manifest**: merge stories with same name but different locale → add `Zh` suffix to fields

admin Playground built-in tools:

```typescript
mergeLocalizedStories(['Default_zh', 'Default_en']) → manifestAnswerKey
splitToLocalizedStories(manifestAnswerKey) → ['Default_zh', 'Default_en']
```

### 16.3 UI Layer Mode (A3 + C2 Coordination)

#### Tech stack

- `react-i18next` (consistent with admin-next)
- Locale files: `@kedge-agentic/exercise-preview/locales/{zh-CN,en}.json`

#### v1: i18n-ready but no English shipped

```typescript
// All UI components use t()
<button>{t('preview.submit')}</button>  // not <button>提交</button>

// v1: only configure zh-CN
i18n.init({
  resources: { 'zh-CN': zhCN },
  fallbackLng: 'zh-CN',
});

// v2: add en
i18n.init({
  resources: { 'zh-CN': zhCN, en },
  fallbackLng: 'zh-CN',
});
```

#### Locale Sources Per Shell

| Shell | Locale source | v1 default |
|-------|--------------|------------|
| CLI | `process.env.PREVIEW_LOCALE` or `--locale` flag | `zh-CN` |
| Admin | User preference (admin-next existing) | `zh-CN` |
| Public Demo | URL prefix `/zh/p/...` `/en/p/...` | `zh-CN` |

### 16.4 Public Demo URL Routing (v2)

```
demo.kedge.com/
├── /zh/p/long-division-abc123
└── /en/p/long-division-abc123
```

Build-time generates static routes per locale. Same short code, different locale maps to different story suffix:

```
short-code 'abc123' → bundle: long-division, story-base: Default
  ├── /zh/p/abc123 → loads Default_zh
  └── /en/p/abc123 → loads Default_en
```

When a locale's story is missing, fall back to zh with a warning: `English version not available; showing Chinese`.

### 16.5 v1-v2 Roadmap

#### v1: i18n-ready Workload (distributed across P0-P4)

| Preview Stage | i18n Task |
|--------------|----------|
| P0 | i18next integration + zh-CN.json skeleton |
| P1 | CLI dev-server + Inspector text `t()`-ification |
| P2 | PreviewApp / StoryList / StudentStage / TeacherStage / Inspector / RoleSwitcher `t()`-ification |
| P3 | Admin Playground text + Monaco editor error messages `t()`-ified |
| P4 | Public Demo text + URL routing i18n prep (without exposing switcher) |

v1 uses zh-CN throughout, no English. Developers writing code are **strictly required** to use `t()`.

#### v2: Formal Ship Steps

| Step | Content |
|------|---------|
| 1 | Translate zh-CN.json → en.json (~100 keys) |
| 2 | Public Demo URL routing adds locale prefix |
| 3 | Add language switcher in top-right UI (only Public Demo; CLI/Admin also add but default zh) |
| 4 | Bundle author docs: how to write `_en` suffix stories |
| 5 | Catalog page filters bundles by locale |

**Trigger condition**: First overseas ToB customer lead emerges, or company strategy clarifies internationalization direction.

### 16.6 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| v1 developers forget `t()`, hardcode Chinese | ESLint rule `no-literal-chinese-in-jsx` (custom rule scanning Chinese literals) |
| Multi-locale maintenance burden (double stories per bundle) | Bundle can write only Chinese stories; preview auto-fallback; provide LLM translation tool for auto-generating `_en` drafts |
| zh-CN.json and en.json keys out of sync | CI checks two JSON key sets equal |
| manifest `xxxZh` and story `_locale` dual-pattern confusing | Doc clarifies: manifest uses `xxxZh` (legacy compat), story uses `_locale` suffix (new design) |
| v1 code slower 30% (every string needs key extraction) | Accept — retrofit cost far exceeds upfront i18n-ready cost |

---

## 17. Collaborative Editing (Admin Playground)

> Decision record — decided 2026-05-23

### 17.1 Decision Summary

| Sub-decision | Choice |
|-------------|--------|
| v1 scope | **A1**. Don't do collaborative editing |
| Presence Indicator | **C2.5**. v1 doesn't do standalone; v2 if B3 Yjs is enabled, awareness comes for free |
| v2+ tech selection (pre-decided) | **Yjs CRDT** — explicitly not B1 pessimistic lock / B2 optimistic lock / B4 self-built OT |

**Core stance**: Curriculum design team is small; intra-team coordination is sufficient. Don't introduce collaboration tech stack maintenance burden. But basic data protection is needed to avoid "silent data loss from simultaneous editing without awareness".

### 17.2 v1 Work Mode

#### Collaboration: team convention

- Before editing, notify in team IM (Feishu / DingTalk): "I'm editing draft X now"
- Edit windows short (recommended < 30 min); save immediately after editing
- Frequent autosave (every 5 min) reduces data loss window

#### Data Protection (lightweight, required)

Even without conflict detection, avoid "mysterious data loss":

| Mechanism | Implementation |
|-----------|---------------|
| Show last modified time + author | UI top: "Last modified: Alice · 5 min ago" |
| Client-side autosave to localStorage | Protects against browser crash / accidental close |
| Re-read server check before save | On save click, re-fetch; if `last_modified_at` changed → warning |
| Version history | `playground_drafts` table stores last 10 version snapshots, one-click rollback |

#### Pre-Save Check Warning Dialog

```
⚠️ This draft has been modified by someone else since you opened it

  Their version: Bob · 3 min ago
  Your version: based on state from 2 hours ago

  [Overwrite (not recommended; check theirs first)]
  [Cancel (preserve your local draft)]
  [Open diff view]
```

Avoid silent overwriting and data loss.

### 17.3 v2 Upgrade Triggers

Any of the following starts v2 collaborative editing:

1. Curriculum design team grows beyond 5 people
2. "Two people editing same draft, data lost" incidents occur 3+ times
3. Multi-person collaboration scenarios (e.g. approval workflow, parallel large-manifest editing) become product requirements

### 17.4 v2 Tech Selection: Yjs CRDT (Pre-Decided, Skip Evaluation Later)

When v2 starts, **directly choose Yjs**, no re-evaluation. Reasons:

| Alternative | Reason Rejected |
|-------------|----------------|
| B1 Pessimistic lock | Poor collaboration UX; stale lock issues; still needs Presence supplement |
| B2 Optimistic lock | Poor UX in frequent-conflict scenarios (frequent "please refresh") |
| **B3 Yjs** | ✅ **Industry de-facto standard; y-monaco directly binds Monaco editor; awareness includes Presence** |
| B4 Self-built OT | Excessive maintenance burden; no mature community implementation |

#### v2 Implementation Steps

1. Introduce `yjs` + `y-websocket` + `y-monaco`
2. Draft doc structure becomes `Y.Doc` (answerKey JSON expressed as `Y.Map`)
3. WebSocket server: use existing [y-websocket-server](https://github.com/yjs/y-websocket) or integrate into admin-next backend
4. UI adds awareness avatars + remote cursors (auto-gets Presence Indicator)
5. Persistence: `Y.Doc` serialized to database, snapshot on demand

### 17.5 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| v1 actually sees "silent overwrites" | §17.2 pre-save check + version history (last 10 snapshots) safety net |
| Browser close → data loss | localStorage autosave + `beforeunload` prompt |
| v2 start timing misjudged (too early or too late) | Trigger condition list + actual event statistics-driven decision |
| Choosing Yjs proves wrong later | Accept — Yjs is industry de-facto standard, lowest probability of being wrong |
| v1 users feel "feature missing" | Doc explains: collaborative editing is v2+ roadmap; small team scale doesn't prioritize it |

---

## 18. Bundle Marketplace & Public Demo Form

> Decision record — decided 2026-05-23

### 18.1 Decision Summary

| Sub-decision | Choice |
|-------------|--------|
| v1 Demo form (A) | **A2**. Add `/catalog` browse page (implement in P4 late stage) |
| Third-party upload (B) | **B2**. Not allowed yet, but architecture preserves extension points |
| Migration path (C) | **C2**. Provide manifest export (no one-click install) |
| Business model | Engineering doesn't decide; business team launches as needed |

**Core stance**: v1 does "light marketplace" — has catalog, has export, but no user system, no third-party upload, no rating/comments. Architecture preserves extension points for future marketplace evolution.

### 18.2 v1 Form: Catalog + Demo + Export

```
demo.kedge.com/
├── /                                # Homepage: promotion + featured bundles
├── /catalog                         # Browse all official bundles
├── /catalog?subject=math            # Filter by subject
├── /catalog?type=guided-discovery   # Filter by exercise type
├── /b/exercise-pack-math            # Bundle detail page (all stories)
├── /p/<short-code>                  # Single story share link
└── /export/<bundle-id>              # Download manifest snippet
```

### 18.3 Catalog Implementation Details (A2)

#### Build-time index

```bash
exercise-preview build \
  --bundles ./packages/exercise-pack-* \
  --output ./dist \
  --emit-catalog                    # ← new flag
```

Build process:

1. Scan all bundles' `meta` fields (`title`, `description`, `tags`, `subject`)
2. Generate `catalog.json` index (each bundle's story count, thumbnail, tags)
3. Statically deploy to `/catalog.json`
4. Frontend `/catalog` route lazy-fetches + client-side filters

#### Catalog Page UI Sketch

```
┌─ KedgeAgentic Catalog ─────────────────────────────────────┐
│ Filter: [All ▼] [Subject: Math ▼] [Type: guided-discovery ▼]│
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ exercise-    │ │ exercise-    │ │ exercise-    │         │
│ │ pack-math    │ │ pack-reading │ │ pack-physics │         │
│ │              │ │              │ │              │         │
│ │ Diff Squares │ │ Reading Strat│ │ Mechanics    │         │
│ │ 11 stories   │ │ 8 stories    │ │ 6 stories    │         │
│ │ [Try]        │ │ [Try]        │ │ [Try]        │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
└────────────────────────────────────────────────────────────┘
```

#### No Backend Capabilities

No search backend / no ranking algorithm / no personalization — purely static + client-side filtering.

### 18.4 Manifest Export (C2)

#### User Operation Flow

1. User tries a story on demo site (e.g. `/p/long-division-abc123`)
2. Click "Export to my admin" button in top-right
3. Modal shows the story's manifest snippet (JSON format)
4. User copies JSON
5. Pastes into their own admin's lesson manifest editor

#### Export Format

```json
{
  "_source": "kedge-demo-marketplace",
  "_bundleId": "exercise-pack-math",
  "_bundleVersion": "1.2.0",
  "_storyName": "Default_zh",
  "_exportedAt": "2026-05-23T10:00:00Z",
  "_instructions": "Paste the answerKey portion into your lesson manifest's readingSteps[].answerKey field",

  "answerKey": {
    "type": "guided-discovery",
    "steps": [ /* ... */ ]
  }
}
```

Metadata header for traceability + user understanding of how to use it.

#### Prerequisite

User's admin must **already have the corresponding bundle package installed** (e.g. `exercise-pack-math`). Export page shows reminder:

```
⚠️ Before using this manifest, ensure your admin has exercise-pack-math installed:
   npm install @kedge-agentic/exercise-pack-math

   Without it, answerKey will fail with "Unknown exercise type".
```

#### Not Done: One-Click Install (C3)

CCAAS admin is currently ToB private deployment, lacks multi-tenancy. One-click install requires:

- OAuth authorization flow (demo site → user admin)
- Bundle version management (npm install automation)
- Admin backend's "receive bundle" API

Large effort + depends on admin multi-tenancy refactor; not done in v1.

### 18.5 Architecture Extensibility (B2)

Although v1 doesn't allow third-party uploads, the bundle loading mechanism preserves extension points for future:

#### Existing Mechanism (already in place)

- Bundle self-registration (`@ExerciseType` decorator)
- Dynamic import (`import('exercise-pack-xxx/backend')`)
- Registry auto-discovery (onModuleInit)

#### Interfaces Reserved for Future (v1 doesn't implement, just documented)

```typescript
// Future v2 marketplace upload injection path
interface BundleManifest {
  id: string;
  version: string;
  publisher: 'official' | 'community';     // ← v1 always 'official'
  source: 'npm' | 'github' | 'upload';     // ← v1 always 'npm'
  checksum?: string;                        // ← required for third-party upload
  signature?: string;                       // ← official signature verification
}
```

v1 doesn't add these fields to catalog.json. v2 marketplace launch adds incrementally; existing bundles default to `publisher: 'official'`.

### 18.6 v2+ Triggers

Any of the following starts v2 marketplace:

| Trigger | Decision Owner |
|---------|---------------|
| Official bundle count > 20, third parties explicitly request to contribute | Engineering + Product |
| ToB customer requests "we want to publish our school's exercise types on KedgeAgentic" | Business |
| Company strategy clearly turns toward SaaS platform (not ToB private deployment) | Business |
| Demo site traffic > 10K/month and export conversion rate > 5% | Product + Business |

### 18.7 Out of v1 Scope (Business Team Decides)

| Project | Decision Owner |
|---------|---------------|
| Whether to charge for some bundles | Business + Finance |
| Third-party revenue sharing model | Business + Legal |
| Third-party upload review workflow | Business + Operations |
| User rating / comment system | Product |
| User account system (does demo site need login) | Product + Business |

Engineering team **doesn't proactively pursue** these; awaits clear business signal.

### 18.8 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Catalog page high traffic but low export conversion | Prominently place "Try + Export" buttons on Catalog detail; analyze conversion funnel |
| User copies manifest but errors (bundle not installed) | Export page upfront reminder + modal confirmation + doc link |
| Third party screenshots demo content for commercial use without permission | Add copyright notice in footer; high-value bundles add watermark (optional) |
| B2 architecture reserved but unused → over-engineering | Only catalog.json reserves fields; other extension points not implemented in v1, only documented |
| Demo site abused for AI grading → token cost | Already designed in §5.4: rate-limited demo API key + short code expiration |

