/* eslint-disable @typescript-eslint/no-explicit-any */
import { AiPromptBuilder, type PromptTracer } from '../ai/ai-prompt-builder';

describe('AiPromptBuilder.setTracer (§14 L1+L2)', () => {
  let builder: AiPromptBuilder;
  const mockConfig = { get: () => null } as any;

  beforeEach(() => {
    builder = new AiPromptBuilder(mockConfig);
  });

  it('records start + end events on callLlm', async () => {
    const events: Array<{ phase: 'start' | 'end'; payload: any }> = [];
    const tracer: PromptTracer = {
      recordStart: (callId, payload) => events.push({ phase: 'start', payload: { callId, ...payload } }),
      recordEnd: (callId, payload) => events.push({ phase: 'end', payload: { callId, ...payload } }),
    };
    builder.setTracer(tracer);

    // Stub the actual LLM call to avoid network. callOpenAiCompatible is private,
    // so we monkey-patch via prototype access.
    const proto = AiPromptBuilder.prototype as any;
    const orig = proto.callOpenAiCompatible;
    const origCfg = proto.getTextLlmConfig;
    proto.callOpenAiCompatible = async () => 'mock-response';
    proto.getTextLlmConfig = () => ({ apiKey: 'x', baseUrl: 'http://x', model: 'm' });

    try {
      const res = await builder.callLlm('sys', 'usr');
      expect(res).toBe('mock-response');
      expect(events).toHaveLength(2);
      expect(events[0].phase).toBe('start');
      expect(events[0].payload.systemPrompt).toBe('sys');
      expect(events[1].phase).toBe('end');
      expect(events[1].payload.response).toBe('mock-response');
      expect(events[1].payload.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      proto.callOpenAiCompatible = orig;
      proto.getTextLlmConfig = origCfg;
    }
  });

  it('lookupReplay short-circuits the real call', async () => {
    const proto = AiPromptBuilder.prototype as any;
    const orig = proto.callOpenAiCompatible;
    const origCfg = proto.getTextLlmConfig;
    let realCallCount = 0;
    proto.callOpenAiCompatible = async () => {
      realCallCount++;
      return 'real-response';
    };
    proto.getTextLlmConfig = () => ({ apiKey: 'x', baseUrl: 'http://x', model: 'm' });

    const tracer: PromptTracer = {
      recordStart: () => undefined,
      recordEnd: () => undefined,
      lookupReplay: () => 'replayed-response',
    };
    builder.setTracer(tracer);

    try {
      const res = await builder.callLlm('s', 'u');
      expect(res).toBe('replayed-response');
      expect(realCallCount).toBe(0);
    } finally {
      proto.callOpenAiCompatible = orig;
      proto.getTextLlmConfig = origCfg;
    }
  });

  it('runWithTracer isolates concurrent requests — each tracer only sees its own events', async () => {
    const proto = AiPromptBuilder.prototype as any;
    const orig = proto.callOpenAiCompatible;
    const origCfg = proto.getTextLlmConfig;
    let inflight = 0;
    proto.callOpenAiCompatible = async (args: { messages: Array<{ content: string }> }) => {
      // Interleave: hold each call until both are inflight, then resolve based on user message.
      inflight++;
      await new Promise((r) => setTimeout(r, inflight === 1 ? 20 : 0));
      return `resp-for-${args.messages[1].content}`;
    };
    proto.getTextLlmConfig = () => ({ apiKey: 'x', baseUrl: 'http://x', model: 'm' });

    const aEvents: any[] = [];
    const bEvents: any[] = [];
    const tracerA: PromptTracer = {
      recordStart: (_id, p) => aEvents.push({ phase: 'start', user: p.userMessage }),
      recordEnd: (_id, p) => aEvents.push({ phase: 'end', response: p.response }),
    };
    const tracerB: PromptTracer = {
      recordStart: (_id, p) => bEvents.push({ phase: 'start', user: p.userMessage }),
      recordEnd: (_id, p) => bEvents.push({ phase: 'end', response: p.response }),
    };

    try {
      await Promise.all([
        builder.runWithTracer(tracerA, () => builder.callLlm('s', 'A')),
        builder.runWithTracer(tracerB, () => builder.callLlm('s', 'B')),
      ]);
      expect(aEvents.map((e) => e.user ?? e.response)).toEqual(['A', 'resp-for-A']);
      expect(bEvents.map((e) => e.user ?? e.response)).toEqual(['B', 'resp-for-B']);
    } finally {
      proto.callOpenAiCompatible = orig;
      proto.getTextLlmConfig = origCfg;
    }
  });

  it('setTracer(null) disables tracing', async () => {
    const tracer: PromptTracer = {
      recordStart: jest.fn(),
      recordEnd: jest.fn(),
    };
    builder.setTracer(tracer);
    builder.setTracer(null);

    const proto = AiPromptBuilder.prototype as any;
    const orig = proto.callOpenAiCompatible;
    const origCfg = proto.getTextLlmConfig;
    proto.callOpenAiCompatible = async () => 'r';
    proto.getTextLlmConfig = () => ({ apiKey: 'x', baseUrl: 'http://x', model: 'm' });
    try {
      await builder.callLlm('s', 'u');
      expect(tracer.recordStart).not.toHaveBeenCalled();
      expect(tracer.recordEnd).not.toHaveBeenCalled();
    } finally {
      proto.callOpenAiCompatible = orig;
      proto.getTextLlmConfig = origCfg;
    }
  });
});
