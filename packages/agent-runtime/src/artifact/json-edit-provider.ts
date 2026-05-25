/**
 * JsonEditProvider — the first concrete `ArtifactEditor` to ship.
 *
 * Supports JSON artifacts edited via:
 *   - `field_set` (JSON Pointer RFC 6901 path → value)
 *   - `json_patch` (RFC 6902 ops; add/remove/replace subset)
 *   - `replace` (wholesale content swap)
 *
 * Optional schema validation runs AFTER all ops apply: if a validator
 * is configured and the post-edit content fails validation, the edit
 * returns `success: false` and the original artifact is untouched
 * (atomicity).
 *
 * `str_replace` is explicitly rejected — that op shape belongs to
 * markdown editors (Phase 1's MarkdownArtifactEditor wraps
 * `@kedge-agentic/context-layer`'s `DocumentEditProvider`).
 */

import type {
  Artifact,
  ArtifactEditor,
  EditOperation,
  EditResult,
} from './types.js';
import type { SchemaValidator } from '../schema/types.js';

export interface JsonEditProviderOptions {
  /**
   * If set, edits validate the post-edit content against this
   * schema. On failure, the edit returns `success: false` and the
   * input artifact is left untouched.
   */
  validator?: SchemaValidator;
}

export class JsonEditProvider implements ArtifactEditor<object> {
  constructor(private readonly opts: JsonEditProviderOptions = {}) {}

  serialize(artifact: Artifact<object>): string {
    return JSON.stringify(artifact.content, null, 2);
  }

  async edit(
    artifact: Artifact<object>,
    ops: ReadonlyArray<EditOperation>,
  ): Promise<EditResult<object>> {
    // structuredClone gives atomicity: if any op fails we throw away
    // the working copy without touching the original.
    let working = structuredClone(artifact.content) as unknown;

    for (const op of ops) {
      try {
        if (op.op === 'field_set') {
          working = applyFieldSet(working, op.path, op.value);
        } else if (op.op === 'json_patch') {
          working = applyJsonPatch(working, op.ops);
        } else if (op.op === 'replace') {
          working = op.content;
        } else if (op.op === 'str_replace') {
          return {
            success: false,
            error:
              "JsonEditProvider doesn't support str_replace; use field_set or json_patch (str_replace is for MarkdownArtifactEditor)",
          };
        } else {
          // Exhaustiveness: TypeScript guarantees `op` is `never` here,
          // but defensive runtime check for cases where callers cast.
          return {
            success: false,
            error: `unsupported op: ${(op as { op: string }).op}`,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `edit op failed: ${msg}` };
      }
    }

    if (this.opts.validator) {
      const r = this.opts.validator.validate(working);
      if (!r.ok) {
        return { success: false, error: `schema validation failed: ${r.error}` };
      }
      working = r.value;
    }

    return {
      success: true,
      artifact: {
        ...artifact,
        content: working as object,
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

// ─── JSON Pointer (RFC 6901) ───────────────────────────────────────────────

/**
 * Decode a single JSON Pointer reference token:
 *   ~1 → /  (must come first so ~01 doesn't decode wrongly)
 *   ~0 → ~
 */
function decodePointerToken(token: string): string {
  // Reject malformed escapes: a `~` followed by anything other than 0 or 1.
  // RFC 6901 reserves `~` exclusively for the two escape sequences.
  if (/~(?![01])/.test(token)) {
    throw new Error(
      `invalid JSON Pointer token "${token}": "~" must be followed by "0" or "1"`,
    );
  }
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** A token that looks like an array index (digits) or the array-append marker. */
function looksLikeArrayIndex(token: string): boolean {
  return token === '-' || /^(0|[1-9]\d*)$/.test(token);
}

function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`invalid JSON Pointer: "${pointer}" — must start with "/" or be empty`);
  }
  return pointer.slice(1).split('/').map(decodePointerToken);
}

/**
 * Set the leaf at `pointer` to `value` on a deep clone of `root`.
 * Walks dotted paths through nested objects/arrays. Creates
 * intermediate objects if missing (for `field_set` ergonomics —
 * matches what users typically want when setting `/foo/bar/baz` on
 * `{}`).
 */
function applyFieldSet(root: unknown, pointer: string, value: unknown): unknown {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    // setting the root → return value verbatim
    return value;
  }
  // We clone defensively in the editor; here we mutate the (already
  // cloned) working copy. Cast to any to walk freely.
  if (root === null || typeof root !== 'object') {
    throw new Error(`cannot field_set into non-object root for path "${pointer}"`);
  }
  let cursor: any = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (cursor[token] === undefined || cursor[token] === null) {
      // Auto-create the intermediate. Peek at the *next* token to choose
      // between object and array: a numeric / "-" next token means the
      // child should be an array. Without this lookahead we'd produce
      // `{ items: { "0": ... } }` instead of `{ items: [ ... ] }` —
      // surprising for callers writing JSON manifests.
      cursor[token] = looksLikeArrayIndex(tokens[i + 1]) ? [] : {};
    }
    cursor = cursor[token];
    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error(`field_set: intermediate "${tokens.slice(0, i + 1).join('/')}" is not an object`);
    }
  }
  const last = tokens[tokens.length - 1];
  if (Array.isArray(cursor) && last === '-') {
    cursor.push(value);
  } else {
    cursor[last] = value;
  }
  return root;
}

// ─── JSON Patch (RFC 6902) — minimal subset: add / remove / replace ────────

interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

function applyJsonPatch(root: unknown, ops: ReadonlyArray<unknown>): unknown {
  let working = root;
  for (const raw of ops) {
    const op = raw as Partial<JsonPatchOp>;
    if (!op || typeof op !== 'object' || typeof op.op !== 'string' || typeof op.path !== 'string') {
      throw new Error(`invalid json-patch op: ${JSON.stringify(raw)}`);
    }
    if (op.op === 'add' || op.op === 'replace') {
      working = applyFieldSet(working, op.path, op.value);
    } else if (op.op === 'remove') {
      working = applyRemove(working, op.path);
    } else {
      throw new Error(`unsupported json-patch op: "${op.op}" (only add/remove/replace are supported)`);
    }
  }
  return working;
}

function applyRemove(root: unknown, pointer: string): unknown {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    throw new Error('cannot remove root');
  }
  if (root === null || typeof root !== 'object') {
    throw new Error(`cannot remove from non-object root for path "${pointer}"`);
  }
  let cursor: any = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    cursor = cursor[tokens[i]];
    if (cursor === undefined || cursor === null) {
      throw new Error(`remove: path "${tokens.slice(0, i + 1).join('/')}" does not exist`);
    }
  }
  const last = tokens[tokens.length - 1];
  if (Array.isArray(cursor)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) {
      throw new Error(`remove: invalid array index "${last}"`);
    }
    cursor.splice(idx, 1);
  } else if (last in cursor) {
    delete cursor[last];
  } else {
    throw new Error(`remove: path "${pointer}" does not exist`);
  }
  return root;
}
