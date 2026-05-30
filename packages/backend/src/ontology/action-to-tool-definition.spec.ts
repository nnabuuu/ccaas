/**
 * Bridge tests.
 *
 * Unit-level: the produced ToolDefinition's fields match the ActionDef,
 * and the wrapped handler invokes `checkBoundary` (allow / deny paths,
 * including unmetPreconditions surfacing).
 *
 * Integration-level: when the produced ToolDefinition is registered
 * through `SolutionToolkitRegistry` and invoked via
 * `ToolCallerProxyService`, the audit sink records an entry for both
 * allow and permission_denied paths (criterion 2: boundary AND audit).
 */

import { z } from 'zod';
import {
  defineAction,
  defineManifest,
  defineStateField,
  type ActionDef,
  type ManifestDef,
} from '@kedge-agentic/ontology';
import type { ToolInvocation as ProxyInvocation } from '../tool-caller/types';
import {
  ToolCallerProxyService,
  type ToolCallAuditSink,
} from '../tool-caller/tool-caller-proxy.service';
import { SolutionToolkitRegistry } from '../tool-caller/solution-toolkit-registry';
import type { ToolCallAuditEntry } from '../tool-caller/types';
import { compileActionToToolDefinition } from './action-to-tool-definition';

const EMIT_CARD_FIXTURE: ActionDef = defineAction({
  apiName: 'emit_todo_card',
  displayName: 'Emit Todo Card',
  semantic: '弹出 todo card 给学生',
  params: z.object({
    title: z.string(),
    items: z.array(z.object({ id: z.string(), label: z.string() })),
  }),
  sideEffects: ['emits:TodoCard'],
  allowedRoles: ['agent'],
  auditLevel: 'log',
});

function manifestWith(opts: {
  agentActions?: readonly string[];
  agentReadable?: readonly string[];
  agentWritable?: readonly string[];
}): ManifestDef {
  return defineManifest({
    name: 'TestLessonSession',
    displayName: 'Test Lesson Session',
    schemaVersion: '0.1.0',
    semantic: 'test manifest',
    slots: [],
    state: [
      defineStateField({
        apiName: 'phase',
        displayName: 'Phase',
        schema: z.enum(['waiting', 'active', 'ended']),
        initial: 'waiting',
        semantic: 'lesson phase',
      }),
    ],
    boundaries: [
      {
        role: 'agent',
        readable: opts.agentReadable ?? [],
        writable: opts.agentWritable ?? [],
        actions: opts.agentActions ?? [],
      },
    ],
  });
}

describe('compileActionToToolDefinition (unit)', () => {
  it('copies ActionDef fields into the ToolDefinition shape', () => {
    const handler = jest.fn();
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      handler,
      manifestWith({ agentActions: ['emit_todo_card'] }),
    );
    expect(td.name).toBe('emit_todo_card');
    expect(td.description).toBe(EMIT_CARD_FIXTURE.semantic);
    expect(td.argsSchema).toBe(EMIT_CARD_FIXTURE.params);
    expect(td.visibility?.roles).toEqual(['agent']);
    expect(td.requiredPermissions).toEqual([]);
  });

  it('allows when role boundary covers the action and calls the wrapped handler', async () => {
    const inner = jest.fn().mockResolvedValue({
      ok: true,
      content: [{ type: 'text', text: 'ok' }],
    });
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      inner,
      manifestWith({ agentActions: ['emit_todo_card'] }),
    );
    const invocation: ProxyInvocation = {
      tool: 'creator.emit_todo_card',
      args: { title: 'T', items: [] },
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'agent' },
    };
    const result = await td.handler(invocation);
    expect(result.ok).toBe(true);
    expect(inner).toHaveBeenCalledWith(invocation);
  });

  it('denies when the role boundary does NOT cover the action; inner handler not called', async () => {
    const inner = jest.fn();
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      inner,
      manifestWith({ agentActions: [] }),
    );
    const result = await td.handler({
      tool: 'creator.emit_todo_card',
      args: { title: 'T', items: [] },
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'agent' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('permission_denied');
      expect(result.reason).toMatch(/AccessBoundary.actions/);
    }
    expect(inner).not.toHaveBeenCalled();
  });

  it('denies when actingRole is not in ActionDef.allowedRoles', async () => {
    const inner = jest.fn();
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      inner,
      defineManifest({
        name: 'M',
        displayName: 'M',
        schemaVersion: '0.1.0',
        semantic: 'm',
        slots: [],
        state: [],
        boundaries: [
          { role: 'picker', readable: [], writable: [], actions: ['emit_todo_card'] },
        ],
      }),
    );
    const result = await td.handler({
      tool: 'creator.emit_todo_card',
      args: { title: 'T', items: [] },
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'picker' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('permission_denied');
      expect(result.reason).toMatch(/ActionDef\.allowedRoles/);
    }
    expect(inner).not.toHaveBeenCalled();
  });

  it('surfaces unmetPreconditions on the failure result', async () => {
    const actionWithPrecondition = defineAction({
      apiName: 'flag_intervention',
      displayName: 'Flag',
      semantic: 'flag',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      preconditions: [{ kind: 'stateEquals', path: 'phase', value: 'active' }],
    });
    const td = compileActionToToolDefinition(
      actionWithPrecondition,
      jest.fn(),
      defineManifest({
        name: 'M',
        displayName: 'M',
        schemaVersion: '0.1.0',
        semantic: 'm',
        slots: [],
        state: [],
        boundaries: [
          {
            role: 'agent',
            readable: [],
            writable: [],
            actions: ['flag_intervention'],
          },
        ],
      }),
    );
    const result = await td.handler({
      tool: 'creator.flag_intervention',
      args: {},
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'agent' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('permission_denied');
      // state is absent in this test, so stateEquals fails fail-safe.
      expect(result.unmetPreconditions?.length).toBe(1);
      expect(result.unmetPreconditions?.[0]).toEqual({
        kind: 'stateEquals',
        path: 'phase',
        value: 'active',
      });
    }
  });

  it('allows when stateEquals precondition is satisfied via resolveState (M2 coverage)', async () => {
    const actionWithPrecondition = defineAction({
      apiName: 'flag_intervention',
      displayName: 'Flag',
      semantic: 'flag',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      preconditions: [{ kind: 'stateEquals', path: 'phase', value: 'active' }],
    });
    const inner = jest.fn().mockResolvedValue({
      ok: true,
      content: [{ type: 'text', text: 'ok' }],
    });
    const td = compileActionToToolDefinition(
      actionWithPrecondition,
      inner,
      defineManifest({
        name: 'M',
        displayName: 'M',
        schemaVersion: '0.1.0',
        semantic: 'm',
        slots: [],
        state: [],
        boundaries: [
          {
            role: 'agent',
            readable: [],
            writable: [],
            actions: ['flag_intervention'],
          },
        ],
      }),
      { resolveState: () => ({ phase: 'active' }) },
    );
    const result = await td.handler({
      tool: 'creator.flag_intervention',
      args: {},
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'agent' },
    });
    expect(result.ok).toBe(true);
    expect(inner).toHaveBeenCalled();
  });

  it('coerces an unrecognized claimed role back to the defaultRole (M3 defense in depth)', async () => {
    const inner = jest.fn().mockResolvedValue({
      ok: true,
      content: [{ type: 'text', text: 'ok' }],
    });
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      inner,
      manifestWith({ agentActions: ['emit_todo_card'] }),
    );
    const result = await td.handler({
      tool: 'creator.emit_todo_card',
      args: { title: 'T', items: [] },
      // bogus role — bridge should treat as undefined and fall back to defaultRole='agent'
      context: { solutionId: 'live-lesson', sessionId: 's1', actingRole: 'root' as any },
    });
    // With defaultRole='agent', the allow rule for emit_todo_card is satisfied,
    // so the inner handler runs. Proves the bogus role wasn't honored.
    expect(result.ok).toBe(true);
    expect(inner).toHaveBeenCalled();
  });

  it('defaults role to "agent" when context.actingRole is absent', async () => {
    const inner = jest.fn().mockResolvedValue({
      ok: true,
      content: [{ type: 'text', text: 'ok' }],
    });
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      inner,
      manifestWith({ agentActions: ['emit_todo_card'] }),
    );
    const result = await td.handler({
      tool: 'creator.emit_todo_card',
      args: { title: 'T', items: [] },
      context: { solutionId: 'live-lesson', sessionId: 's1' },
    });
    expect(result.ok).toBe(true);
    expect(inner).toHaveBeenCalled();
  });
});

describe('compileActionToToolDefinition (proxy integration)', () => {
  let registry: SolutionToolkitRegistry;
  let proxy: ToolCallerProxyService;
  let auditEntries: ToolCallAuditEntry[];

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
    proxy = new ToolCallerProxyService(registry);
    auditEntries = [];
    const sink: ToolCallAuditSink = {
      record: (entry) => {
        auditEntries.push(entry);
      },
    };
    proxy.setAuditSink(sink);
  });

  it('audit row written with outcome=ok when ActionDef path allows', async () => {
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      async () => ({ ok: true, content: [{ type: 'text', text: 'ok' }] }),
      manifestWith({ agentActions: ['emit_todo_card'] }),
    );
    registry.registerToolkit({
      solutionId: 'live-lesson',
      namespace: 'creator',
      tools: [td],
    });
    const result = await proxy.invoke(
      { tool: 'creator.emit_todo_card', args: { title: 'T', items: [] } },
      {
        solutionId: 'live-lesson',
        sessionId: 's1',
        actingUserId: 'u1',
        actingRole: 'agent',
      },
    );
    expect(result.ok).toBe(true);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      tool: 'creator.emit_todo_card',
      outcome: 'ok',
      solutionId: 'live-lesson',
      sessionId: 's1',
      actingUserId: 'u1',
    });
  });

  it('audit row written with outcome=permission_denied when ActionDef path denies', async () => {
    const td = compileActionToToolDefinition(
      EMIT_CARD_FIXTURE,
      async () => ({ ok: true, content: [{ type: 'text', text: 'ok' }] }),
      manifestWith({ agentActions: [] }),
    );
    registry.registerToolkit({
      solutionId: 'live-lesson',
      namespace: 'creator',
      tools: [td],
    });
    const result = await proxy.invoke(
      { tool: 'creator.emit_todo_card', args: { title: 'T', items: [] } },
      {
        solutionId: 'live-lesson',
        sessionId: 's1',
        actingRole: 'agent',
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('permission_denied');
    }
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      outcome: 'permission_denied',
      tool: 'creator.emit_todo_card',
    });
  });
});
