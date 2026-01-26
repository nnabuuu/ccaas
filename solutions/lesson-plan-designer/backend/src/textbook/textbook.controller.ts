import { Controller, Get, Query } from '@nestjs/common';
import { TextbookService } from './textbook.service';

@Controller('textbook')
export class TextbookController {
  constructor(private readonly textbookService: TextbookService) {}

  /**
   * GET /api/textbook/subjects
   * Get all available subjects
   * @returns string[] - e.g., ["数学", "物理", "化学"]
   */
  @Get('subjects')
  getSubjects(): string[] {
    return this.textbookService.getSubjects();
  }

  /**
   * GET /api/textbook/volumes?subject=数学&grade=3
   * Get volumes for a subject and grade
   * @returns string[] - e.g., ["上册", "下册"]
   */
  @Get('volumes')
  getVolumes(
    @Query('subject') subject: string,
    @Query('grade') grade: string,
  ): string[] {
    return this.textbookService.getVolumes(subject, parseInt(grade, 10));
  }

  /**
   * GET /api/textbook/chapters?subject=数学&grade=3&volume=上册
   * Get chapter tree for a subject, grade, and volume
   * @returns TextbookChapter[] - hierarchical chapter tree
   */
  @Get('chapters')
  getChapters(
    @Query('subject') subject: string,
    @Query('grade') grade: string,
    @Query('volume') volume: string,
  ) {
    return this.textbookService.getChapters(
      subject,
      parseInt(grade, 10),
      volume,
    );
  }

  /**
   * GET /api/textbook/grades?subject=数学
   * Get available grades for a subject (optional, for frontend convenience)
   * @returns number[] - e.g., [1, 2, 3, 4, 5, 6, 7, 8, 9]
   */
  @Get('grades')
  getGrades(@Query('subject') subject: string): number[] {
    return this.textbookService.getGrades(subject);
  }
}
