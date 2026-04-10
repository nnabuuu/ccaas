import type { HarnessTask } from '@kedge-agentic/harness';

export function getDemoTasks(): HarnessTask[] {
  return [
    // 1. Iterative doc optimization (5 rounds, scoreThreshold 85)
    {
      id: 'demo-doc-optimization',
      name: 'Document Optimization',
      mode: 'iterative',
      spec: {
        objective: 'Iteratively improve a technical document across quality dimensions',
        frozenConstraints: ['Must maintain backward compatibility', 'Keep under 5000 words'],
        artifactDescription: 'A markdown technical document',
      },
      agents: [
        { role: 'generator', sessionTemplateId: 'tpl-generator' },
        { role: 'evaluator', sessionTemplateId: 'tpl-evaluator' },
      ],
      pipeline: [
        {
          id: 'generate',
          type: 'agent' as const,
          role: 'generator',
          contextSources: [
            { type: 'spec' as const },
            { type: 'prev_output' as const, stepId: 'evaluate', outputKey: 'eval_report' },
            { type: 'progress' as const },
          ],
          requiredOutputs: [{ schemaId: 'generation-output', outputKey: 'generation' }],
        },
        {
          id: 'evaluate',
          type: 'agent' as const,
          role: 'evaluator',
          contextSources: [
            { type: 'spec' as const },
            { type: 'step_output' as const, stepId: 'generate', outputKey: 'generation' },
          ],
          requiredOutputs: [{ schemaId: 'eval-output', outputKey: 'eval_report' }],
        },
      ],
      evalCriteria: {
        dimensions: [
          { name: 'Quality', weight: 0.4, detection: 'LLM evaluation' },
          { name: 'Completeness', weight: 0.3, detection: 'Coverage check' },
          { name: 'Clarity', weight: 0.3, detection: 'Readability score' },
        ],
      },
      exitConditions: {
        maxIterations: 5,
        scoreThreshold: 85,
        minImprovement: 2,
      },
      outputSchemas: [
        {
          id: 'generation-output',
          name: 'Generation Output',
          fields: [
            { key: 'content', type: 'string', required: true, description: 'Generated content' },
            { key: 'changes', type: 'array', required: true, description: 'List of changes made' },
            { key: 'artifact', type: 'string', required: false, description: 'Full artifact text' },
          ],
        },
        {
          id: 'eval-output',
          name: 'Evaluation Report',
          fields: [
            { key: 'score', type: 'number', required: true, description: 'Overall score 0-100' },
            { key: 'totalScore', type: 'number', required: true, description: 'Total score' },
            { key: 'dimensions', type: 'array', required: true, description: 'Per-dimension scores' },
            { key: 'feedback', type: 'string', required: true, description: 'Evaluator feedback' },
            { key: 'topIssue', type: 'string', required: true, description: 'Top issue to fix' },
          ],
        },
      ],
    },

    // 2. Single analysis (maxIterations 1)
    {
      id: 'demo-single-analysis',
      name: 'Single Analysis',
      mode: 'investigation',
      spec: {
        objective: 'Perform a one-shot analysis of a given entity',
        frozenConstraints: ['Read-only analysis'],
        artifactDescription: 'An analysis report',
      },
      agents: [{ role: 'analyzer', sessionTemplateId: 'tpl-analyzer' }],
      pipeline: [
        {
          id: 'analyze',
          type: 'agent' as const,
          role: 'analyzer',
          contextSources: [{ type: 'spec' as const }],
          requiredOutputs: [{ schemaId: 'analysis-output', outputKey: 'analysis' }],
        },
      ],
      exitConditions: {
        maxIterations: 1,
      },
      outputSchemas: [
        {
          id: 'analysis-output',
          name: 'Analysis Report',
          fields: [
            { key: 'content', type: 'string', required: true, description: 'Analysis content' },
            { key: 'findings', type: 'array', required: true, description: 'Key findings' },
          ],
        },
      ],
    },

    // 3. Simulation iteration (agent + async_mcp + agent, 3 rounds)
    {
      id: 'demo-simulation-iteration',
      name: 'Simulation Iteration',
      mode: 'iterative',
      spec: {
        objective: 'Run iterative simulations with agent analysis',
        frozenConstraints: ['Simulation timeout: 30s'],
        artifactDescription: 'Simulation results and analysis',
      },
      agents: [
        { role: 'planner', sessionTemplateId: 'tpl-planner' },
        { role: 'evaluator', sessionTemplateId: 'tpl-evaluator' },
      ],
      pipeline: [
        {
          id: 'plan',
          type: 'agent' as const,
          role: 'planner',
          contextSources: [
            { type: 'spec' as const },
            { type: 'prev_output' as const, stepId: 'evaluate-sim', outputKey: 'eval_report' },
          ],
          requiredOutputs: [{ schemaId: 'plan-output', outputKey: 'plan' }],
        },
        {
          id: 'simulate',
          type: 'async_mcp' as const,
          mcpTool: 'simulator:run',
          inputSources: [
            { type: 'step_output' as const, stepId: 'plan', outputKey: 'plan' },
          ],
          scheduling: {
            pollInterval: 1000,
            timeout: 30000,
            pollMcpTool: 'simulator:status',
            completionCondition: 'status=completed',
          },
          resultOutputKey: 'sim_result',
          resultSchemaId: 'sim-output',
        },
        {
          id: 'evaluate-sim',
          type: 'agent' as const,
          role: 'evaluator',
          contextSources: [
            { type: 'spec' as const },
            { type: 'step_output' as const, stepId: 'simulate', outputKey: 'sim_result' },
          ],
          requiredOutputs: [{ schemaId: 'eval-output-sim', outputKey: 'eval_report' }],
        },
      ],
      exitConditions: {
        maxIterations: 3,
        scoreThreshold: 85,
      },
      outputSchemas: [
        {
          id: 'plan-output',
          name: 'Simulation Plan',
          fields: [
            { key: 'content', type: 'string', required: true, description: 'Plan description' },
            { key: 'parameters', type: 'object', required: false, description: 'Simulation parameters' },
          ],
        },
        {
          id: 'sim-output',
          name: 'Simulation Result',
          fields: [
            { key: 'metrics', type: 'object', required: true, description: 'Performance metrics' },
            { key: 'summary', type: 'string', required: true, description: 'Result summary' },
          ],
        },
        {
          id: 'eval-output-sim',
          name: 'Simulation Evaluation',
          fields: [
            { key: 'score', type: 'number', required: true, description: 'Overall score' },
            { key: 'totalScore', type: 'number', required: true, description: 'Total score' },
            { key: 'feedback', type: 'string', required: true, description: 'Evaluation feedback' },
            { key: 'topIssue', type: 'string', required: true, description: 'Top issue' },
          ],
        },
      ],
    },
  ];
}
