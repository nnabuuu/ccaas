import type { HarnessTask } from '@kedge-agentic/harness';

export function getArticleTask(): HarnessTask {
  return {
    id: 'article-logic-improvement',
    name: 'Article Logic Improvement',
    mode: 'iterative',
    spec: {
      objective:
        'Iteratively improve article quality through writing and analysis cycles',
      frozenConstraints: [
        'Must preserve original thesis/topic direction',
        'Word count should stay within 20% of target',
        'Must maintain academic/professional tone',
      ],
      artifactDescription:
        'A polished article with clear thesis, strong evidence, and logical flow',
    },
    agents: [
      { role: 'writer', sessionTemplateId: 'article-writer' },
      { role: 'analyzer', sessionTemplateId: 'article-analyzer' },
    ],
    pipeline: [
      {
        id: 'write',
        type: 'agent',
        role: 'writer',
        contextSources: [
          { type: 'spec' },
          {
            type: 'prev_output',
            stepId: 'analyze',
            outputKey: 'analysis_report',
          },
          { type: 'progress' },
          { type: 'latest_artifact' },
        ],
        requiredOutputs: [
          { schemaId: 'article-draft-output', outputKey: 'draft' },
        ],
      },
      {
        id: 'analyze',
        type: 'agent',
        role: 'analyzer',
        contextSources: [
          { type: 'spec' },
          { type: 'step_output', stepId: 'write', outputKey: 'draft' },
        ],
        requiredOutputs: [
          {
            schemaId: 'analysis-report-output',
            outputKey: 'analysis_report',
          },
        ],
      },
    ],
    exitConditions: {
      maxIterations: 10,
      scoreThreshold: 85,
      minImprovement: 2,
    },
    outputSchemas: [
      {
        id: 'article-draft-output',
        name: 'Article Draft',
        fields: [
          {
            key: 'content',
            type: 'string',
            required: true,
            description: 'The article text',
          },
          {
            key: 'changes',
            type: 'array',
            required: false,
            description: 'List of changes made',
          },
          {
            key: 'wordCount',
            type: 'number',
            required: false,
            description: 'Word count',
          },
        ],
      },
      {
        id: 'analysis-report-output',
        name: 'Analysis Report',
        fields: [
          {
            key: 'score',
            type: 'number',
            required: true,
            description: 'Overall score 0-100',
          },
          {
            key: 'totalScore',
            type: 'number',
            required: true,
            description: 'Alias for score',
          },
          {
            key: 'dimensions',
            type: 'array',
            required: true,
            description: 'Per-dimension scores',
          },
          {
            key: 'feedback',
            type: 'string',
            required: true,
            description: 'Detailed feedback',
          },
          {
            key: 'topIssue',
            type: 'string',
            required: true,
            description: 'Most critical issue',
          },
        ],
      },
    ],
  };
}
