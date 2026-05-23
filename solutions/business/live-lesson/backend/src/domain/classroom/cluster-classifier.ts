import { Injectable, Logger } from '@nestjs/common';
import { AiPromptBuilder } from '../../application/ai/ai-prompt-builder';
import type { DiscussCluster, TargetPoint } from '../../schemas/manifest.schema';
import type { ClassifyResult, TargetPointHit } from '../../schemas/classroom/clustering';

@Injectable()
export class ClusterClassifier {
  private readonly logger = new Logger(ClusterClassifier.name);

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {}

  async classify(
    studentMessage: string,
    clusters: DiscussCluster[],
    conversationContext?: string,
    targetPoints?: TargetPoint[],
  ): Promise<ClassifyResult> {
    const validIds = [...clusters.map(c => c.id), 'other'];
    const validTpIds = targetPoints?.map(tp => tp.id) ?? [];

    const clusterDefs = clusters
      .map(c => `${c.id}: ${c.label}\n  ${c.description}`)
      .join('\n\n');

    const targetPointSection = targetPoints?.length
      ? `\nTARGET POINTS (内容要点):
${targetPoints.map(tp => `${tp.id}: ${tp.label}\n  ${tp.description}`).join('\n\n')}

TARGET POINT RULES:
- 一条发言可以同时命中 0 个或多个 target point（与 cluster 互斥不同）
- target_point_hits: 数组，每个元素 {"target_point_id": "...", "confidence": "high|medium|low", "evidence_span": "..."}
- 只输出有命中的 target point，未命中的不要列出
- target_point_id 必须是 [${validTpIds.join(', ')}] 之一\n`
      : '';

    const outputFormat = targetPoints?.length
      ? `{"cluster_id": "...", "confidence": "...", "evidence_span": "...", "event_type": "...", "is_highlight": false, "target_point_hits": [{"target_point_id": "tp_1_1", "confidence": "high", "evidence_span": "..."}]}`
      : `{"cluster_id": "...", "confidence": "...", "evidence_span": "...", "event_type": "...", "is_highlight": false}`;

    const systemPrompt = `你是教学观察助手。判断学生发言最匹配哪个预设类别。

CATEGORIES:
${clusterDefs}

other: 以上类别都不匹配的发言

RULES:
- cluster_id 必须是 [${validIds.join(', ')}] 之一，不允许其他值
- confidence: "high" = 明确匹配, "medium" = 可能匹配但不确定, "low" = 勉强归类
- evidence_span: 学生原话中支撑判断的片段（原文摘录，不要改写）
- event_type: "new_signal" = 学生首次表现出这种倾向, "reinforcing" = 继续表现已有倾向无新信息, "state_change" = 认知状态变化（从困惑到澄清，或从一种误解转向另一种）

HIGHLIGHT DETECTION:
- is_highlight: true 当学生的发言体现出思考质量，包括但不限于：
  - 用自己的话解释了核心概念（不是简单复述原文）
  - 举了具体例子来支撑观点
  - 引用了课文原文作为论据
  - 表达了有逻辑的个人立场或判断
  - 提出了新角度、反驳、或意外联系
  - 回答切中要害，表述清晰完整
- is_highlight: false 仅当发言属于以下情况：只有一两个词的敷衍回答、简单重复教师的话、完全离题、或只说"不知道"
- highlight_gist: 若 is_highlight 为 true，用一句中文说明该发言的亮点
${targetPointSection}
输出格式（纯 JSON）:
${outputFormat}
或
{"cluster_id": "other", "confidence": "low", "evidence_span": "...", "event_type": "new_signal", "is_highlight": true, "highlight_gist": "学生自发引入日本审美案例，扩展了课文的跨文化视角"}

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}` : ''}`;

    const raw = await this.aiPromptBuilder.callLlm(systemPrompt, studentMessage, {
      responseFormat: { type: 'json_object' },
      maxTokens: targetPoints?.length ? 300 : 200,
      temperature: 0,
    });

    return this.parseResult(raw, validIds, validTpIds);
  }

  private parseResult(raw: string, validIds: string[], validTpIds: string[] = []): ClassifyResult {
    let parsed: {
      cluster_id?: string; confidence?: string; evidence_span?: string;
      event_type?: string; is_highlight?: boolean; highlight_gist?: string;
      target_point_hits?: Array<{ target_point_id: string; confidence: string; evidence_span?: string }>;
    };
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
    } catch {
      this.logger.warn(`Cluster classify JSON parse failed: ${raw.slice(0, 200)}`);
      return { clusterId: 'other', confidence: 'low', evidenceSpan: '', eventType: 'new_signal', isHighlight: false, targetPointHits: [] };
    }

    const clusterId = validIds.includes(parsed.cluster_id) ? parsed.cluster_id : 'other';
    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence)
      ? (parsed.confidence as ClassifyResult['confidence'])
      : 'low';
    const evidenceSpan = typeof parsed.evidence_span === 'string' ? parsed.evidence_span : '';
    const eventType = ['new_signal', 'reinforcing', 'state_change'].includes(parsed.event_type)
      ? (parsed.event_type as ClassifyResult['eventType'])
      : 'new_signal';

    const isHighlight = parsed.is_highlight === true;
    const highlightGist = isHighlight && typeof parsed.highlight_gist === 'string'
      ? parsed.highlight_gist
      : undefined;

    const targetPointHits: TargetPointHit[] = [];
    if (Array.isArray(parsed.target_point_hits)) {
      for (const hit of parsed.target_point_hits) {
        if (
          validTpIds.includes(hit.target_point_id) &&
          ['high', 'medium', 'low'].includes(hit.confidence)
        ) {
          targetPointHits.push({
            targetPointId: hit.target_point_id,
            confidence: hit.confidence as 'high' | 'medium' | 'low',
            evidenceSpan: typeof hit.evidence_span === 'string' ? hit.evidence_span : '',
          });
        }
      }
    }

    return { clusterId, confidence, evidenceSpan, eventType, isHighlight, highlightGist, targetPointHits };
  }
}
