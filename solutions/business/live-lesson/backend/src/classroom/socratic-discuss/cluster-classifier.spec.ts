import { ClusterClassifier } from '../../domain/classroom/cluster-classifier';
import { AiPromptBuilder } from '../ai-prompt-builder';
import type { ClassifyResult } from '../../schemas/classroom/clustering';
import type { DiscussCluster } from '../../schemas/manifest.schema';

function makeMockAi(response: string) {
  return { callLlm: jest.fn().mockResolvedValue(response) } as unknown as AiPromptBuilder;
}

const CLUSTERS: DiscussCluster[] = [
  { id: 'beauty-form', label: '形式之美', description: '关注外在形式、结构、对称等' },
  { id: 'beauty-inner', label: '内在之美', description: '关注品格、精神、内在价值' },
];

describe('ClusterClassifier', () => {
  // ── Valid classification ──

  it('returns ClassifyResult with correct fields for high confidence', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'high',
      evidence_span: '对称的建筑',
      event_type: 'new_signal',
      is_highlight: false,
    }));
    const classifier = new ClusterClassifier(ai);
    const result: ClassifyResult = await classifier.classify('对称的建筑很好看', CLUSTERS);

    expect(result).toEqual({
      clusterId: 'beauty-form',
      confidence: 'high',
      evidenceSpan: '对称的建筑',
      eventType: 'new_signal',
      isHighlight: false,
      highlightGist: undefined,
      targetPointHits: [],
    });
  });

  it('returns highlight with gist when is_highlight is true', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'other',
      confidence: 'low',
      evidence_span: '日本庭园',
      event_type: 'new_signal',
      is_highlight: true,
      highlight_gist: '学生引入了日本审美案例',
    }));
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('我觉得日本庭园也很美', CLUSTERS);

    expect(result.isHighlight).toBe(true);
    expect(result.highlightGist).toBe('学生引入了日本审美案例');
  });

  // ── Fallback parsing ──

  it('falls back to "other" for unknown cluster_id', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'nonexistent',
      confidence: 'high',
      evidence_span: 'x',
      event_type: 'new_signal',
      is_highlight: false,
    }));
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('test', CLUSTERS);
    expect(result.clusterId).toBe('other');
  });

  it('falls back to "low" for unknown confidence', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'ULTRA',
      evidence_span: 'x',
      event_type: 'new_signal',
      is_highlight: false,
    }));
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('test', CLUSTERS);
    expect(result.confidence).toBe('low');
  });

  it('falls back to "new_signal" for unknown event_type', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'high',
      evidence_span: 'x',
      event_type: 'UNKNOWN',
      is_highlight: false,
    }));
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('test', CLUSTERS);
    expect(result.eventType).toBe('new_signal');
  });

  // ── Invalid JSON ──

  it('returns safe fallback when LLM returns invalid JSON', async () => {
    const ai = makeMockAi('this is not json');
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('test', CLUSTERS);
    expect(result).toEqual({
      clusterId: 'other',
      confidence: 'low',
      evidenceSpan: '',
      eventType: 'new_signal',
      isHighlight: false,
      targetPointHits: [],
    });
  });

  // ── Markdown-wrapped JSON ──

  it('strips markdown code fence from LLM response', async () => {
    const ai = makeMockAi('```json\n{"cluster_id":"beauty-inner","confidence":"medium","evidence_span":"品格","event_type":"reinforcing","is_highlight":false}\n```');
    const classifier = new ClusterClassifier(ai);
    const result = await classifier.classify('品格很重要', CLUSTERS);
    expect(result.clusterId).toBe('beauty-inner');
    expect(result.confidence).toBe('medium');
    expect(result.evidenceSpan).toBe('品格');
    expect(result.eventType).toBe('reinforcing');
  });

  // ── targetPoints parsing ──

  it('parses target_point_hits from LLM response', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'high',
      evidence_span: '两个相反的例子',
      event_type: 'new_signal',
      is_highlight: false,
      target_point_hits: [
        { target_point_id: 'tp_1_1', confidence: 'high', evidence_span: '两个相反' },
        { target_point_id: 'tp_1_2', confidence: 'medium', evidence_span: '哪种审美' },
      ],
    }));
    const classifier = new ClusterClassifier(ai);
    const tps = [
      { id: 'tp_1_1', label: '识别冲突', description: 'desc1' },
      { id: 'tp_1_2', label: '核心问题', description: 'desc2' },
    ];
    const result = await classifier.classify('两个相反的例子', CLUSTERS, undefined, tps);
    expect(result.targetPointHits).toHaveLength(2);
    expect(result.targetPointHits[0]).toEqual({
      targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: '两个相反',
    });
  });

  it('filters out invalid targetPointIds', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'high',
      evidence_span: 'x',
      event_type: 'new_signal',
      is_highlight: false,
      target_point_hits: [
        { target_point_id: 'tp_999', confidence: 'high', evidence_span: 'x' },
      ],
    }));
    const classifier = new ClusterClassifier(ai);
    const tps = [{ id: 'tp_1_1', label: 'Valid', description: 'desc' }];
    const result = await classifier.classify('test', CLUSTERS, undefined, tps);
    expect(result.targetPointHits).toHaveLength(0);
  });

  // ── conversationContext passed through ──

  it('includes conversationContext in the prompt', async () => {
    const ai = makeMockAi(JSON.stringify({
      cluster_id: 'beauty-form',
      confidence: 'high',
      evidence_span: 'x',
      event_type: 'new_signal',
      is_highlight: false,
    }));
    const classifier = new ClusterClassifier(ai);
    await classifier.classify('test', CLUSTERS, 'previous conversation here');

    const systemPrompt = (ai.callLlm as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toContain('previous conversation here');
  });
});
