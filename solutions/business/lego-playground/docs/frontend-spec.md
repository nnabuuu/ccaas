# Frontend Development Specification

## Image-to-LEGO Mosaic Converter

This document provides all necessary context for AI tools to generate a frontend application that integrates with the Image-to-LEGO backend API.

**Project Structure:**
```
image-to-lego/
├── backend/     # NestJS API (already implemented)
├── frontend/    # Create frontend here
├── docs/        # This documentation
└── specs/       # Feature specifications
```

---

## 1. Application Overview

### What This Creates

A **2D LEGO mosaic** (flat wall art / photo frame style), like the official LEGO Art sets - **NOT a 3D model**:

```
Front view: The image as pixel art
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │ █ │ █ │ █ │ █ │   │   │   │
├───┼───┼───┼───┼───┼───┼───┼───┤
│ █ │   │   │   │   │ █ │   │   │  ← Each cell = 1 LEGO stud
├───┼───┼───┼───┼───┼───┼───┼───┤
│ █ │   │   │   │   │ █ │   │   │
├───┼───┼───┼───┼───┼───┼───┼───┤
│ █ │ █ │ █ │ █ │ █ │ █ │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
```

```
Side view: 2-3 layers for structural strength
┌─────────────────────────┐  ← Layer 3 (top bricks)
├──────┬──────┬───────────┤  ← Layer 2 (staggered joints)
├───┬──┴───┬──┴──┬────────┤  ← Layer 1 (base)
└───┴──────┴─────┴────────┘
        ↑
   Joints don't align vertically = stronger structure
```

The "layers" are for **structural integrity** (staggered brick joints), not 3D depth of the image subject.

### Purpose
A web application that allows users to:
1. Upload an image
2. Configure mosaic parameters (dimensions, colors, brick types)
3. Preview and iteratively refine LLM-generated LEGO mosaic designs
4. Approve a final design and receive a bill of materials

### Target Users
- LEGO enthusiasts creating custom mosaic art (like LEGO Art sets)
- Artists wanting to convert images to buildable 2D LEGO wall art
- Educators teaching color theory and spatial reasoning

### Key User Flows

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Upload    │ ──► │  Configure   │ ──► │   Review    │ ──► │   Approve    │
│   Image     │     │  Parameters  │     │  & Refine   │     │   & Export   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

---

## 2. API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
Currently none required (add auth header support for future implementation).

### Endpoints

#### Health Check
```http
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "llm_providers": {
    "openai": true,
    "claude": false,
    "gemini": true
  }
}
```

#### One-Shot Conversion (Simple Mode)
```http
POST /convert
Content-Type: multipart/form-data

image: <file>
width_studs: 48 (optional, 8-128, default: 48)
height_studs: 48 (optional, 8-128, default: 48)
layer_count: 2 (optional, 2-3, default: 2)
color_palette: [1, 5, 11, 15] (optional, array of BrickLink color IDs)
brick_pool: ["3024", "3023", "3022"] (optional, array of BrickLink part IDs)
resampling: "lanczos" | "mitchell" (optional, default: "lanczos")
background_color: "#FFFFFF" (optional, hex color for transparency)
llm_provider: "auto" | "openai" | "claude" | "gemini" (optional)
```

Response:
```json
{
  "success": true,
  "mosaic": {
    "width_studs": 48,
    "height_studs": 48,
    "layer_count": 2,
    "placements": [
      {
        "brick_id": "3024",
        "color_id": 11,
        "x": 0,
        "y": 0,
        "layer": 0,
        "rotation": 0
      }
    ],
    "bill_of_materials": [
      { "brick_id": "3024", "color_id": 11, "quantity": 150 }
    ],
    "metadata": {
      "generation_timestamp": "2024-01-15T10:30:00Z",
      "source_image_hash": "abc123...",
      "algorithm": "llm",
      "llm_provider": "openai",
      "total_brick_count": 2304,
      "unique_colors_used": 12,
      "coverage_percent": 100
    }
  },
  "processing_time_ms": 5230,
  "warnings": []
}
```

#### Start Session (Iterative Mode)
```http
POST /sessions
Content-Type: multipart/form-data

image: <file>
width_studs: 48
height_studs: 48
layer_count: 2
color_palette: [1, 5, 11]
brick_pool: ["3024", "3023"]
resampling: "lanczos"
background_color: "#FFFFFF"
llm_provider: "auto"
max_iterations: 5
```

Response:
```json
{
  "success": true,
  "session_id": "uuid-here",
  "status": "in_progress",
  "config": {
    "width_studs": 48,
    "height_studs": 48,
    "layer_count": 2,
    "color_palette": [1, 5, 11],
    "brick_pool": ["3024", "3023"],
    "resampling": "lanczos",
    "background_color": "#FFFFFF",
    "llm_provider": "auto"
  },
  "current_iteration": 1,
  "max_iterations": 5,
  "current_result": {
    "iteration_number": 1,
    "mosaic": { /* Mosaic object */ },
    "preview_url": "https://signed-s3-url...",
    "llm_assessment": {
      "overallScore": 0.85,
      "colorAccuracy": 0.90,
      "structuralIntegrity": 0.82,
      "visualAppeal": 0.83,
      "summary": "Good color representation with minor structural issues",
      "issues": ["Some color banding in gradient areas"],
      "suggestions": [
        {
          "type": "color",
          "priority": 1,
          "description": "Add more mid-tones to smooth gradients"
        }
      ],
      "confidence": 0.85
    },
    "processing_time_ms": 4500,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:05Z",
  "expires_at": "2024-01-16T10:30:00Z"
}
```

#### Get Session
```http
GET /sessions/:sessionId
```

#### Submit Decision
```http
POST /sessions/:sessionId/decision
Content-Type: application/json

{
  "decision": "approve" | "reject" | "refine",
  "feedback": "The colors look too saturated in the sky area",
  "concern_areas": [
    {
      "description": "Sky colors too bright",
      "type": "color",
      "region": { "startX": 0, "startY": 0, "endX": 48, "endY": 16 }
    }
  ]
}
```

#### Get Session History
```http
GET /sessions/:sessionId/history
```

Response:
```json
{
  "success": true,
  "session_id": "uuid",
  "status": "approved",
  "config": { /* SessionConfig */ },
  "iterations": [
    {
      "iteration_number": 1,
      "overall_score": 0.75,
      "user_decision": "reject",
      "processing_time_ms": 4500,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "iteration_number": 2,
      "overall_score": 0.88,
      "user_decision": "approve",
      "processing_time_ms": 4200,
      "created_at": "2024-01-15T10:31:00Z"
    }
  ],
  "approved_iteration": 2,
  "total_processing_time_ms": 8700,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:31:05Z"
}
```

#### Get Specific Iteration
```http
GET /sessions/:sessionId/iterations/:iterationNumber
```

#### Abandon Session
```http
POST /sessions/:sessionId/abandon
```

#### Resume Session
```http
POST /sessions/:sessionId/resume
```

#### Get Available Bricks
```http
GET /bricks?part_type=plate|tile|wedge|slope|brick
```

Response:
```json
{
  "success": true,
  "bricks": [
    {
      "bricklink_id": "3024",
      "part_type": "plate",
      "width_studs": 1,
      "height_studs": 1,
      "coverage_pattern": [{ "x": 0, "y": 0 }],
      "is_rectangular": true,
      "has_cutouts": false
    }
  ],
  "count": 24
}
```

#### Get Default Bricks
```http
GET /bricks/defaults
```

#### Validate Bricks
```http
POST /bricks/validate
Content-Type: application/json

{ "brick_ids": ["3024", "3023", "invalid"] }
```

Response:
```json
{
  "valid": ["3024", "3023"],
  "invalid": ["invalid"],
  "all_valid": false
}
```

#### Get Available Colors
```http
GET /colors?transparent=false&metallic=false
```

Response:
```json
{
  "success": true,
  "colors": [
    {
      "bricklink_id": 11,
      "name": "Black",
      "rgb_r": 0,
      "rgb_g": 0,
      "rgb_b": 0,
      "hex_color": "#000000",
      "is_transparent": false,
      "is_metallic": false
    }
  ],
  "count": 40
}
```

#### Get Default Colors
```http
GET /colors/defaults
```

#### Validate Colors
```http
POST /colors/validate
Content-Type: application/json

{ "color_ids": [1, 5, 11, 9999] }
```

---

## 3. Data Types (TypeScript)

```typescript
// Core Types
interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

interface LegoColor {
  bricklink_id: number;
  name: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hex_color: string;
  is_transparent: boolean;
  is_metallic: boolean;
}

interface BrickPart {
  bricklink_id: string;
  part_type: 'plate' | 'tile' | 'wedge' | 'slope' | 'brick';
  width_studs: number;
  height_studs: number;
  coverage_pattern: Array<{ x: number; y: number }>;
  is_rectangular: boolean;
  has_cutouts: boolean;
}

interface Placement {
  brick_id: string;
  color_id: number;
  x: number;
  y: number;
  layer: number;
  rotation: 0 | 90 | 180 | 270;
}

interface BillItem {
  brick_id: string;
  color_id: number;
  quantity: number;
}

interface MosaicMetadata {
  generation_timestamp: string;
  source_image_hash: string;
  algorithm: 'llm' | 'deterministic';
  llm_provider?: string;
  total_brick_count: number;
  unique_colors_used: number;
  coverage_percent: number;
}

interface Mosaic {
  width_studs: number;
  height_studs: number;
  layer_count: number;
  placements: Placement[];
  bill_of_materials: BillItem[];
  metadata: MosaicMetadata;
}

// Session Types
type SessionStatus = 'in_progress' | 'approved' | 'abandoned' | 'expired';
type DecisionType = 'approve' | 'reject' | 'refine';

interface LLMAssessment {
  overallScore: number; // 0.0 - 1.0
  colorAccuracy: number;
  structuralIntegrity: number;
  visualAppeal: number;
  summary: string;
  issues: string[];
  suggestions: RefinementSuggestion[];
  confidence: number;
  provider: string;
  durationMs: number;
}

interface RefinementSuggestion {
  type: 'color' | 'placement' | 'structure' | 'coverage';
  priority: number;
  description: string;
  region?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

interface ConcernArea {
  description: string;
  type: 'color' | 'placement' | 'structure' | 'coverage' | 'other';
  region?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

interface SessionConfig {
  width_studs: number;
  height_studs: number;
  layer_count: number;
  color_palette?: number[];
  brick_pool?: string[];
  resampling: string;
  background_color: string;
  llm_provider?: string;
}

interface IterationResult {
  iteration_number: number;
  mosaic: Mosaic;
  preview_url?: string;
  llm_assessment?: LLMAssessment;
  processing_time_ms: number;
  created_at: string;
}

interface Session {
  session_id: string;
  status: SessionStatus;
  config: SessionConfig;
  current_iteration: number;
  max_iterations: number;
  current_result?: IterationResult;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// Request/Response Types
interface ConvertRequest {
  image: File;
  width_studs?: number;
  height_studs?: number;
  layer_count?: number;
  color_palette?: number[];
  brick_pool?: string[];
  resampling?: 'lanczos' | 'mitchell';
  background_color?: string;
  llm_provider?: 'auto' | 'openai' | 'claude' | 'gemini';
}

interface DecisionRequest {
  decision: DecisionType;
  feedback?: string;
  concern_areas?: ConcernArea[];
}
```

---

## 4. UI Components Specification

### 4.1 Image Upload Component
**Purpose**: Allow users to upload and preview source images

**Features**:
- Drag-and-drop zone
- File browser button
- Image preview with dimensions
- Supported formats: JPEG, PNG, WebP
- Max file size: 10MB
- Show upload progress

**States**:
- Empty (no image)
- Dragging (file over drop zone)
- Uploading (progress indicator)
- Loaded (showing preview)
- Error (invalid file type/size)

### 4.2 Configuration Panel
**Purpose**: Set mosaic generation parameters

**Sections**:

#### Dimensions
- Width slider: 8-128 studs (default: 48)
- Height slider: 8-128 studs (default: 48)
- Aspect ratio lock toggle
- Preset buttons: 16x16, 32x32, 48x48, 64x64

#### Layers
- Layer count selector: 2 or 3
- Tooltip explaining structural benefits

#### Color Palette
- Grid of available colors with swatches
- Search/filter by name
- Filter toggles: Show transparent, Show metallic
- Select all / Clear all buttons
- Selected count indicator
- "Use Defaults" button

#### Brick Pool
- Grid of available brick types
- Filter by part_type (plate, tile, etc.)
- Visual brick shape indicators
- "Use Defaults" button

#### Advanced Options (collapsible)
- Resampling algorithm: Lanczos (sharper) / Mitchell (smoother)
- Background color picker (for transparent images)
- LLM provider preference

### 4.3 Mosaic Preview Component
**Purpose**: Display generated mosaic with layer visualization

**Features**:
- 2D grid view of mosaic
- Layer toggle buttons (show/hide each layer)
- Zoom controls (fit, 100%, zoom in/out)
- Pan/drag navigation
- Click brick to highlight in BOM
- Color legend with brick counts
- Export as PNG button

**Rendering**:
- Each stud position is a square
- Color from the LEGO color palette
- Layer transparency for multi-layer view
- Grid lines toggle

### 4.4 Assessment Panel
**Purpose**: Display LLM quality assessment

**Display**:
- Overall score gauge (0-100%)
- Score breakdown bars:
  - Color Accuracy
  - Structural Integrity
  - Visual Appeal
- Summary text
- Issues list (expandable)
- Suggestions list with priority badges

### 4.5 Iteration History Timeline
**Purpose**: Show refinement progress

**Features**:
- Horizontal timeline of iterations
- Each iteration shows:
  - Thumbnail preview
  - Score badge
  - Decision icon (approved/rejected)
- Click to view past iteration
- Current iteration highlighted

### 4.6 Decision Controls
**Purpose**: User approval/rejection interface

**Buttons**:
- ✓ Approve (green) - Accept this design
- ✗ Reject (red) - Generate new design
- ↻ Refine (blue) - Improve with feedback

**Feedback Form** (on Reject/Refine):
- Text area for feedback
- Concern area selector (click on preview to mark regions)
- Concern type dropdown

### 4.7 Bill of Materials Component
**Purpose**: Shopping list for bricks

**Features**:
- Sortable table:
  - Color swatch
  - Color name
  - Brick type
  - Brick dimensions
  - Quantity
- Group by color / Group by brick type toggle
- Total brick count
- Total unique combinations
- Export as CSV button
- "Open in BrickLink" links (construct URL to BrickLink wanted list)

### 4.8 Progress Indicator
**Purpose**: Show processing status

**States**:
- Uploading image...
- Processing image...
- Generating placements... (with LLM provider name)
- Validating structure...
- Complete!

---

## 5. Page Layouts

### 5.1 Home / Upload Page
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | "Image to LEGO Mosaic Converter"            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │           Drag & Drop Image Here                    │   │
│  │                  or                                 │   │
│  │           [Browse Files]                            │   │
│  │                                                     │   │
│  │     Supports: JPEG, PNG, WebP (max 10MB)           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Quick Convert]  or  [Start Session (iterative)]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Configuration Page
```
┌─────────────────────────────────────────────────────────────┐
│  Header: [← Back] | Step 2: Configure                       │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌─────────────────────────────────┐│
│  │                   │  │ Dimensions                      ││
│  │  Image Preview    │  │ Width: [====●====] 48 studs     ││
│  │                   │  │ Height: [====●====] 48 studs    ││
│  │                   │  │ [🔗] Lock aspect ratio          ││
│  │                   │  │                                 ││
│  │                   │  │ Layers: ○ 2  ● 3                ││
│  │                   │  ├─────────────────────────────────┤│
│  │                   │  │ Color Palette                   ││
│  │                   │  │ [■][■][■][■][■][■][■][■]       ││
│  │                   │  │ [■][■][■][■][□][□][□][□]       ││
│  │                   │  │ 12 selected [Use Defaults]      ││
│  │                   │  ├─────────────────────────────────┤│
│  │                   │  │ Brick Pool                      ││
│  │                   │  │ [☑ Plates] [☑ Tiles] [☐ Wedges]││
│  └───────────────────┘  └─────────────────────────────────┘│
│                                                             │
│                    [Generate Mosaic →]                      │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Review Page (Session Mode)
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Session abc123 | Iteration 2/5 | [Abandon]         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Timeline: [1]──[2●]──[3]──[4]──[5]                      ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────────┐│
│  │                         │  │ Assessment                ││
│  │    Mosaic Preview       │  │ Overall: ████████░░ 82%   ││
│  │    [Layer toggles]      │  │ Color:   █████████░ 90%   ││
│  │    [Zoom controls]      │  │ Structure:███████░░ 78%   ││
│  │                         │  │ Appeal:  ████████░░ 83%   ││
│  │                         │  │                           ││
│  │                         │  │ Issues:                   ││
│  │                         │  │ • Some color banding      ││
│  │                         │  │                           ││
│  │                         │  │ Suggestions:              ││
│  │                         │  │ 1. Add more mid-tones     ││
│  └─────────────────────────┘  └───────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [✓ Approve]     [✗ Reject]     [↻ Refine with Feedback]   │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Results Page (Approved)
```
┌─────────────────────────────────────────────────────────────┐
│  Header: ✓ Mosaic Approved! | [Start New]                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────────┐│
│  │                         │  │ Bill of Materials         ││
│  │    Final Mosaic         │  │ ─────────────────────────││
│  │                         │  │ Black 1x1 Plate    × 150 ││
│  │    [Download PNG]       │  │ White 1x1 Plate    × 120 ││
│  │                         │  │ Red 2x2 Plate      × 45  ││
│  │                         │  │ Blue 1x2 Plate     × 89  ││
│  │                         │  │ ...                      ││
│  │                         │  │                          ││
│  │                         │  │ Total: 2,304 bricks      ││
│  │                         │  │                          ││
│  │                         │  │ [Export CSV]             ││
│  │                         │  │ [Open in BrickLink]      ││
│  └─────────────────────────┘  └───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 6. State Management

### Application State Structure
```typescript
interface AppState {
  // Upload
  sourceImage: {
    file: File | null;
    preview: string | null;
    dimensions: { width: number; height: number } | null;
  };

  // Configuration
  config: {
    widthStuds: number;
    heightStuds: number;
    layerCount: 2 | 3;
    colorPalette: number[];
    brickPool: string[];
    resampling: 'lanczos' | 'mitchell';
    backgroundColor: string;
    llmProvider: 'auto' | 'openai' | 'claude' | 'gemini';
    maxIterations: number;
  };

  // Catalog (loaded once)
  catalog: {
    colors: LegoColor[];
    bricks: BrickPart[];
    defaultColors: number[];
    defaultBricks: string[];
    loading: boolean;
  };

  // Session
  session: {
    id: string | null;
    status: SessionStatus | null;
    currentIteration: number;
    maxIterations: number;
    iterations: IterationResult[];
    loading: boolean;
    error: string | null;
  };

  // Current Result
  currentResult: {
    mosaic: Mosaic | null;
    assessment: LLMAssessment | null;
    previewUrl: string | null;
  };

  // UI State
  ui: {
    step: 'upload' | 'configure' | 'review' | 'approved';
    previewZoom: number;
    visibleLayers: boolean[];
    selectedPlacement: Placement | null;
    feedbackModalOpen: boolean;
  };
}
```

### Key Actions
```typescript
// Image
uploadImage(file: File): void
clearImage(): void

// Configuration
setDimensions(width: number, height: number): void
setLayerCount(count: 2 | 3): void
toggleColor(colorId: number): void
toggleBrick(brickId: string): void
resetToDefaults(): void

// Session
startSession(): Promise<void>
submitDecision(decision: DecisionType, feedback?: string, concerns?: ConcernArea[]): Promise<void>
abandonSession(): Promise<void>
resumeSession(sessionId: string): Promise<void>

// Quick Convert
quickConvert(): Promise<void>

// UI
setStep(step: string): void
setZoom(level: number): void
toggleLayer(index: number): void
selectPlacement(placement: Placement | null): void
```

---

## 7. Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "width_studs must be between 8 and 128",
    "field": "width_studs"
  }
}
```

### Error Codes
| Code | Description | User Message |
|------|-------------|--------------|
| `VALIDATION_ERROR` | Invalid input parameters | Show field-specific error |
| `FILE_TOO_LARGE` | Image exceeds 10MB | "Image must be under 10MB" |
| `UNSUPPORTED_FORMAT` | Invalid image type | "Please upload JPEG, PNG, or WebP" |
| `SESSION_NOT_FOUND` | Invalid session ID | "Session expired or not found" |
| `SESSION_EXPIRED` | Session timed out | "Session expired. Please start over." |
| `MAX_ITERATIONS` | Hit iteration limit | "Maximum refinements reached" |
| `LLM_UNAVAILABLE` | All providers failed | "Service temporarily unavailable" |
| `INVALID_STATE` | Wrong session state | "Cannot perform this action" |

### UI Error Handling
- Show inline validation errors immediately
- Show toast notifications for API errors
- Provide retry buttons for transient failures
- Offer "Start Over" for unrecoverable errors

---

## 8. Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Stack preview and controls vertically
- Full-width mosaic preview with pinch-to-zoom
- Bottom sheet for configuration options
- Swipe between iterations
- Simplified BOM view (accordion)

### Touch Interactions
- Pinch-to-zoom on mosaic preview
- Swipe timeline navigation
- Long-press to select brick for details
- Pull-to-refresh session status

---

## 9. Accessibility Requirements

### WCAG 2.1 AA Compliance
- All interactive elements keyboard accessible
- Focus indicators visible
- Color contrast minimum 4.5:1
- Screen reader labels for all controls
- Skip navigation links
- Form field labels and error messages

### Color Considerations
- Don't rely solely on color to convey information
- Add patterns/icons to color swatches
- Provide text labels for assessment scores
- High contrast mode support

---

## 10. Performance Guidelines

### Image Handling
- Generate thumbnail for preview (max 800px)
- Lazy load color palette swatches
- Virtualize large brick lists
- Debounce dimension slider changes

### API Calls
- Show loading states immediately
- Cache catalog data (colors, bricks)
- Implement request cancellation
- Retry failed requests with exponential backoff

### Rendering
- Use canvas for mosaic preview (not DOM elements)
- Implement viewport culling for large mosaics
- Throttle zoom/pan updates
- Lazy render layer toggles

---

## 11. Technology Recommendations

### Recommended Stack
- **Framework**: React 18+ or Vue 3+
- **State Management**: Zustand, Redux Toolkit, or Pinia
- **Styling**: Tailwind CSS or Styled Components
- **HTTP Client**: Axios or native fetch with wrapper
- **Canvas**: Konva.js or Fabric.js for mosaic rendering
- **Forms**: React Hook Form or Formik
- **UI Components**: shadcn/ui, Radix, or Headless UI

### File Structure
```
src/
├── components/
│   ├── ImageUpload/
│   ├── ConfigPanel/
│   ├── MosaicPreview/
│   ├── AssessmentPanel/
│   ├── BillOfMaterials/
│   ├── IterationTimeline/
│   └── common/
├── pages/
│   ├── Home/
│   ├── Configure/
│   ├── Review/
│   └── Results/
├── hooks/
│   ├── useSession.ts
│   ├── useCatalog.ts
│   └── useMosaicRenderer.ts
├── services/
│   └── api.ts
├── store/
│   └── index.ts
├── types/
│   └── index.ts
└── utils/
    ├── colors.ts
    └── export.ts
```

---

## 12. Testing Requirements

### Unit Tests
- Configuration validation logic
- Color/brick filtering
- BOM calculations
- State transitions

### Integration Tests
- Full upload → configure → convert flow
- Session lifecycle (start → reject → refine → approve)
- Error handling scenarios

### E2E Tests
- Complete user journey with sample images
- Mobile responsive behavior
- Accessibility audit

---

## 13. Sample API Calls

### Quick Convert Flow
```typescript
// 1. Upload and convert in one request
const formData = new FormData();
formData.append('image', file);
formData.append('width_studs', '48');
formData.append('height_studs', '48');

const response = await fetch('/api/v1/convert', {
  method: 'POST',
  body: formData,
});
const result = await response.json();
```

### Session Flow
```typescript
// 1. Start session
const formData = new FormData();
formData.append('image', file);
formData.append('width_studs', '48');
formData.append('max_iterations', '5');

const session = await fetch('/api/v1/sessions', {
  method: 'POST',
  body: formData,
}).then(r => r.json());

// 2. Review and decide
const decision = await fetch(`/api/v1/sessions/${session.session_id}/decision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    decision: 'refine',
    feedback: 'Colors are too bright',
  }),
}).then(r => r.json());

// 3. Approve final
await fetch(`/api/v1/sessions/${session.session_id}/decision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'approve' }),
});

// 4. Get final result with BOM
const history = await fetch(`/api/v1/sessions/${session.session_id}/history`)
  .then(r => r.json());
```

---

## 14. BrickLink Integration

### Wanted List URL Construction
```typescript
function buildBrickLinkUrl(bom: BillItem[]): string {
  // BrickLink XML format for wanted list import
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<INVENTORY>
${bom.map(item => `  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>${item.brick_id}</ITEMID>
    <COLOR>${item.color_id}</COLOR>
    <MINQTY>${item.quantity}</MINQTY>
  </ITEM>`).join('\n')}
</INVENTORY>`;

  return `https://www.bricklink.com/v2/wanted/upload.page`;
  // User must paste XML or provide file upload
}
```

### Individual Part Links
```typescript
function getBrickLinkPartUrl(brickId: string, colorId: number): string {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?P=${brickId}&C=${colorId}`;
}
```

---

This specification should provide all the context needed to generate a complete frontend application. The AI tool should use this as a reference for:
- API integration patterns
- Data type definitions
- Component structure and behavior
- User interaction flows
- Error handling approaches
- Accessibility and performance requirements
