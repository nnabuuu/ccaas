import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto, CreateFileDto, UpdateFileDto } from './project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  // ── Project CRUD ──

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  /**
   * Standalone manifest validator. Cheap (no DB writes, no LLM, just
   * ManifestSchema.safeParse) — designed for the manifest-editor agent
   * to self-check after every edit, BEFORE the teacher hits publish.
   * Same schema the publish flow uses, so a green response here
   * guarantees publish will accept.
   *
   * Path is plural ("validate-manifest") + sibling of /publish to
   * signal it's a project-wide concern, not bound to a specific
   * project id (there's no DB touch — just schema check).
   */
  @Post('validate-manifest')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate a manifest body against ManifestSchema (no DB writes).',
    description:
      'Stateless pre-flight: takes a manifest JSON string in the body, ' +
      'returns { valid, stepCount?, issues? }. The agent calls this ' +
      'via scripts/validate-manifest.sh after every edit so it can ' +
      'self-correct without round-tripping through publish.',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result (200 even on invalid — check `valid` field).',
  })
  validateManifest(@Body() body: { content?: string }) {
    if (typeof body?.content !== 'string') {
      throw new BadRequestException('content (string) required in body');
    }
    return this.service.validateManifestContent(body.content);
  }

  @Get()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'archived', 'all'],
    description: 'Filter by status. Default `active` returns draft + published; `archived` for the recovery view.',
  })
  findAll(@Query('status') status?: string) {
    const normalized =
      status === 'archived' || status === 'all' ? status : 'active';
    return this.service.findAll({ status: normalized });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Restore an archived project back to draft status.',
  })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  // ── File operations ──

  @Get(':id/files')
  @ApiQuery({ name: 'path', required: false, description: 'Virtual file path; omit to list all files' })
  listOrReadFiles(@Param('id') id: string, @Query('path') filePath?: string) {
    if (filePath) {
      return this.service.readFile(id, filePath);
    }
    return this.service.listFiles(id);
  }

  @Post(':id/files')
  createFile(@Param('id') id: string, @Body() dto: CreateFileDto) {
    return this.service.createFile(id, dto);
  }

  @Put(':id/files')
  @ApiQuery({ name: 'path', required: true, description: 'Virtual file path within the project' })
  writeFile(
    @Param('id') id: string,
    @Query('path') filePath: string,
    @Body() dto: UpdateFileDto,
  ) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.writeFile(id, filePath, dto.content);
  }

  @Delete(':id/files')
  @ApiQuery({ name: 'path', required: true, description: 'Virtual file path to delete' })
  deleteFile(@Param('id') id: string, @Query('path') filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.deleteFile(id, filePath);
  }

  // ── Agent-runtime contract ──
  // Three endpoints under /projects/:id/artifacts that ccaas's
  // `RestProjectArtifactSource` calls at turn boundaries. Solutions wanting
  // bidirectional agent↔GUI sync MUST satisfy this contract. See
  // packages/backend/src/sessions/agent-runtime/rest-project-artifact-source.ts
  // for the consumer.

  /**
   * Return all artifacts for the project with content inlined.
   * Shape: [{ path, content, type }]
   */
  @Get(':id/artifacts')
  listArtifacts(@Param('id') id: string) {
    return this.service.listArtifactsWithContent(id);
  }

  /**
   * Upsert one artifact. Creates if missing, overwrites if present.
   * Body: { content: string, type: string, attributes?: object }
   */
  @Put(':id/artifacts')
  @ApiQuery({ name: 'path', required: true })
  upsertArtifact(
    @Param('id') id: string,
    @Query('path') filePath: string,
    @Body() dto: { content: string; type: string; attributes?: Record<string, unknown> },
  ) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.upsertArtifact(id, filePath, dto.content, dto.type);
  }

  /**
   * Delete one artifact. Idempotent (404 is treated as already-deleted by
   * the runtime adapter).
   */
  @Delete(':id/artifacts')
  @ApiQuery({ name: 'path', required: true })
  deleteArtifact(@Param('id') id: string, @Query('path') filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.deleteFile(id, filePath);
  }

  // ── Publish ──

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }
}
