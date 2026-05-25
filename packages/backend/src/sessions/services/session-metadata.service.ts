/**
 * SessionMetadataService — CRUD for per-session KV metadata.
 *
 * Enforces:
 *   - key grammar: ^[A-Za-z0-9_.-]{1,200}$
 *   - per-value size: 64 KB after JSON.stringify
 *   - per-session total size: 256 KB across all keys
 *   - tenant ownership: session must be in memory AND its tenantId
 *     must match the caller (mirrors `SessionFsService`)
 *
 * Backed by the backend's TypeORM SQLite (`session_metadata` table),
 * NOT the agentfs delta — so it works equally with local + agentfs
 * providers, and survives session workspace cleanup.
 *
 * Endpoints (see `SessionMetadataController`):
 *   GET    /api/v1/sessions/:id/meta
 *   GET    /api/v1/sessions/:id/meta/:key
 *   PUT    /api/v1/sessions/:id/meta/:key   body: { value: unknown }
 *   DELETE /api/v1/sessions/:id/meta/:key
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SessionService } from '../session.service';
import { SessionMetadata } from '../entities/session-metadata.entity';

const KEY_RE = /^[A-Za-z0-9_.-]{1,200}$/;
const MAX_VALUE_BYTES = 64 * 1024;          // 64 KB
const MAX_SESSION_TOTAL_BYTES = 256 * 1024; // 256 KB

export interface SessionMetadataRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

@Injectable()
export class SessionMetadataService {
  constructor(
    private readonly sessions: SessionService,
    @InjectRepository(SessionMetadata)
    private readonly repo: Repository<SessionMetadata>,
  ) {}

  async list(sessionId: string, tenantId: string): Promise<SessionMetadataRow[]> {
    this.requireOwnedSession(sessionId, tenantId);
    const rows = await this.repo.find({ where: { sessionId } });
    return rows.map(this.toRow);
  }

  async get(
    sessionId: string,
    tenantId: string,
    key: string,
  ): Promise<SessionMetadataRow> {
    this.requireKey(key);
    this.requireOwnedSession(sessionId, tenantId);
    const row = await this.repo.findOne({ where: { sessionId, key } });
    if (!row) throw new NotFoundException(`no metadata for ${sessionId}/${key}`);
    return this.toRow(row);
  }

  async put(
    sessionId: string,
    tenantId: string,
    key: string,
    value: unknown,
  ): Promise<SessionMetadataRow> {
    this.requireKey(key);
    this.requireOwnedSession(sessionId, tenantId);

    const serialized = JSON.stringify(value ?? null);
    const byteLen = Buffer.byteLength(serialized, 'utf8');
    if (byteLen > MAX_VALUE_BYTES) {
      throw new PayloadTooLargeException(
        `value too large: ${byteLen}B > ${MAX_VALUE_BYTES}B per-key cap`,
      );
    }

    // Enforce per-session total cap. Subtract the existing row's contribution
    // (if any) before adding the new one — otherwise an UPDATE to the same
    // key with a smaller payload could be wrongly rejected.
    const existing = await this.repo.findOne({ where: { sessionId, key } });
    const existingBytes = existing
      ? Buffer.byteLength(existing.value, 'utf8')
      : 0;
    const otherRows = await this.repo.find({ where: { sessionId } });
    let otherBytes = 0;
    for (const r of otherRows) {
      if (r.key === key) continue; // exclude self
      otherBytes += Buffer.byteLength(r.value, 'utf8');
    }
    if (otherBytes + byteLen > MAX_SESSION_TOTAL_BYTES) {
      throw new PayloadTooLargeException(
        `per-session total cap (${MAX_SESSION_TOTAL_BYTES}B) would be exceeded ` +
        `(other keys: ${otherBytes}B + this key: ${byteLen}B)`,
      );
    }
    void existingBytes; // referenced to be intentional; not used in cap math

    if (existing) {
      existing.value = serialized;
      const saved = await this.repo.save(existing);
      return this.toRow(saved);
    }
    const fresh = this.repo.create({
      sessionId,
      key,
      value: serialized,
      tenantId,
    });
    const saved = await this.repo.save(fresh);
    return this.toRow(saved);
  }

  async delete(sessionId: string, tenantId: string, key: string): Promise<void> {
    this.requireKey(key);
    this.requireOwnedSession(sessionId, tenantId);
    const result = await this.repo.delete({ sessionId, key });
    if (!result.affected) {
      throw new NotFoundException(`no metadata for ${sessionId}/${key}`);
    }
  }

  // ─── internals ─────────────────────────────────────────────────────────

  private requireKey(key: string) {
    if (!key || !KEY_RE.test(key)) {
      throw new BadRequestException(
        `key must match ${KEY_RE} (alphanumeric, underscore, dot, dash; ≤200 chars)`,
      );
    }
  }

  private requireOwnedSession(sessionId: string, tenantId: string) {
    const session = this.sessions.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(
        `session not found or not active: ${sessionId}`,
      );
    }
    if (session.tenantId && session.tenantId !== tenantId) {
      throw new ForbiddenException(
        `session ${sessionId} belongs to a different tenant`,
      );
    }
  }

  private toRow = (row: SessionMetadata): SessionMetadataRow => {
    let value: unknown;
    try {
      value = JSON.parse(row.value);
    } catch {
      value = row.value; // fallback to raw string if parse fails
    }
    return {
      key: row.key,
      value,
      updatedAt: row.updatedAt.toISOString(),
    };
  };
}
