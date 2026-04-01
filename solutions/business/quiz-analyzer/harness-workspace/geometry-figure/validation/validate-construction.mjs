#!/usr/bin/env node
/**
 * Geometry Construction Validator
 *
 * Static JSON validation for JXGConstruction objects:
 * - Zod schema validation (via inline schema, mirrors schemas.ts)
 * - Element reference integrity check
 * - Bbox quality analysis
 * - Animation spec validation
 *
 * Usage:
 *   node validate-construction.mjs --results results/v1-results.json
 *   node validate-construction.mjs --test           # run with test fixtures
 *   node validate-construction.mjs --json '{"kind":"2d",...}'  # validate single JSON
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Inline Schema Validation (no Zod dependency — pure JS checks) ───────────

function validateSchema(construction) {
  const errors = []

  // kind
  if (!['2d', '3d'].includes(construction?.kind)) {
    errors.push('kind must be "2d" or "3d"')
  }

  // bbox
  if (!Array.isArray(construction?.bbox) || construction.bbox.length !== 4) {
    errors.push('bbox must be array of 4 numbers')
  } else if (!construction.bbox.every(n => typeof n === 'number' && isFinite(n))) {
    errors.push('bbox values must be finite numbers')
  }

  // elements
  if (!Array.isArray(construction?.elements) || construction.elements.length === 0) {
    errors.push('elements must be non-empty array')
  } else {
    construction.elements.forEach((el, i) => {
      if (!el.type || typeof el.type !== 'string') {
        errors.push(`elements[${i}]: missing or invalid type`)
      }
      if (!Array.isArray(el.parents)) {
        errors.push(`elements[${i}]: parents must be array`)
      }
      if (typeof el.attrs !== 'object' || el.attrs === null) {
        errors.push(`elements[${i}]: attrs must be object`)
      }
    })
  }

  // animation (optional)
  if (construction?.animation) {
    const anim = construction.animation
    if (!anim.param || typeof anim.param !== 'string') {
      errors.push('animation.param must be non-empty string')
    }
    if (!Array.isArray(anim.range) || anim.range.length !== 2) {
      errors.push('animation.range must be [number, number]')
    } else {
      if (typeof anim.range[0] !== 'number' || typeof anim.range[1] !== 'number') {
        errors.push('animation.range values must be numbers')
      }
      if (anim.range[0] >= anim.range[1]) {
        errors.push(`animation.range[0] (${anim.range[0]}) must be < range[1] (${anim.range[1]})`)
      }
    }
    if (typeof anim.default !== 'number') {
      errors.push('animation.default must be a number')
    } else if (anim.range && anim.default < anim.range[0] || anim.default > anim.range[1]) {
      errors.push(`animation.default (${anim.default}) must be within range [${anim.range}]`)
    }
    if (anim.snapValues) {
      if (!Array.isArray(anim.snapValues)) {
        errors.push('animation.snapValues must be array')
      } else {
        anim.snapValues.forEach((sv, i) => {
          if (typeof sv.value !== 'number') errors.push(`snapValues[${i}].value must be number`)
          if (!sv.label || typeof sv.label !== 'string') errors.push(`snapValues[${i}].label must be non-empty string`)
        })
      }
    }
    if (anim.autoPlay) {
      if (anim.autoPlay.mode && !['loop', 'bounce', 'once'].includes(anim.autoPlay.mode)) {
        errors.push(`autoPlay.mode must be loop/bounce/once, got "${anim.autoPlay.mode}"`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Reference Integrity Check ────────────────────────────────────────────────

/**
 * High-level sugar types that the renderer expands.
 * These create sub-elements with predictable IDs.
 */
const EXPANDABLE_TYPES = ['incenter', 'circumcenter', 'orthocenter', 'centroid']

function checkReferences(construction) {
  const registry = new Set()
  const brokenRefs = []
  const elements = construction?.elements || []

  // First pass: collect all defined IDs (including expansion sub-IDs)
  for (const el of elements) {
    if (el.id) {
      registry.add(el.id)
      // Add sub-element references for expandable types
      if (EXPANDABLE_TYPES.includes(el.type)) {
        // These types create hidden sub-elements with predictable IDs
        registry.add(`${el.id}__bis1`)
        registry.add(`${el.id}__bis2`)
        registry.add(`${el.id}__mid1`)
        registry.add(`${el.id}__mid2`)
        registry.add(`${el.id}__ln1`)
        registry.add(`${el.id}__ln2`)
        registry.add(`${el.id}__pb1`)
        registry.add(`${el.id}__pb2`)
        registry.add(`${el.id}__alt1`)
        registry.add(`${el.id}__alt2`)
        registry.add(`${el.id}__med1`)
        registry.add(`${el.id}__med2`)
      }
    }
  }

  // Second pass: check parent references
  for (const el of elements) {
    if (!Array.isArray(el.parents)) continue

    for (let i = 0; i < el.parents.length; i++) {
      const p = el.parents[i]
      if (typeof p !== 'string') continue

      // Skip numeric strings (literal values)
      if (/^\d+(\.\d+)?$/.test(p)) continue

      // Handle .point sub-element references
      const baseId = p.includes('.') ? p.split('.')[0] : p

      if (!registry.has(baseId)) {
        brokenRefs.push({
          elementId: el.id || `(index ${elements.indexOf(el)})`,
          elementType: el.type,
          parentIndex: i,
          referencedId: p,
        })
      }
    }
  }

  return { brokenCount: brokenRefs.length, brokenRefs }
}

// ── Bbox Quality Analysis ────────────────────────────────────────────────────

function analyzeBbox(construction) {
  const bbox = construction?.bbox
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return { valid: false, error: 'invalid bbox' }
  }

  const [xmin, ymax, xmax, ymin] = bbox
  const xRange = xmax - xmin
  const yRange = ymax - ymin

  if (xRange <= 0 || yRange <= 0) {
    return { valid: false, error: 'bbox has non-positive range', xRange, yRange }
  }

  const ratio = Math.min(xRange, yRange) / Math.max(xRange, yRange)

  // Check if points are within bbox
  const pointsOutside = []
  for (const el of (construction?.elements || [])) {
    if (el.type === 'point' && Array.isArray(el.parents)) {
      for (const p of el.parents) {
        if (Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number')) {
          const [x, y] = p
          const tolerance = Math.max(xRange, yRange) * 0.1
          if (x < xmin - tolerance || x > xmax + tolerance ||
              y < ymin - tolerance || y > ymax + tolerance) {
            pointsOutside.push({ id: el.id, coords: p })
          }
        }
      }
    }
  }

  return {
    valid: true,
    xRange: +xRange.toFixed(2),
    yRange: +yRange.toFixed(2),
    ratio: +ratio.toFixed(3),
    ratioGrade: ratio >= 0.7 ? 'good' : ratio >= 0.5 ? 'ok' : 'poor',
    pointsOutside,
  }
}

// ── Animation Validation ─────────────────────────────────────────────────────

function validateAnimation(construction, benchmarkItem) {
  if (!benchmarkItem?.hasAnimation) {
    return { required: false, score: 'N/A' }
  }

  const anim = construction?.animation
  if (!anim) {
    return { required: true, present: false, errors: ['animation block missing for animated question'] }
  }

  const errors = []
  const warnings = []

  if (anim.range[0] >= anim.range[1]) {
    errors.push(`range reversed: [${anim.range[0]}, ${anim.range[1]}]`)
  }

  if (anim.default < anim.range[0] || anim.default > anim.range[1]) {
    errors.push(`default ${anim.default} outside range [${anim.range}]`)
  }

  if (!anim.snapValues || anim.snapValues.length === 0) {
    errors.push('snapValues missing or empty')
  } else {
    const expected = benchmarkItem.animationExpected
    if (expected?.snapCount && anim.snapValues.length !== expected.snapCount) {
      warnings.push(`expected ${expected.snapCount} snaps, got ${anim.snapValues.length}`)
    }
    for (const sv of anim.snapValues) {
      if (!sv.note) warnings.push(`snap "${sv.label}" missing note`)
    }
  }

  if (!anim.autoPlay) {
    warnings.push('autoPlay not set')
  }

  return {
    required: true,
    present: true,
    errors,
    warnings,
    param: anim.param,
    range: anim.range,
    snapCount: anim.snapValues?.length ?? 0,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function validateConstruction(construction, benchmarkItem) {
  const schema = validateSchema(construction)
  const refs = checkReferences(construction)
  const bbox = analyzeBbox(construction)
  const animation = validateAnimation(construction, benchmarkItem)

  return { schema, refs, bbox, animation }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args2 = process.argv.slice(2)
let mode = 'help'
let inputPath = null

for (let i = 0; i < args2.length; i++) {
  if (args2[i] === '--results' && args2[i + 1]) { mode = 'results'; inputPath = args2[i + 1] }
  if (args2[i] === '--test') { mode = 'test' }
  if (args2[i] === '--json' && args2[i + 1]) { mode = 'single'; inputPath = args2[i + 1] }
}

if (mode === 'help') {
  console.log('Usage:')
  console.log('  node validate-construction.mjs --results results/v1-results.json')
  console.log('  node validate-construction.mjs --test')
  console.log('  node validate-construction.mjs --json \'{"kind":"2d",...}\'')
  process.exit(0)
}

if (mode === 'test') {
  console.log('══════ Running validation tests ══════\n')

  // Good example
  const good = {
    kind: '2d',
    bbox: [-1, 6, 8, -1],
    elements: [
      { id: 'A', type: 'point', parents: [[0, 0]], attrs: { name: 'A', highlight: false } },
      { id: 'B', type: 'point', parents: [[4, 0]], attrs: { name: 'B', highlight: false } },
      { id: 'C', type: 'point', parents: [[2, 3]], attrs: { name: 'C', highlight: false } },
      { type: 'segment', parents: ['A', 'B'], attrs: { highlight: false } },
      { type: 'segment', parents: ['B', 'C'], attrs: { highlight: false } },
      { type: 'segment', parents: ['A', 'C'], attrs: { highlight: false } },
    ],
  }
  const goodResult = validateConstruction(good, { hasAnimation: false })
  console.log('Good example:', goodResult.schema.valid ? 'PASS' : 'FAIL', goodResult.schema.errors)
  console.log('  Refs:', goodResult.refs.brokenCount === 0 ? 'PASS' : 'FAIL', `(${goodResult.refs.brokenCount} broken)`)
  console.log('  Bbox:', goodResult.bbox.ratioGrade, `ratio=${goodResult.bbox.ratio}`)

  // Bad example — broken refs
  const bad = {
    kind: '2d',
    bbox: [-1, 6, 8, -1],
    elements: [
      { id: 'A', type: 'point', parents: [[0, 0]], attrs: {} },
      { type: 'segment', parents: ['A', 'MISSING_B'], attrs: {} },
    ],
  }
  const badResult = validateConstruction(bad, { hasAnimation: false })
  console.log('\nBad example (broken ref):', badResult.refs.brokenCount === 1 ? 'PASS' : 'FAIL',
    `(${badResult.refs.brokenCount} broken refs)`)

  // Bad example — bad bbox
  const badBbox = {
    kind: '2d',
    bbox: [-0.5, 2.5, 10, -0.5],  // x-range=10.5, y-range=3 → squashed
    elements: [
      { id: 'A', type: 'point', parents: [[0, 0]], attrs: {} },
    ],
  }
  const badBboxResult = validateConstruction(badBbox, { hasAnimation: false })
  console.log('\nBad bbox example:', badBboxResult.bbox.ratioGrade === 'poor' ? 'PASS' : 'FAIL',
    `ratio=${badBboxResult.bbox.ratio}`)

  // Bad example — animation issues
  const badAnim = {
    kind: '2d',
    bbox: [-1, 2, 2, -1],
    elements: [
      { id: 'P', type: 'point', parents: [{ expr: 'Math.cos(theta)' }, { expr: 'Math.sin(theta)' }], attrs: {} },
    ],
    animation: {
      param: 'theta',
      range: [180, 1],  // reversed!
      default: 90,
    },
  }
  const badAnimResult = validateConstruction(badAnim, { hasAnimation: true, animationExpected: { snapCount: 3 } })
  console.log('\nBad animation example:')
  console.log('  Schema errors:', badAnimResult.schema.errors)
  console.log('  Animation errors:', badAnimResult.animation.errors)

  console.log('\n══════ All validation tests complete ══════')
  process.exit(0)
}

if (mode === 'single') {
  let construction
  try {
    construction = JSON.parse(inputPath)
  } catch {
    console.error('Failed to parse JSON input')
    process.exit(1)
  }
  const result = validateConstruction(construction, { hasAnimation: !!construction.animation })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (mode === 'results') {
  const resultsPath = path.resolve(inputPath)
  if (!fs.existsSync(resultsPath)) {
    console.error(`Results file not found: ${resultsPath}`)
    process.exit(1)
  }

  const benchmarkPath = path.resolve(__dirname, 'benchmark.json')
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf-8'))
  const benchmarkMap = Object.fromEntries(benchmark.map(b => [b.id, b]))

  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
  const validationResults = []

  console.log(`══════ Validating ${data.results.length} results ══════\n`)

  for (const result of data.results) {
    const benchItem = benchmarkMap[result.benchmarkId]
    const validations = {}

    for (const field of ['geometryFigure', 'solutionGeometryFigure']) {
      const construction = result.fields?.[field]
      if (!construction) {
        validations[field] = { present: false }
        continue
      }
      validations[field] = validateConstruction(construction, benchItem)
    }

    const entry = {
      benchmarkId: result.benchmarkId,
      category: benchItem?.category,
      hasAnimation: benchItem?.hasAnimation,
      validations,
    }

    validationResults.push(entry)

    // Log summary
    const gf = validations.geometryFigure
    const sf = validations.solutionGeometryFigure
    const gfStatus = gf.present === false ? '✗ missing' :
      (gf.schema?.valid && gf.refs?.brokenCount === 0 ? '✓' : '⚠')
    const sfStatus = sf.present === false ? (benchItem?.hasAnimation ? '✗ missing' : '—') :
      (sf.schema?.valid && sf.refs?.brokenCount === 0 ? '✓' : '⚠')

    console.log(`${result.benchmarkId}: geoFig=${gfStatus} solFig=${sfStatus}`)
    if (gf.refs?.brokenCount > 0) {
      console.log(`  broken refs: ${gf.refs.brokenRefs.map(r => r.referencedId).join(', ')}`)
    }
    if (gf.bbox?.ratioGrade === 'poor') {
      console.log(`  bbox: ratio=${gf.bbox.ratio} (poor)`)
    }
  }

  // Save validation results alongside the results file
  const validationFile = resultsPath.replace('-results.json', '-validation.json')
  fs.writeFileSync(validationFile, JSON.stringify({ validationResults }, null, 2), 'utf-8')
  console.log(`\nValidation saved: ${validationFile}`)
}
