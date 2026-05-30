/**
 * Integration: live-lesson's `emit_todo_card` flowing through the
 * ontology bridge -> ToolCallerProxy -> audit sink.
 *
 * Covers success criterion 2: ActionDef-routed emit_todo_card invokes
 * checkBoundary AND writes a tool_events row (here, an audit-sink
 * entry — the production wiring of the sink to the DB happens in
 * SessionsModule, which is exercised by the existing 15 live-lesson e2e
 * specs unchanged).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import {
  LiveLessonOntologyService,
  LIVE_LESSON_ACTION_NAMESPACE,
  LIVE_LESSON_TENANT_SLUG,
} from './live-lesson-ontology.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../ontology-registry.provider';
import { SolutionsService } from '../../solutions/solutions.service';
import { SolutionToolkitRegistry } from '../../tool-caller/solution-toolkit-registry';
import {
  ToolCallerProxyService,
  type ToolCallAuditSink,
} from '../../tool-caller/tool-caller-proxy.service';
import type {
  ExecutionContext,
  ToolCallAuditEntry,
} from '../../tool-caller/types';

const FAKE_LIVE_LESSON_UUID = 'live-lesson-uuid-0000-0000-0000-000000000000';

class FakeSolutionsService {
  async findOne(idOrSlug: string) {
    if (idOrSlug === LIVE_LESSON_TENANT_SLUG || idOrSlug === FAKE_LIVE_LESSON_UUID) {
      return { id: FAKE_LIVE_LESSON_UUID, slug: LIVE_LESSON_TENANT_SLUG };
    }
    return null;
  }
}

describe('LiveLessonOntologyService (integration)', () => {
  let registry: OntologyRegistry;
  let toolkits: SolutionToolkitRegistry;
  let proxy: ToolCallerProxyService;
  let auditEntries: ToolCallAuditEntry[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OntologyRegistryProvider,
        SolutionToolkitRegistry,
        ToolCallerProxyService,
        LiveLessonOntologyService,
        { provide: SolutionsService, useClass: FakeSolutionsService },
      ],
    }).compile();
    registry = module.get(ONTOLOGY_REGISTRY);
    toolkits = module.get(SolutionToolkitRegistry);
    proxy = module.get(ToolCallerProxyService);
    auditEntries = [];
    const sink: ToolCallAuditSink = {
      record: (entry) => {
        auditEntries.push(entry);
      },
    };
    proxy.setAuditSink(sink);
    // module.init() fires every provider's onModuleInit lifecycle hook
    // — same path production uses — instead of calling our service's
    // hook by hand (which would break if a second init crept in).
    await module.init();
  });

  it('registers 4 object types + LessonSession manifest (registry NOT sealed yet — OntologySealService seals at onApplicationBootstrap)', () => {
    expect(registry.getAllObjectTypes().map((t) => t.apiName).sort()).toEqual([
      'ClassroomSession',
      'Lesson',
      'Resource',
      'Student',
    ]);
    expect(registry.getManifest('LessonSession')).toBeDefined();
    // Sealing is the OntologySealService's job, not this service's —
    // registering here only adds to the registry. See pass-3 review S1.
    expect(registry.isSealed()).toBe(false);
  });

  it('resolves slug → UUID and registers toolkit under the UUID (pass-3 review M1)', () => {
    // Pass-3 review caught: prior version passed slug `live-lesson` as
    // solutionId, but ExecutionContext.solutionId is the tenant UUID at
    // runtime, so the proxy lookup would silently miss. The registrar
    // now resolves slug → UUID via SolutionsService.findOne.
    const tools = toolkits.listToolsForSolution(FAKE_LIVE_LESSON_UUID);
    expect(tools).toHaveLength(1);
    expect(tools[0].solutionId).toBe(FAKE_LIVE_LESSON_UUID);
    expect(tools[0].qualifiedName).toBe(
      `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
    );

    // Sanity: looking up by slug returns nothing — registry IS UUID-keyed.
    expect(
      toolkits.listToolsForSolution(LIVE_LESSON_TENANT_SLUG),
    ).toHaveLength(0);
  });

  it('proxy.invoke(emit_todo_card) returns the todo card content + audits ok', async () => {
    const ctx: ExecutionContext = {
      solutionId: FAKE_LIVE_LESSON_UUID,
      sessionId: 's1',
      actingUserId: 'agent-runtime',
      actingRole: 'agent',
    };
    const result = await proxy.invoke(
      {
        tool: `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
        args: {
          title: '完成本节阅读',
          items: [
            { id: '1', label: '读 §1' },
            { id: '2', label: '回答 Q1' },
          ],
        },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = JSON.parse(result.content[0].text);
      expect(payload).toMatchObject({
        kind: 'todo',
        title: '完成本节阅读',
        items: [
          { id: '1', label: '读 §1' },
          { id: '2', label: '回答 Q1' },
        ],
      });
    }
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      tool: `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
      outcome: 'ok',
      solutionId: FAKE_LIVE_LESSON_UUID,
      sessionId: 's1',
      actingUserId: 'agent-runtime',
    });
  });

  it('proxy.invoke denies permission for role=picker (boundary check fires)', async () => {
    const ctx: ExecutionContext = {
      solutionId: FAKE_LIVE_LESSON_UUID,
      sessionId: 's1',
      actingRole: 'picker',
    };
    const result = await proxy.invoke(
      {
        tool: `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
        args: { title: 'T', items: [] },
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('permission_denied');
    }
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].outcome).toBe('permission_denied');
  });

  it('proxy.invoke validation_failed when args miss required fields (zod gate)', async () => {
    const ctx: ExecutionContext = {
      solutionId: FAKE_LIVE_LESSON_UUID,
      sessionId: 's1',
      actingRole: 'agent',
    };
    const result = await proxy.invoke(
      {
        tool: `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
        // missing title; items missing required field
        args: { items: [{ id: '1' }] },
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('validation_failed');
    }
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].outcome).toBe('validation_failed');
  });
});
