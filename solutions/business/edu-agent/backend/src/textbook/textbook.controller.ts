import { Controller, Get, Query } from '@nestjs/common';
import { TextbookService } from './textbook.service';
import {
  TextbookSubject,
  TextbookGrade,
  TextbookPublisher,
  TextbookVolume,
  TextbookChapter,
} from './mock-data';

@Controller('textbook')
export class TextbookController {
  constructor(private readonly textbookService: TextbookService) {}

  /**
   * GET /api/textbook/subjects
   * Get all available subjects
   * @returns TextbookSubject[] - e.g., [{id: "math", label: "数学"}, ...]
   */
  @Get('subjects')
  getSubjects(): TextbookSubject[] {
    return this.textbookService.getSubjects();
  }

  /**
   * GET /api/textbook/grades?subject=math
   * Get grades for a subject
   * @returns TextbookGrade[] - e.g., [{id: 1, label: "一年级", stage: "..."}]
   */
  @Get('grades')
  getGrades(@Query('subject') subject: string): TextbookGrade[] {
    return this.textbookService.getGrades(subject);
  }

  /**
   * GET /api/textbook/publishers?subject=math&gradeId=3
   * Get publishers for a subject and grade
   * @returns TextbookPublisher[] - e.g., [{id: "pep", label: "人教版"}]
   */
  @Get('publishers')
  getPublishers(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
  ): TextbookPublisher[] {
    return this.textbookService.getPublishers(subject, parseInt(gradeId, 10));
  }

  /**
   * GET /api/textbook/volumes?subject=math&gradeId=3&publisher=人教版
   * Get volumes for a subject, grade, and publisher
   * @returns TextbookVolume[] - e.g., [{id: "vol1", label: "上册"}]
   */
  @Get('volumes')
  getVolumes(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
    @Query('publisher') publisher: string,
  ): TextbookVolume[] {
    return this.textbookService.getVolumes(
      subject,
      parseInt(gradeId, 10),
      publisher,
    );
  }

  /**
   * GET /api/textbook/chapters?subject=math&gradeId=3&publisher=人教版&volume=上册
   * Get chapter tree for a subject, grade, publisher, and volume
   * @returns TextbookChapter[] - hierarchical chapter tree
   */
  @Get('chapters')
  getChapters(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
    @Query('publisher') publisher: string,
    @Query('volume') volume: string,
  ): TextbookChapter[] {
    return this.textbookService.getChapters(
      subject,
      parseInt(gradeId, 10),
      publisher,
      volume,
    );
  }
}
