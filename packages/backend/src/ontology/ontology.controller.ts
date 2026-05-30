import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OntologyRegistry, serializeRegistry } from '@kedge-agentic/ontology';
import { OptionalAuth } from '../auth/decorators';
import { ONTOLOGY_REGISTRY } from './ontology-registry.provider';

@ApiTags('ontology')
@Controller('api/v1/ontology')
export class OntologyController {
  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
  ) {}

  @Get('schema')
  @OptionalAuth()
  @ApiOperation({
    summary: '获取 Ontology Schema / Get Ontology Schema',
    description:
      '返回当前注册表的完整序列化 schema。响应头携带 sha256 ETag；客户端可使用 If-None-Match 条件请求实现 304 缓存复用。/ Returns the full serialized ontology schema. The response carries a sha256 ETag header; clients can send If-None-Match to get a 304 when the schema is unchanged.',
  })
  @ApiResponse({ status: 200, description: '完整 schema / Full serialized schema' })
  @ApiResponse({
    status: 304,
    description: 'Schema 未变化（If-None-Match 命中）/ Schema unchanged (If-None-Match hit)',
  })
  async getSchema(@Req() req: Request, @Res() res: Response): Promise<void> {
    const etag = this.registry.getSchemaDigest();
    res.set('ETag', etag);
    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }
    res.status(200).json(serializeRegistry(this.registry.context()));
  }
}
