/**
 * §18 / P4: Persistent short-code service.
 *
 * Maps a short URL slug to a {bundleId, storyName} pair, plus optional
 * expiration timestamp. Backed by a single JSON file for v1 (no DB needed)
 * — sufficient for a few thousand entries and zero infrastructure.
 *
 * In production a custom backend (Redis, DynamoDB, etc.) can replace this
 * by implementing the same async API.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export interface ShortCodeEntry {
  bundleId: string;
  storyName: string;
  /** Unix ms timestamp after which the code is invalid; undefined = never */
  expiresAt?: number;
  /** When the entry was registered */
  createdAt: number;
  /** Optional notes (e.g. campaign name) */
  notes?: string;
}

export interface ShortCodesStore {
  register(code: string, entry: Omit<ShortCodeEntry, 'createdAt'>): Promise<void>;
  /** Generate a unique short code and register it */
  create(entry: Omit<ShortCodeEntry, 'createdAt'>, options?: { length?: number; deterministic?: boolean }): Promise<string>;
  resolve(code: string): Promise<ShortCodeEntry | null>;
  delete(code: string): Promise<boolean>;
  list(): Promise<Array<{ code: string } & ShortCodeEntry>>;
  prune(): Promise<number>;
}

/** File-backed implementation. */
export class FileShortCodesStore implements ShortCodesStore {
  private cache: Record<string, ShortCodeEntry> | null = null;

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Record<string, ShortCodeEntry>> {
    if (this.cache) return this.cache;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(raw) as Record<string, ShortCodeEntry>;
      } else {
        this.cache = {};
      }
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
  }

  async register(code: string, entry: Omit<ShortCodeEntry, 'createdAt'>): Promise<void> {
    const cache = await this.load();
    cache[code] = { ...entry, createdAt: Date.now() };
    await this.save();
  }

  async create(
    entry: Omit<ShortCodeEntry, 'createdAt'>,
    options: { length?: number; deterministic?: boolean } = {},
  ): Promise<string> {
    const len = options.length ?? 8;
    const cache = await this.load();
    let code: string;

    if (options.deterministic) {
      code = createHash('sha256')
        .update(`${entry.bundleId}:${entry.storyName}`)
        .digest('base64url')
        .slice(0, len);
    } else {
      // Random with collision retry
      let attempts = 0;
      do {
        code = randomBytes(Math.ceil((len * 6) / 8))
          .toString('base64url')
          .slice(0, len);
        attempts++;
      } while (cache[code] && attempts < 10);
      if (cache[code]) throw new Error('short-code collision after 10 attempts');
    }

    cache[code] = { ...entry, createdAt: Date.now() };
    await this.save();
    return code;
  }

  async resolve(code: string): Promise<ShortCodeEntry | null> {
    const cache = await this.load();
    const entry = cache[code];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) return null;
    return entry;
  }

  async delete(code: string): Promise<boolean> {
    const cache = await this.load();
    if (!(code in cache)) return false;
    delete cache[code];
    await this.save();
    return true;
  }

  async list(): Promise<Array<{ code: string } & ShortCodeEntry>> {
    const cache = await this.load();
    return Object.entries(cache).map(([code, entry]) => ({ code, ...entry }));
  }

  async prune(): Promise<number> {
    const cache = await this.load();
    const now = Date.now();
    let count = 0;
    for (const [code, entry] of Object.entries(cache)) {
      if (entry.expiresAt && entry.expiresAt < now) {
        delete cache[code];
        count++;
      }
    }
    if (count > 0) await this.save();
    return count;
  }
}

/** In-memory implementation (tests / ephemeral). */
export class MemoryShortCodesStore implements ShortCodesStore {
  private store = new Map<string, ShortCodeEntry>();

  async register(code: string, entry: Omit<ShortCodeEntry, 'createdAt'>): Promise<void> {
    this.store.set(code, { ...entry, createdAt: Date.now() });
  }

  async create(
    entry: Omit<ShortCodeEntry, 'createdAt'>,
    options: { length?: number; deterministic?: boolean } = {},
  ): Promise<string> {
    const len = options.length ?? 8;
    let code: string;
    if (options.deterministic) {
      code = createHash('sha256')
        .update(`${entry.bundleId}:${entry.storyName}`)
        .digest('base64url')
        .slice(0, len);
    } else {
      code = randomBytes(8).toString('base64url').slice(0, len);
      while (this.store.has(code)) code = randomBytes(8).toString('base64url').slice(0, len);
    }
    this.store.set(code, { ...entry, createdAt: Date.now() });
    return code;
  }

  async resolve(code: string): Promise<ShortCodeEntry | null> {
    const entry = this.store.get(code);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) return null;
    return entry;
  }

  async delete(code: string): Promise<boolean> {
    return this.store.delete(code);
  }

  async list(): Promise<Array<{ code: string } & ShortCodeEntry>> {
    return [...this.store.entries()].map(([code, entry]) => ({ code, ...entry }));
  }

  async prune(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [code, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(code);
        count++;
      }
    }
    return count;
  }
}
