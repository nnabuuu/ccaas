/**
 * Refinement DSL evaluator.
 * Covers all existing Zod .refine() rules with 5 rule types.
 */

export type RefinementDef =
  | { type: 'every-item'; path: string; expr: string; message: string }
  | { type: 'array-length-eq'; paths: [string, string]; message: string }
  | { type: 'every-value-in-set'; valuePath: string; setPath: string; message: string }
  | { type: 'array-is-permutation'; arrayPath: string; lengthRef: string; message: string }
  | { type: 'conditional-required'; path: string; unless: string; required: string[]; message: string };

export interface RefinementResult {
  pass: boolean;
  message?: string;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateEveryItem(def: Extract<RefinementDef, { type: 'every-item' }>, data: unknown): RefinementResult {
  const arr = getByPath(data, def.path);
  if (!Array.isArray(arr)) return { pass: false, message: def.message };

  const root = data;
  const pass = arr.every((item) => {
    try {
      // Safe expression evaluator — only supports simple comparisons
      return evalExpr(def.expr, item, root);
    } catch {
      return false;
    }
  });
  return pass ? { pass: true } : { pass: false, message: def.message };
}

function evaluateArrayLengthEq(def: Extract<RefinementDef, { type: 'array-length-eq' }>, data: unknown): RefinementResult {
  const arr1 = getByPath(data, def.paths[0]);
  const arr2 = getByPath(data, def.paths[1]);
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return { pass: false, message: def.message };
  return arr1.length === arr2.length ? { pass: true } : { pass: false, message: def.message };
}

function evaluateEveryValueInSet(def: Extract<RefinementDef, { type: 'every-value-in-set' }>, data: unknown): RefinementResult {
  const setArr = getByPath(data, def.setPath);
  if (!Array.isArray(setArr)) return { pass: false, message: def.message };
  const validSet = new Set(setArr);

  // valuePath like "sections[].correctFunction" → iterate over sections, check each .correctFunction
  const match = def.valuePath.match(/^(.+)\[\]\.(.+)$/);
  if (!match) return { pass: false, message: def.message };

  const arr = getByPath(data, match[1]);
  const field = match[2];
  if (!Array.isArray(arr)) return { pass: false, message: def.message };

  const pass = arr.every((item) => {
    if (item == null || typeof item !== 'object') return false;
    return validSet.has((item as Record<string, unknown>)[field]);
  });
  return pass ? { pass: true } : { pass: false, message: def.message };
}

function evaluateArrayIsPermutation(def: Extract<RefinementDef, { type: 'array-is-permutation' }>, data: unknown): RefinementResult {
  const arr = getByPath(data, def.arrayPath);
  if (!Array.isArray(arr)) return { pass: false, message: def.message };

  // lengthRef like "items.length" → get the array and check length
  const refMatch = def.lengthRef.match(/^(.+)\.length$/);
  if (!refMatch) return { pass: false, message: def.message };

  const refArr = getByPath(data, refMatch[1]);
  if (!Array.isArray(refArr)) return { pass: false, message: def.message };

  const n = refArr.length;
  if (arr.length !== n) return { pass: false, message: def.message };

  // Check it's a valid permutation of [0..n-1]
  const seen = new Set<number>();
  for (const v of arr) {
    if (typeof v !== 'number' || v < 0 || v >= n || seen.has(v)) {
      return { pass: false, message: def.message };
    }
    seen.add(v);
  }
  return { pass: true };
}

function evaluateConditionalRequired(def: Extract<RefinementDef, { type: 'conditional-required' }>, data: unknown): RefinementResult {
  const arr = getByPath(data, def.path);
  if (!Array.isArray(arr)) return { pass: false, message: def.message };

  const pass = arr.every((item) => {
    if (item == null || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    // If the "unless" condition is truthy, skip validation
    if (obj[def.unless]) return true;
    // Otherwise, all required fields must be present and truthy
    return def.required.every((field) => !!obj[field]);
  });
  return pass ? { pass: true } : { pass: false, message: def.message };
}

/**
 * Minimal expression evaluator for `every-item` rules.
 * Supports: `item.X < item.Y.length`, `item.X || root.Y`
 */
function evalExpr(expr: string, item: unknown, root: unknown): boolean {
  const obj = item as Record<string, unknown>;
  const rootObj = root as Record<string, unknown>;

  // Pattern: "item.correct < item.options.length"
  const ltMatch = expr.match(/^item\.(\w+)\s*<\s*item\.(\w+)\.length$/);
  if (ltMatch) {
    const left = obj[ltMatch[1]];
    const rightArr = obj[ltMatch[2]];
    if (typeof left !== 'number' || !Array.isArray(rightArr)) return false;
    return left < rightArr.length;
  }

  // Pattern: "item.options || root.options"
  const orMatch = expr.match(/^item\.(\w+)\s*\|\|\s*root\.(\w+)$/);
  if (orMatch) {
    const itemVal = obj[orMatch[1]];
    const rootVal = rootObj[orMatch[2]];
    return !!(itemVal || rootVal);
  }

  throw new Error(`Unsupported refinement expression: "${expr}"`);
}

export function evaluateRefinement(def: RefinementDef, data: unknown): RefinementResult {
  switch (def.type) {
    case 'every-item':
      return evaluateEveryItem(def, data);
    case 'array-length-eq':
      return evaluateArrayLengthEq(def, data);
    case 'every-value-in-set':
      return evaluateEveryValueInSet(def, data);
    case 'array-is-permutation':
      return evaluateArrayIsPermutation(def, data);
    case 'conditional-required':
      return evaluateConditionalRequired(def, data);
  }
}
