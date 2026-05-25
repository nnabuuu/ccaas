/**
 * DemoEntityProvider — DocumentEditProvider implementation backed by an
 * in-memory Map, seeded from solutions/business/demo-sandbox/entities/
 * on construction. Real solutions would back this with TypeORM.
 *
 * Entity model: each `.md` file with frontmatter under entities/customers/
 * becomes one entity. The frontmatter is `meta`; the markdown body is a
 * single `text` block. `str_replace` edits target the meta YAML directly
 * (since meta serializes back into the frontmatter on save).
 *
 * Editable fields are sourced from resources/data-dictionary.json. Only
 * fields marked `editable: true` accept edits — others throw.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import matter from 'gray-matter';

// Subpath import — context-layer's main index doesn't re-export
// DocumentEditProvider; only its `./core` subpath does. Using the
// long dist path here so this file works under nest's default
// moduleResolution=node (no need for node16/bundler upgrade).
import { DocumentEditProvider } from '@kedge-agentic/context-layer/dist/core/document-edit-provider.js';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';

interface DemoEntity {
  id: string;
  filePath: string; // absolute
  category: string; // e.g. 'customers'
  meta: Record<string, any>;
  body: string;
}

const SOLUTION_ROOT = resolve(__dirname, '..', '..', '..');
const ENTITIES_ROOT = join(SOLUTION_ROOT, 'entities');
const DATA_DICTIONARY_PATH = join(SOLUTION_ROOT, 'resources', 'data-dictionary.json');

@Injectable()
export class DemoEntityProvider extends DocumentEditProvider implements OnModuleInit {
  private readonly logger = new Logger(DemoEntityProvider.name);
  private readonly store = new Map<string, DemoEntity>();
  private editableFieldsSet = new Set<string>();

  onModuleInit() {
    this.loadEditableFields();
    this.seedFromDisk();
    this.logger.log(
      `Loaded ${this.store.size} entities from ${ENTITIES_ROOT} ` +
      `(editable fields: ${[...this.editableFieldsSet].join(', ')})`,
    );
  }

  // ─── DocumentEditProvider abstract methods ─────────────────────────────

  async loadEntity(id: string): Promise<DemoEntity> {
    const e = this.store.get(id);
    if (!e) throw new Error(`Entity not found: ${id}`);
    return e;
  }

  async saveEntity(id: string, updates: Record<string, any>): Promise<void> {
    const e = this.store.get(id);
    if (!e) throw new Error(`Entity not found: ${id}`);
    Object.assign(e.meta, updates);
    // Write back to disk (synchronously) so the host file mutates and the
    // user can see the edit reflected in their working tree.
    const yaml = matter.stringify(e.body, e.meta);
    writeFileSync(e.filePath, yaml);
    this.logger.log(`Saved entity ${id} (fields updated: ${Object.keys(updates).join(', ')})`);
  }

  toEntityDocument(entity: DemoEntity): EntityDocument {
    return {
      meta: this.coerceMetaToDocumentMeta(entity.meta),
      blocks: [{ type: 'text', content: { text: entity.body } }],
    };
  }

  getEditableFields(): Set<string> {
    return this.editableFieldsSet;
  }

  getContentToAttrConfig(): ContentToAttrConfig {
    // No block-attribute lifting needed for our simple text-block model.
    return {};
  }

  // ─── Public surface for controller ─────────────────────────────────────

  listIds(): string[] {
    return [...this.store.keys()];
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private loadEditableFields() {
    if (!existsSync(DATA_DICTIONARY_PATH)) {
      this.logger.warn(`No data-dictionary.json at ${DATA_DICTIONARY_PATH} — no fields will be editable`);
      return;
    }
    const dict = JSON.parse(readFileSync(DATA_DICTIONARY_PATH, 'utf8'));
    const customerFields = dict.entities?.customers?.frontmatter_fields ?? {};
    for (const [key, spec] of Object.entries(customerFields)) {
      if ((spec as any).editable === true) this.editableFieldsSet.add(key);
    }
  }

  private seedFromDisk() {
    if (!existsSync(ENTITIES_ROOT)) {
      this.logger.warn(`No entities/ at ${ENTITIES_ROOT}`);
      return;
    }
    // Only `customers/` exposes the edit API for the demo. Revenue + plans
    // are derived / approval-required per the data dictionary.
    const customersDir = join(ENTITIES_ROOT, 'customers');
    if (!existsSync(customersDir)) return;
    for (const entry of readdirSync(customersDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = join(customersDir, entry.name);
      const raw = readFileSync(filePath, 'utf8');
      const parsed = matter(raw);
      const id = parsed.data.id ?? basename(entry.name, '.md');
      this.store.set(id, {
        id,
        filePath,
        category: 'customers',
        meta: parsed.data,
        body: parsed.content,
      });
    }
  }

  /**
   * DocumentMeta in entity-document is typed as `string | number | boolean`
   * only, but our entity frontmatter has date objects (gray-matter parses
   * them). Coerce dates to ISO strings so the type contract holds.
   */
  private coerceMetaToDocumentMeta(meta: Record<string, any>) {
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (v instanceof Date) {
        out[k] = v.toISOString().slice(0, 10);
      } else {
        out[k] = String(v);
      }
    }
    return out;
  }
}
