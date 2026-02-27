const MCP_BASE = 'http://localhost:3009';

export async function fetchCatalogColors(options?: {
  includeTransparent?: boolean;
  includeMetallic?: boolean;
}): Promise<unknown> {
  const params = new URLSearchParams();
  if (options?.includeTransparent) params.set('includeTransparent', 'true');
  if (options?.includeMetallic) params.set('includeMetallic', 'true');

  const res = await fetch(`${MCP_BASE}/tools/get_lego_colors?${params}`);
  const json = await res.json();
  return json.data;
}

export async function fetchCatalogBricks(partType?: string): Promise<unknown> {
  const params = new URLSearchParams();
  if (partType) params.set('partType', partType);

  const res = await fetch(`${MCP_BASE}/tools/get_lego_bricks?${params}`);
  const json = await res.json();
  return json.data;
}

export async function analyzeImage(imagePath: string, targetWidth?: number): Promise<unknown> {
  const res = await fetch(`${MCP_BASE}/tools/analyze_image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagePath, targetWidth }),
  });
  const json = await res.json();
  return json.data;
}

export async function generatePdf(
  placements: unknown,
  bom: unknown,
  config: unknown,
  title?: string
): Promise<unknown> {
  const res = await fetch(`${MCP_BASE}/tools/generate_assembly_pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placements, bom, config, title, outputDir: '/tmp/lego-pdfs' }),
  });
  const json = await res.json();
  return json.data;
}
