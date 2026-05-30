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
  LIVE_LESSON_SOLUTION_ID,
} from './live-lesson-ontology.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../ontology-registry.provider';
import { SolutionToolkitRegistry } from '../../tool-caller/solution-toolkit-registry';
import {
  ToolCallerProxyService,
  type ToolCallAuditSink,
} from '../../tool-caller/tool-caller-proxy.service';
import type {
  ExecutionContext,
  ToolCallAuditEntry,
} from '../../tool-caller/types';

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
    await module.get(LiveLessonOntologyService).onModuleInit();
  });

  it('registers 4 object types + LessonSession manifest + seals', () => {
    expect(registry.getAllObjectTypes().map((t) => t.apiName).sort()).toEqual([
      'ClassroomSession',
      'Lesson',
      'Resource',
      'Student',
    ]);
    expect(registry.getManifest('LessonSession')).toBeDefined();
    expect(registry.isSealed()).toBe(true);
  });

  it('registers emit_todo_card under namespace "creator-actions"', () => {
    const tools = toolkits.listToolsForSolution(LIVE_LESSON_SOLUTION_ID);
    expect(tools).toHaveLength(1);
    expect(tools[0].qualifiedName).toBe(
      `${LIVE_LESSON_ACTION_NAMESPACE}.emit_todo_card`,
    );
  });

  it('proxy.invoke(emit_todo_card) returns the todo card content + audits ok', async () => {
    const ctx: ExecutionContext = {
      solutionId: LIVE_LESSON_SOLUTION_ID,
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
      solutionId: LIVE_LESSON_SOLUTION_ID,
      sessionId: 's1',
      actingUserId: 'agent-runtime',
    });
  });

  it('proxy.invoke denies permission for role=picker (boundary check fires)', async () => {
    const ctx: ExecutionContext = {
      solutionId: LIVE_LESSON_SOLUTION_ID,
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
      solutionId: LIVE_LESSON_SOLUTION_ID,
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
