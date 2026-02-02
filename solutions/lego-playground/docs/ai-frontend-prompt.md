# AI Frontend Generation Prompt

## Context
You are building a frontend for an Image-to-LEGO Mosaic Converter. The backend is a NestJS API running at `http://localhost:3000/api/v1`.

## What This Creates

A **2D LEGO mosaic** (flat wall art / photo frame style), like the official LEGO Art sets - **NOT a 3D model**:

```
Front view: The image as pixel art
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │ █ │ █ │ █ │ █ │   │   │   │  ← Each cell = 1 LEGO stud
├───┼───┼───┼───┼───┼───┼───┼───┤
│ █ │   │   │   │   │ █ │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘

Side view: 2-3 layers for structural strength (staggered joints)
┌─────────────────────────┐  ← Layer 2
├───┬──────┬──────────────┤  ← Layer 1 (staggered)
└───┴──────┴──────────────┘
```

## What This App Does
1. User uploads an image (JPEG/PNG/WebP, max 10MB)
2. User configures mosaic settings (dimensions, colors, brick types)
3. Backend uses LLM to generate optimal LEGO brick placements
4. User reviews the result with AI quality assessment
5. User can approve, reject, or refine with feedback
6. Final output is a bill of materials for purchasing bricks

## Key Files to Reference
- `docs/frontend-spec.md` - Complete specification with API details, types, and UI components
- `specs/001-image-to-lego/spec.md` - Product requirements
- `specs/001-image-to-lego/contracts/openapi.yaml` - OpenAPI specification (if exists)

## Quick Start Instructions

### 1. Create a React/Vue/Svelte app with these core features:

**Pages:**
- `/` - Home with image upload dropzone
- `/configure` - Mosaic settings (dimensions, colors, bricks)
- `/session/:id` - Iterative review with approval controls
- `/result/:id` - Final approved mosaic with bill of materials

**Key Components:**
- `ImageUpload` - Drag-drop file upload with preview
- `DimensionSlider` - 8-128 stud range for width/height
- `ColorPalette` - Grid of 40 LEGO colors with selection
- `BrickPool` - List of available brick types with filtering
- `MosaicPreview` - Canvas-based mosaic visualization with layer toggles
- `AssessmentPanel` - Quality scores and AI suggestions
- `BillOfMaterials` - Sortable table with export options

### 2. API Integration

**Simple conversion (one-shot):**
```typescript
POST /api/v1/convert
Content-Type: multipart/form-data
Body: { image: File, width_studs: 48, height_studs: 48, ... }
Returns: { mosaic, processing_time_ms, warnings }
```

**Iterative session:**
```typescript
// Start
POST /api/v1/sessions (multipart/form-data with image + config)
Returns: { session_id, current_result with mosaic + llm_assessment }

// Decide
POST /api/v1/sessions/:id/decision
Body: { decision: "approve" | "reject" | "refine", feedback?: string }

// Get history
GET /api/v1/sessions/:id/history
```

**Catalog:**
```typescript
GET /api/v1/colors - List all LEGO colors
GET /api/v1/bricks - List all brick types
POST /api/v1/colors/validate - Validate color IDs
POST /api/v1/bricks/validate - Validate brick IDs
```

### 3. Core Types (TypeScript)

```typescript
interface Mosaic {
  width_studs: number;
  height_studs: number;
  layer_count: number;
  placements: Array<{
    brick_id: string;    // BrickLink part ID like "3024"
    color_id: number;    // BrickLink color ID like 11 (Black)
    x: number;
    y: number;
    layer: number;       // 0 = bottom, 1 = middle, 2 = top
    rotation: 0 | 90 | 180 | 270;
  }>;
  bill_of_materials: Array<{
    brick_id: string;
    color_id: number;
    quantity: number;
  }>;
  metadata: {
    total_brick_count: number;
    unique_colors_used: number;
    coverage_percent: number;
    llm_provider?: string;
  };
}

interface LLMAssessment {
  overallScore: number;      // 0.0 - 1.0
  colorAccuracy: number;
  structuralIntegrity: number;
  visualAppeal: number;
  summary: string;
  issues: string[];
  suggestions: Array<{
    type: 'color' | 'placement' | 'structure';
    priority: number;
    description: string;
  }>;
}

interface LegoColor {
  bricklink_id: number;
  name: string;
  hex_color: string;        // e.g., "#000000"
  is_transparent: boolean;
  is_metallic: boolean;
}

interface BrickPart {
  bricklink_id: string;
  part_type: 'plate' | 'tile' | 'wedge' | 'slope' | 'brick';
  width_studs: number;
  height_studs: number;
}
```

### 4. UX Requirements

**Upload Flow:**
- Show drag-drop zone with visual feedback
- Validate file type and size client-side
- Show image preview before proceeding

**Configuration:**
- Default to 48x48 studs, 2 layers
- Show live preview of dimensions vs image
- Allow selecting colors from visual swatches
- Provide "Use Defaults" quick option

**Review:**
- Display mosaic as colored grid (use Canvas for performance)
- Show layer toggles (checkboxes to hide/show each layer)
- Display assessment scores as progress bars
- Highlight issues and suggestions from AI

**Decision Flow:**
- ✓ Approve → Go to final result page
- ✗ Reject → Generate completely new design
- ↻ Refine → Add feedback, generate improved version
- Show iteration count (e.g., "Iteration 2 of 5")

**Results:**
- Show final mosaic with all layers
- Display bill of materials as sortable table
- Allow CSV export of BOM
- Provide BrickLink integration (link to part pages)

### 5. Error Handling

Common errors to handle:
- `VALIDATION_ERROR` - Show field-specific message
- `FILE_TOO_LARGE` - "Image must be under 10MB"
- `SESSION_EXPIRED` - "Session expired, please start over"
- `LLM_UNAVAILABLE` - "Service temporarily unavailable, retrying..."

### 6. Responsive Design

- Desktop: Side-by-side layout (preview + controls)
- Tablet: Stacked layout with collapsible panels
- Mobile: Full-width preview, bottom sheet controls

### 7. Accessibility

- All controls keyboard accessible
- ARIA labels on interactive elements
- Color swatches include text labels
- Focus management between steps

## Example User Journey

1. User lands on home page, sees upload dropzone
2. Drags photo of a sunset onto dropzone
3. Image preview shows, clicks "Configure"
4. Adjusts to 64x64 studs, selects warm colors only
5. Clicks "Generate Mosaic"
6. Loading spinner while LLM processes (~5-15 seconds)
7. Mosaic preview appears with 78% quality score
8. AI suggests "Consider adding orange tones for sunset glow"
9. User clicks "Refine" and adds feedback
10. Second iteration shows 85% score
11. User clicks "Approve"
12. Results page shows final mosaic + 2,048 brick BOM
13. User exports CSV and orders from BrickLink

## Technical Notes

- Use canvas (Konva.js or similar) for mosaic rendering
- Cache catalog data (colors/bricks don't change)
- Implement request cancellation for abandoned sessions
- Add loading skeletons during API calls
- Consider WebSocket for real-time progress updates (optional)
