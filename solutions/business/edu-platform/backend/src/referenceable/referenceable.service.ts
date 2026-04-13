import { Injectable } from '@nestjs/common';
import { LessonPlanProvider } from './providers/lesson-plan.provider';
import { TemplateProvider } from './providers/template.provider';
import { RequirementProvider } from './providers/requirement.provider';

@Injectable()
export class ReferenceableService {
  constructor(
    readonly lessonPlanProvider: LessonPlanProvider,
    readonly templateProvider: TemplateProvider,
    readonly requirementProvider: RequirementProvider,
  ) {}
}
