import { Module, OnModuleInit } from '@nestjs/common';
import { EntityRegistry } from '@kedge-agentic/context-layer/core';
import { LessonPlanModule } from '../lesson-plan/lesson-plan.module';
import { TemplateModule } from '../template/template.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { LessonPlanService } from '../lesson-plan/lesson-plan.service';
import { TemplateService } from '../template/template.service';
import { CurriculumService } from '../curriculum/curriculum.service';
import { LessonPlanProvider } from './providers/lesson-plan.provider';
import { TemplateProvider } from './providers/template.provider';
import { RequirementProvider } from './providers/requirement.provider';
import { ReferenceableService } from './referenceable.service';
import { ContextLayerLocalModule } from './context-layer-local.module';
import { eduBrowseProvider } from './adapters/edu-browse-provider-instance';

@Module({
  imports: [LessonPlanModule, TemplateModule, CurriculumModule, ContextLayerLocalModule],
  providers: [
    LessonPlanProvider,
    TemplateProvider,
    RequirementProvider,
    ReferenceableService,
  ],
  exports: [ReferenceableService],
})
export class ReferenceableModule implements OnModuleInit {
  constructor(
    private registry: EntityRegistry,
    private lessonPlanProvider: LessonPlanProvider,
    private templateProvider: TemplateProvider,
    private requirementProvider: RequirementProvider,
    private lessonPlanService: LessonPlanService,
    private templateService: TemplateService,
    private curriculumService: CurriculumService,
  ) {}

  onModuleInit(): void {
    // Register entity type metadata (displayName, icon, color)
    this.registry.register({
      type: 'lesson_plan',
      displayName: '教案',
      icon: '📋',
      color: 'purple',
      abilities: { search: true, browse: true, resolve: true, track: true },
    });
    this.registry.register({
      type: 'template',
      displayName: '模板',
      icon: '📄',
      color: 'blue',
      abilities: { search: true, browse: true, resolve: true },
    });
    this.registry.register({
      type: 'requirement',
      displayName: '课标要求',
      icon: '📚',
      color: 'green',
      abilities: { search: true, browse: true, resolve: true },
    });

    // Register EntityContext providers
    this.registry.registerProvider('lesson_plan', this.lessonPlanProvider);
    this.registry.registerProvider('template', this.templateProvider);
    this.registry.registerProvider('requirement', this.requirementProvider);

    // Wire up browse provider with NestJS-managed services
    eduBrowseProvider.setServices(
      this.lessonPlanService,
      this.templateService,
      this.curriculumService,
    );
  }
}
