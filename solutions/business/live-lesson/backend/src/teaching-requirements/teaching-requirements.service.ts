/**
 * TeachingRequirementsService — L1 (library) loader + lookups.
 *
 * Loads `data/teaching-requirements/<subject>.json` files at module
 * bootstrap and builds an in-memory index keyed by `(subject, itemId)`.
 * The library is a platform asset (shipped, read-only) — no DB writes
 * for L1. Teachers add interpretations via the L2 path (separate
 * service); see `requirement-interpretation.service.ts`.
 *
 * Why in-memory index instead of re-reading JSON per request: the
 * library is small (hundreds of items), changes only on platform
 * upgrade, and lookups happen on every `/api/teaching-requirements/:id`
 * call (which Plan Tab + Materializer hit liberally). O(1) lookup vs
 * O(n) scan matters.
 *
 * Path resolution: `process.env.TEACHING_REQUIREMENTS_DIR` overrides
 * the default (`backend/data/teaching-requirements/`). Tests use the
 * override to avoid stomping prod data.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

import type {
  TeachingRequirementsLibrary,
  ReqCategory,
  ReqItem,
  ReqItemWithCategory,
} from './types';

// Runtime shape guard for library JSON files. A malformed but
// JSON-parseable file (missing fields, wrong types) would otherwise
// produce TypeErrors from `indexLibrary`; we want the "log + skip"
// path the loader promises.
const ReqItemSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  text: z.string().min(1),
});

const ReqCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  items: z.array(ReqItemSchema),
});

const TeachingRequirementsLibrarySchema = z.object({
  subject: z.string().min(1),
  subjectLabel: z.string().min(1),
  version: z.string().min(1),
  categories: z.array(ReqCategorySchema),
});

const DEFAULT_DATA_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'teaching-requirements',
);

@Injectable()
export class TeachingRequirementsService implements OnModuleInit {
  private readonly logger = new Logger(TeachingRequirementsService.name);

  /** subject → loaded library */
  private libraries = new Map<string, TeachingRequirementsLibrary>();

  /** "{subject}/{itemId}" → resolved item w/ category metadata */
  private itemIndex = new Map<string, ReqItemWithCategory>();

  /** itemId → "{subject}/{itemId}" (for lookups without subject hint) */
  private idToKey = new Map<string, string>();

  /**
   * Single-flight reload. Concurrent `reload()` calls (admin trigger
   * racing with `onModuleInit`, or two tests sharing a singleton)
   * collapse onto one in-flight promise — without this the second
   * caller's `clear()` would race with the first's index population
   * and produce partial state.
   */
  private reloadInFlight: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Re-scan the data dir from disk. Public for tests to call after
   * writing fixture JSONs into a temp dir.
   *
   * Atomic-swap semantics: all I/O builds into local maps, only swapped
   * into the service's state at the very end. A concurrent reader
   * never sees partial state.
   */
  async reload(): Promise<void> {
    if (this.reloadInFlight) {
      return this.reloadInFlight;
    }
    this.reloadInFlight = this.doReload();
    try {
      await this.reloadInFlight;
    } finally {
      this.reloadInFlight = null;
    }
  }

  private async doReload(): Promise<void> {
    const dir = process.env.TEACHING_REQUIREMENTS_DIR || DEFAULT_DATA_DIR;
    const resolvedDir = path.resolve(dir);

    // Build into LOCAL maps; only swap into `this` at the end so a
    // concurrent reader never sees a half-cleared state.
    const nextLibraries = new Map<string, TeachingRequirementsLibrary>();
    const nextItemIndex = new Map<string, ReqItemWithCategory>();
    const nextIdToKey = new Map<string, string>();

    let entries: string[];
    try {
      entries = await fs.readdir(resolvedDir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `teaching-requirements dir not readable (${resolvedDir}): ${msg}`,
      );
      this.swapState(nextLibraries, nextItemIndex, nextIdToKey);
      return;
    }

    // Sort to guarantee deterministic resolution under cross-subject id
    // collisions. readdir() order is filesystem-defined (alphabetical on
    // APFS, inode-order on ext4, arbitrary on tmpfs) — without sort, a
    // colliding id like `r-1.2.3` could resolve to a different subject
    // depending on the host.
    entries.sort();

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const file = path.join(resolvedDir, entry);
      try {
        const raw = await fs.readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        const result = TeachingRequirementsLibrarySchema.safeParse(parsed);
        if (!result.success) {
          this.logger.error(
            `invalid library schema in ${file}: ${result.error.issues
              .map((i) => `${i.path.join('.')} ${i.message}`)
              .join('; ')}`,
          );
          continue;
        }
        // Zod's `.safeParse` returns `Partial<...>`-ish inferred types
        // for nested optionals; we narrowed with min(1) so a cast is
        // safe here. The runtime guarantees match the static shape.
        const lib = result.data as TeachingRequirementsLibrary;
        if (nextLibraries.has(lib.subject)) {
          this.logger.error(
            `duplicate subject "${lib.subject}" in ${file} — keeping first`,
          );
          continue;
        }
        this.indexLibrary(lib, nextItemIndex, nextIdToKey);
        nextLibraries.set(lib.subject, lib);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`failed to load ${file}: ${msg}`);
      }
    }

    this.swapState(nextLibraries, nextItemIndex, nextIdToKey);
    this.logger.log(
      `loaded ${this.libraries.size} subject(s), ${this.itemIndex.size} req item(s) from ${resolvedDir}`,
    );
  }

  private swapState(
    libs: Map<string, TeachingRequirementsLibrary>,
    items: Map<string, ReqItemWithCategory>,
    ids: Map<string, string>,
  ): void {
    this.libraries = libs;
    this.itemIndex = items;
    this.idToKey = ids;
  }

  /** List all subjects' libraries (full hierarchical shape, for picker UI). */
  listLibraries(): TeachingRequirementsLibrary[] {
    return Array.from(this.libraries.values());
  }

  /** Get one subject's library, or null if unknown subject. */
  getLibrary(subject: string): TeachingRequirementsLibrary | null {
    return this.libraries.get(subject) ?? null;
  }

  /**
   * Look up a req item by id (across all subjects). Returns the item
   * with category metadata merged in. Throws NotFoundException if no
   * such id is registered.
   *
   * The agent path doesn't need to know which subject an id belongs
   * to — id prefixes (`r-*`, `m-*`) are not enforced by this lookup.
   */
  findItemById(itemId: string): ReqItemWithCategory {
    const key = this.idToKey.get(itemId);
    if (!key) throw new NotFoundException(`req item not found: ${itemId}`);
    // Invariant: idToKey and itemIndex are written together in
    // indexLibrary, so a key from idToKey is always present in
    // itemIndex. The non-null assertion makes the invariant explicit.
    return this.itemIndex.get(key)!;
  }

  /**
   * Soft lookup. Returns undefined when the id is unknown. Used by the
   * canonicalizer path where missing ids should render as "stale chip"
   * rather than 404.
   */
  tryFindItemById(itemId: string): ReqItemWithCategory | undefined {
    const key = this.idToKey.get(itemId);
    if (!key) return undefined;
    return this.itemIndex.get(key);
  }

  /**
   * Search across a subject (or all subjects) by case-insensitive
   * substring match on text or code. `subject` is optional to allow
   * cross-subject discovery (rare, but agent might not know).
   */
  search(opts: { subject?: string; q?: string } = {}): ReqItemWithCategory[] {
    const q = opts.q?.trim().toLowerCase() ?? '';
    const subjects = opts.subject
      ? [this.libraries.get(opts.subject)].filter(
          (lib): lib is TeachingRequirementsLibrary => lib != null,
        )
      : Array.from(this.libraries.values());

    const out: ReqItemWithCategory[] = [];
    for (const lib of subjects) {
      for (const category of lib.categories) {
        for (const item of category.items) {
          if (q && !this.matches(item, q)) continue;
          out.push(this.attachCategory(lib.subject, category, item));
        }
      }
    }
    return out;
  }

  // ── Helpers ──

  private indexLibrary(
    lib: TeachingRequirementsLibrary,
    itemIndex: Map<string, ReqItemWithCategory>,
    idToKey: Map<string, string>,
  ): void {
    for (const category of lib.categories) {
      for (const item of category.items) {
        const key = `${lib.subject}/${item.id}`;
        if (itemIndex.has(key)) {
          this.logger.warn(`duplicate req id within subject: ${key}`);
          continue;
        }
        itemIndex.set(key, this.attachCategory(lib.subject, category, item));
        // Cross-subject collision: keep the first registration (libs
        // were sorted alphabetically at load time, so this is
        // deterministic across hosts).
        if (idToKey.has(item.id)) {
          this.logger.warn(
            `req id collides across subjects: ${item.id} (keeping first registration via idToKey)`,
          );
          continue;
        }
        idToKey.set(item.id, key);
      }
    }
  }

  private attachCategory(
    subject: string,
    category: ReqCategory,
    item: ReqItem,
  ): ReqItemWithCategory {
    return {
      id: item.id,
      code: item.code,
      text: item.text,
      subject,
      categoryId: category.id,
      categoryLabel: category.label,
      categoryColor: category.color,
    };
  }

  private matches(item: ReqItem, q: string): boolean {
    return (
      item.text.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }
}
