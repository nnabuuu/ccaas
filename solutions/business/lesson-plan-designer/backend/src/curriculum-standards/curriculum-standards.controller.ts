import { Controller, Get, Query } from '@nestjs/common';
import { CurriculumStandardsService } from './curriculum-standards.service';

@Controller('curriculum-standards')
export class CurriculumStandardsController {
  constructor(
    private readonly curriculumStandardsService: CurriculumStandardsService,
  ) {}

  /**
   * GET /api/curriculum-standards/subjects
   * Get all available subjects
   * @returns string[] - e.g., ["数学", "物理", "化学"]
   */
  @Get('subjects')
  getSubjects(): string[] {
    return this.curriculumStandardsService.getSubjects();
  }

  /**
   * GET /api/curriculum-standards/stages?subject=数学
   * Get all available stages for a subject
   * @returns string[] - e.g., ["义务教育阶段第一学段", "义务教育阶段第二学段", ...]
   */
  @Get('stages')
  getStages(@Query('subject') subject: string): string[] {
    return this.curriculumStandardsService.getStages(subject);
  }

  /**
   * GET /api/curriculum-standards?subject=数学&stage=义务教育阶段第二学段
   * Get curriculum standards with optional filtering
   *
   * Query params:
   * - subject: required - e.g., "数学"
   * - stage: optional - e.g., "义务教育阶段第二学段"
   * - standardType: optional - e.g., "内容要求" or "学业要求"
   * - contentDomain: optional - e.g., "数与代数"
   * - keyword: optional - search in title
   *
   * @returns { subject: string, count: number, standards: CurriculumStandard[] }
   */
  @Get()
  getStandards(
    @Query('subject') subject: string,
    @Query('stage') stage?: string,
    @Query('standardType') standardType?: string,
    @Query('contentDomain') contentDomain?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.curriculumStandardsService.getStandards(
      subject,
      stage,
      standardType,
      contentDomain,
      keyword,
    );
  }
}
