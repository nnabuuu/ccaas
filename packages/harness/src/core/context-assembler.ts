import type {
  HarnessRun,
  HarnessTask,
  PipelineStep,
  ContextSource,
  RunStore,
} from './interfaces.js';

export async function assembleContext(
  run: HarnessRun,
  task: HarnessTask,
  iteration: number,
  step: PipelineStep,
  store: RunStore,
): Promise<string> {
  const sources: ContextSource[] =
    step.type === 'agent' ? step.contextSources : step.inputSources;

  const sections: string[] = [];

  for (const source of sources) {
    switch (source.type) {
      case 'spec': {
        sections.push(
          `## Task Specification\n` +
            `**Objective:** ${task.spec.objective}\n` +
            `**Constraints:** ${task.spec.frozenConstraints.join(', ')}\n` +
            `**Artifact:** ${task.spec.artifactDescription}`,
        );
        break;
      }

      case 'prev_output': {
        if (iteration > 1) {
          const data = await store.getStepOutput(
            run.id,
            iteration - 1,
            source.stepId,
            source.outputKey,
          );
          if (data != null) {
            sections.push(
              `## Previous Output (${source.stepId}.${source.outputKey})\n${JSON.stringify(data, null, 2)}`,
            );
          }
        }
        break;
      }

      case 'progress': {
        const completedIterations = run.iterations.filter(
          (i) => i.status === 'completed',
        );
        if (completedIterations.length > 0) {
          const scores = completedIterations
            .map((i) => `  Iteration ${i.iteration}: score=${i.score ?? 'N/A'}, changes=${i.keyChanges}`)
            .join('\n');
          sections.push(`## Progress History\n${scores}`);
        }
        break;
      }

      case 'latest_artifact': {
        const artifact = await store.getLatestArtifact(run.id);
        if (artifact != null) {
          sections.push(
            `## Latest Artifact\n${JSON.stringify(artifact, null, 2)}`,
          );
        }
        break;
      }

      case 'entity_ref': {
        sections.push(
          `## Entity Reference\nType: ${source.entityType}, ID: ${source.entityId}`,
        );
        break;
      }

      case 'step_output': {
        const data = await store.getStepOutput(
          run.id,
          iteration,
          source.stepId,
          source.outputKey,
        );
        if (data != null) {
          sections.push(
            `## Step Output (${source.stepId}.${source.outputKey})\n${JSON.stringify(data, null, 2)}`,
          );
        }
        break;
      }
    }
  }

  return sections.join('\n\n');
}
