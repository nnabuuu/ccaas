#!/usr/bin/env node

/**
 * LEGO Mosaic MCP REST Server
 *
 * HTTP REST API that exposes MCP tools for CCAAS.
 * The CCAAS backend's rest-adapter calls these endpoints.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { SYNC_FIELDS } from './types.js';
import { validateAndFixField } from './schemas.js';
import { getColors, getBricks } from './lego-catalog.js';
import { analyzeImage } from './image-analyzer.js';
import { generateMosaic, generateMosaicFromGrid, generateMosaicFromCoarseGrid, refineMosaicRegions } from './mosaic-generator.js';
import { generateAssemblyPdf } from './pdf-generator.js';
import type {
  WriteOutputInput,
  AnalyzeImageInput,
  GenerateMosaicInput,
  GenerateMosaicFromGridInput,
  GenerateMosaicFromCoarseGridInput,
  RefineMosaicRegionsInput,
  GenerateAssemblyPdfInput,
} from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.MCP_PORT || 3009;

// Static file serving for generated PDFs
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
app.use('/api/downloads', express.static(DOWNLOADS_DIR));

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'lego-mosaic-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TOOL: write_output
// ============================================================================

app.post('/tools/write_output', (req: Request, res: Response) => {
  const input = req.body as WriteOutputInput;

  if (!input.field || !SYNC_FIELDS.includes(input.field)) {
    res.status(400).json({
      status: 'error',
      error: `Invalid field: ${input.field}. Valid fields: ${SYNC_FIELDS.join(', ')}`,
    });
    return;
  }

  const validation = validateAndFixField(input.field, input.value);

  if (!validation.success) {
    res.status(400).json({
      status: 'error',
      error: `Validation failed: ${validation.errors.join('; ')}`,
      field: input.field,
    });
    return;
  }

  if (validation.fixed) {
    console.log(`[write_output] Data for ${input.field} was auto-fixed`);
  }

  res.json({
    status: 'success',
    data: {
      field: input.field,
      value: validation.data,
      preview: input.preview,
    },
  });
});

// ============================================================================
// TOOL: analyze_image
// ============================================================================

app.post('/tools/analyze_image', async (req: Request, res: Response) => {
  try {
    const input = req.body as AnalyzeImageInput;

    if (!input.imagePath) {
      res.status(400).json({ status: 'error', error: 'imagePath is required' });
      return;
    }

    if (!fs.existsSync(input.imagePath)) {
      res.status(400).json({ status: 'error', error: `Image not found: ${input.imagePath}` });
      return;
    }

    const analysis = await analyzeImage(input.imagePath, input.targetWidth);

    res.json({
      status: 'success',
      data: analysis,
    });
  } catch (error) {
    console.error('[analyze_image] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `Image analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: generate_mosaic
// ============================================================================

app.post('/tools/generate_mosaic', async (req: Request, res: Response) => {
  try {
    const input = req.body as GenerateMosaicInput;

    if (!input.imagePath) {
      res.status(400).json({ status: 'error', error: 'imagePath is required' });
      return;
    }

    if (!input.config) {
      res.status(400).json({ status: 'error', error: 'config is required' });
      return;
    }

    if (!fs.existsSync(input.imagePath)) {
      res.status(400).json({ status: 'error', error: `Image not found: ${input.imagePath}` });
      return;
    }

    const result = await generateMosaic(input.imagePath, input.config, input.refinement);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('[generate_mosaic] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `Mosaic generation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: generate_mosaic_from_grid
// ============================================================================

app.post('/tools/generate_mosaic_from_grid', (req: Request, res: Response) => {
  try {
    const input = req.body as GenerateMosaicFromGridInput;

    if (!input.colorGrid || !Array.isArray(input.colorGrid) || input.colorGrid.length === 0) {
      res.status(400).json({
        status: 'error',
        error: 'colorGrid is required and must be a non-empty 2D array of BrickLink color IDs',
      });
      return;
    }

    if (!input.config) {
      res.status(400).json({ status: 'error', error: 'config is required' });
      return;
    }

    const result = generateMosaicFromGrid(input.colorGrid, input.config);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('[generate_mosaic_from_grid] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `Mosaic generation from grid failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: generate_mosaic_from_coarse_grid
// ============================================================================

app.post('/tools/generate_mosaic_from_coarse_grid', (req: Request, res: Response) => {
  try {
    const input = req.body as GenerateMosaicFromCoarseGridInput;

    if (!input.coarseGrid || !Array.isArray(input.coarseGrid) || input.coarseGrid.length === 0) {
      res.status(400).json({
        status: 'error',
        error: 'coarseGrid is required and must be a non-empty 2D array of BrickLink color IDs',
      });
      return;
    }

    if (!input.targetWidth || !input.targetHeight) {
      res.status(400).json({
        status: 'error',
        error: 'targetWidth and targetHeight are required',
      });
      return;
    }

    if (!input.config) {
      res.status(400).json({ status: 'error', error: 'config is required' });
      return;
    }

    const result = generateMosaicFromCoarseGrid(
      input.coarseGrid,
      input.targetWidth,
      input.targetHeight,
      input.config
    );

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('[generate_mosaic_from_coarse_grid] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `Coarse grid mosaic generation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: refine_mosaic_regions
// ============================================================================

app.post('/tools/refine_mosaic_regions', (req: Request, res: Response) => {
  try {
    const input = req.body as RefineMosaicRegionsInput;

    if (!input.currentGrid || !Array.isArray(input.currentGrid) || input.currentGrid.length === 0) {
      res.status(400).json({
        status: 'error',
        error: 'currentGrid is required and must be a non-empty 2D array of BrickLink color IDs',
      });
      return;
    }

    if (!input.edits || !Array.isArray(input.edits) || input.edits.length === 0) {
      res.status(400).json({
        status: 'error',
        error: 'edits is required and must be a non-empty array of RegionEdit',
      });
      return;
    }

    if (!input.config) {
      res.status(400).json({ status: 'error', error: 'config is required' });
      return;
    }

    const result = refineMosaicRegions(input.currentGrid, input.edits, input.config);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('[refine_mosaic_regions] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `Region refinement failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: generate_assembly_pdf
// ============================================================================

app.post('/tools/generate_assembly_pdf', async (req: Request, res: Response) => {
  try {
    const input = req.body as GenerateAssemblyPdfInput;

    if (!input.placements || !input.bom || !input.config) {
      res.status(400).json({
        status: 'error',
        error: 'placements, bom, and config are required',
      });
      return;
    }

    const outputDir = input.outputDir || DOWNLOADS_DIR;
    const result = await generateAssemblyPdf(
      input.placements,
      input.bom,
      input.config,
      input.title,
      outputDir
    );

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('[generate_assembly_pdf] Error:', error);
    res.status(500).json({
      status: 'error',
      error: `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

// ============================================================================
// TOOL: get_lego_colors
// ============================================================================

app.get('/tools/get_lego_colors', (req: Request, res: Response) => {
  const includeTransparent = req.query.includeTransparent === 'true';
  const includeMetallic = req.query.includeMetallic === 'true';

  res.json({
    status: 'success',
    data: getColors({ includeTransparent, includeMetallic }),
  });
});

app.post('/tools/get_lego_colors', (req: Request, res: Response) => {
  const { includeTransparent, includeMetallic } = req.body;

  res.json({
    status: 'success',
    data: getColors({ includeTransparent, includeMetallic }),
  });
});

// ============================================================================
// TOOL: get_lego_bricks
// ============================================================================

app.get('/tools/get_lego_bricks', (req: Request, res: Response) => {
  const partType = req.query.partType as string | undefined;

  res.json({
    status: 'success',
    data: getBricks(partType),
  });
});

app.post('/tools/get_lego_bricks', (req: Request, res: Response) => {
  const { partType } = req.body;

  res.json({
    status: 'success',
    data: getBricks(partType),
  });
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`LEGO Mosaic MCP REST Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /tools/write_output');
  console.log('  POST /tools/analyze_image');
  console.log('  POST /tools/generate_mosaic');
  console.log('  POST /tools/generate_mosaic_from_grid');
  console.log('  POST /tools/generate_mosaic_from_coarse_grid');
  console.log('  POST /tools/refine_mosaic_regions');
  console.log('  POST /tools/generate_assembly_pdf');
  console.log('  GET  /tools/get_lego_colors');
  console.log('  POST /tools/get_lego_colors');
  console.log('  GET  /tools/get_lego_bricks');
  console.log('  POST /tools/get_lego_bricks');
});
