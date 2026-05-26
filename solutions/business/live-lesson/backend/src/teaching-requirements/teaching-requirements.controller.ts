/**
 * TeachingRequirementsController — L1 reads (library list/lookup/search).
 *
 * L2 interpretation endpoints live on the same path prefix but are
 * mixed into this controller in a later commit (once the
 * RequirementInterpretation entity is in place). Keeping reads and
 * the per-user overlay on one controller lets the Plan Tab fetch the
 * composite shape in a single round-trip.
 *
 * Auth note: L1 reads are platform data — no per-user scoping. The
 * L2-augmented GET /:id (added in the next commit) reads userId from
 * the request context.
 */

import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { TeachingRequirementsService } from './teaching-requirements.service';
import type {
  ReqItemWithCategory,
  TeachingRequirementsLibrary,
} from './types';

@ApiTags('teaching-requirements')
@Controller('api/teaching-requirements')
export class TeachingRequirementsController {
  constructor(private readonly svc: TeachingRequirementsService) {}

  /**
   * List libraries. Without `subject`, returns all subjects'
   * hierarchical structures (categories + items). With `subject`, narrows
   * to one library or 404 if unknown.
   *
   * The picker UI fetches with the project's subject; the materializer
   * also fetches by subject.
   */
  @Get()
  @ApiOperation({
    summary: 'List teaching requirement libraries (L1, platform-shipped)',
  })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Optional substring match on item text/code/id. When present, response is a flat ReqItemWithCategory[] instead of nested libraries.',
  })
  list(
    @Query('subject') subject?: string,
    @Query('q') q?: string,
  ): TeachingRequirementsLibrary[] | ReqItemWithCategory[] {
    // Search mode: flat results (easier for picker/agent).
    if (q && q.trim()) {
      return this.svc.search({ subject, q });
    }
    if (subject) {
      const lib = this.svc.getLibrary(subject);
      if (!lib) {
        throw new NotFoundException(`unknown subject: ${subject}`);
      }
      return [lib];
    }
    return this.svc.listLibraries();
  }

  /**
   * Get one req item with category metadata. 404 if unknown id.
   *
   * Future commit adds `myInterpretation` to the response when the
   * caller is authenticated and has an interpretation row.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get one teaching requirement item (L1 only in this commit)',
  })
  findOne(@Param('id') id: string): ReqItemWithCategory {
    return this.svc.findItemById(id);
  }
}
