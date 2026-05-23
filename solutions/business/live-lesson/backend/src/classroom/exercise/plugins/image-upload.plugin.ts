import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
} from '../exercise-type-plugin.interface';
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { AiPromptBuilder } from '../../ai-prompt-builder';
import { ImageUploadGrader } from '../graders/image-upload.grader';

const PromptImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
});

const RubricItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  criteria: z.string().min(1),
});

const ImageUploadAnswerKeySchema = z.object({
  type: z.literal('image-upload'),
  prompt: z.string().min(1),
  promptImages: z.array(PromptImageSchema).optional(),
  rubric: z.array(RubricItemSchema).nonempty(),
  sampleSolution: z.string().optional(),
  aiSystemPrompt: z.string().optional(),
  maxImages: z.number().int().min(1).optional(),
  accepts: z.array(z.string()).optional(),
});

@Injectable()
@ExerciseType('image-upload')
export class ImageUploadPlugin implements ExerciseTypePlugin {
  readonly type = 'image-upload';
  readonly answerKeySchema = ImageUploadAnswerKeySchema;
  private readonly legacyGrader: ImageUploadGrader;

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
    this.legacyGrader = new ImageUploadGrader(aiPromptBuilder);
  }

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const rubric = (ak.rubric as Array<Record<string, unknown>>) || [];
    return {
      type: 'image-upload',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      prompt: ak.prompt as string,
      ...(ak.promptImages && {
        promptImages: ak.promptImages as Array<{ url: string; alt?: string }>,
      }),
      rubric: rubric.map((r) => ({
        id: r.id as string,
        label: r.label as string,
        weight: r.weight as number,
      })),
      ...(ak.maxImages && { maxImages: ak.maxImages as number }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): Promise<GradeResult> {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    // image-upload: one item per rubric criterion
    const rubric = (ctx.key.rubric as Array<Record<string, unknown>>) || [];
    return rubric.map((r) => {
      const id = r.id as string;
      const score = ctx.gradeResult.byDimension?.[id];
      const correct = score === true || (typeof score === 'number' && score >= 80);
      return { idx: id, correct };
    });
  }
}
