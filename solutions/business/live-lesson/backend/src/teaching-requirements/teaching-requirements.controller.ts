/**
 * TeachingRequirementsController — L1 reads + L2 per-user overlay.
 *
 * The composite shape (L1 canonical fields + `myInterpretation` from
 * L2) is what the Plan Tab chip popover + the agent helper consume,
 * so they can do one round-trip per req. Listing endpoints stay L1-
 * only since they're typically called from the picker UI where
 * interpretations aren't needed in the table view.
 *
 * Auth: `userId` is resolved from request via `resolveUserId` (header
 * or env fallback). NEVER read from query/body — that would let
 * caller A read user B's interpretations by passing `?userId=B`.
 *
 * The `_interpretations` route uses an underscore prefix so it
 * doesn't collide with a hypothetical req id `interpretations`.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { RequirementInterpretationService } from './requirement-interpretation.service';
import { TeachingRequirementsService } from './teaching-requirements.service';
import type {
  InterpretationOverlay,
  ReqItemWithCategory,
  ReqItemWithInterpretation,
  TeachingRequirementsLibrary,
} from './types';
import { resolveUserId, type RequestLike } from './user-context';

// Conservative cap on interpretation note size. Markdown for personal
// pedagogical notes shouldn't approach this; values above suggest
// either copy-paste mistakes or an abuse vector. 16 KB ≈ 4-5 pages
// of dense Chinese text, plenty of headroom.
const NOTES_MAX_BYTES = 16_000;

@ApiTags('teaching-requirements')
@Controller('api/teaching-requirements')
export class TeachingRequirementsController {
  constructor(
    private readonly svc: TeachingRequirementsService,
    private readonly interpretations: RequirementInterpretationService,
  ) {}

  /**
   * List libraries. Without `subject`, returns all libraries
   * (hierarchical, categories nested). With `subject`, narrows to one
   * library or 404 if unknown. With `q`, returns a flat
   * ReqItemWithCategory[] (search mode); pickers + agent helpers use
   * search mode.
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
   * List all of the caller's interpretations. The materializer uses
   * this at session start to render `_lib/my-interpretations.md`.
   * Static path with underscore prefix to avoid clashing with id
   * lookups (`:id` route below).
   */
  @Get('_interpretations')
  @ApiOperation({
    summary: 'List all interpretations belonging to the calling user (L2)',
  })
  async listMyInterpretations(
    @Req() req: RequestLike,
  ): Promise<Array<{ reqId: string; notes: string; updatedAt: string }>> {
    const userId = resolveUserId(req);
    return this.interpretations.listForUser(userId);
  }

  /**
   * Get one req item with L1 metadata + `myInterpretation` from L2
   * (null if the user has nothing recorded).
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get one teaching requirement (L1 fields + L2 overlay if any)',
  })
  async findOne(
    @Param('id') id: string,
    @Req() req: RequestLike,
  ): Promise<ReqItemWithInterpretation> {
    const item = this.svc.findItemById(id);
    const userId = resolveUserId(req);
    const myInterpretation = await this.interpretations.find(userId, id);
    return { ...item, myInterpretation };
  }

  /**
   * Upsert the caller's interpretation of one req. `notes` is the
   * plain-markdown body. Returns the persisted `updatedAt` so clients
   * can show "saved a moment ago" without re-fetching.
   */
  @Put(':id/interpretation')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upsert the calling user\'s interpretation of one req (L2)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { notes: { type: 'string' } },
      required: ['notes'],
    },
  })
  async putInterpretation(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Req() req: RequestLike,
  ): Promise<InterpretationOverlay> {
    if (typeof body?.notes !== 'string') {
      throw new BadRequestException('notes (string) required in body');
    }
    // Length cap — DB column is unbounded TEXT, so without this an
    // attacker / accidental copy-paste could write multi-MB rows.
    // Byte-length (not char-length) because UTF-8 Chinese chars are
    // 3 bytes apiece; we care about storage cost, not glyph count.
    const byteLength = Buffer.byteLength(body.notes, 'utf8');
    if (byteLength > NOTES_MAX_BYTES) {
      throw new BadRequestException(
        `notes too large (${byteLength} bytes > ${NOTES_MAX_BYTES})`,
      );
    }
    // Confirm the req id exists in L1 — this prevents accidental
    // creation of orphan rows from typos. Existing orphans (from
    // library version changes) are still readable via find().
    this.svc.findItemById(id);
    const userId = resolveUserId(req);
    return this.interpretations.upsert(userId, id, body.notes);
  }

  /**
   * Delete the caller's interpretation. 404 if the user has no
   * interpretation for this req (idempotent-style swallow would mask
   * stale-UI double-delete bugs).
   */
  @Delete(':id/interpretation')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete the calling user\'s interpretation of one req (L2)',
  })
  async deleteInterpretation(
    @Param('id') id: string,
    @Req() req: RequestLike,
  ): Promise<void> {
    const userId = resolveUserId(req);
    await this.interpretations.remove(userId, id);
  }
}
