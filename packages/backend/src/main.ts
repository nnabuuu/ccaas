/**
 * Claude Code as a Service - NestJS Bootstrap
 *
 * Main entry point for the NestJS application.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, DynamicModule, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Resolve solution-specific handler bundles from the env var
 * `PLATFORM_HANDLER_PACKAGES` (CSV). Each package is dynamic-imported
 * and expected to export a NestJS module class.
 *
 * Convention (phase 5.5): the package's main `index.ts` exports
 * exactly ONE module class named with a `*Module` suffix. The loader
 * enforces "exactly one" — a misconfigured `index.ts` (e.g. someone
 * re-exports `OntologyModule` for convenience alongside their own
 * aggregator) is reported with the list of offending names rather
 * than silently picking whichever comes first.
 *
 * When env is unset/empty, the platform boots truly generic — no
 * handlers loaded. This is a supported configuration (not a
 * misconfiguration) so the log is informational, not warn-level —
 * see phase 5.5 pass-1 review N4.
 *
 * On dynamic-import failure the loader logs the underlying error and
 * exits with status 1 — a missing handler package IS a deploy
 * configuration error.
 */
async function loadPlatformHandlerModules(
  logger: Logger,
): Promise<Array<Type<unknown> | DynamicModule>> {
  const raw = process.env.PLATFORM_HANDLER_PACKAGES ?? '';
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) {
    logger.log(
      'PLATFORM_HANDLER_PACKAGES is unset — booting as generic platform ' +
        '(no solution handlers will load; trigger registry stays empty). ' +
        'Set the env var to a CSV of handler package names to register triggers.',
    );
    return [];
  }
  const out: Array<Type<unknown> | DynamicModule> = [];
  for (const name of names) {
    try {
      const mod = await import(name);
      const candidates = Object.values(mod).filter(
        (v): v is Type<unknown> =>
          typeof v === 'function' && /Module$/.test((v as Function).name),
      );
      if (candidates.length === 0) {
        throw new Error(
          `package "${name}" has no exported class ending in "Module"; check its index.ts`,
        );
      }
      if (candidates.length > 1) {
        // Pass-2 S2: renamed local from `names` to avoid shadowing the
        // outer `names` (the env-CSV list at line 39).
        // Pass-2 N3: message lists candidates without prescribing the
        // fix — the loader doesn't know whether the extra `*Module`
        // export was an accidental re-export or a deliberate
        // additional bundle.
        const offenders = candidates.map((c) => c.name).join(', ');
        throw new Error(
          `package "${name}" must export exactly one *Module class; ` +
            `found ${candidates.length} candidates: ${offenders}. ` +
            `Update the package's index.ts so only the handler ` +
            `aggregator module is reachable by the loader.`,
        );
      }
      const moduleClass = candidates[0];
      out.push(moduleClass);
      logger.log(`Loaded handler module ${moduleClass.name} from "${name}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        `Failed to load handler package "${name}": ${msg}`,
      );
      process.exit(1);
    }
  }
  return out;
}

async function bootstrap() {
  // Prevent nested Claude Code session errors by removing CLAUDECODE env var
  // This allows CCAAS to spawn AgentEngine instances even when running inside
  // a Claude Code session (e.g., during development)
  if (process.env.CLAUDECODE) {
    delete process.env.CLAUDECODE;
    console.log('[Bootstrap] Removed CLAUDECODE environment variable to prevent nested session errors');
  }

  const logger = new Logger('Bootstrap');

  const extraModules = await loadPlatformHandlerModules(logger);
  const app = await NestFactory.create(AppModule.register({ extraModules }));

  // Wire SIGTERM/SIGINT → onModuleDestroy. Without this, NestJS just exits
  // when the process is signaled and lifecycle hooks never run, so e.g.
  // SessionService.shutdown's awaited `workspaceProvider.close()` calls
  // (which unmount agentfs FUSE/NFS sessions cleanly) are skipped.
  app.enableShutdownHooks();

  // Get configuration for CORS
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:5175');

  // Enable CORS - Restrict origins in production
  app.enableCors({
    origin: isProduction ? allowedOrigins.split(',') : true, // Production: whitelist, Dev: all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Solution-Id'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Allow extra properties for flexibility (e.g., context field)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global HTTP exception filter
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // =========================================================================
  // Swagger Documentation - 中文版
  // =========================================================================
  const configZh = new DocumentBuilder()
    .setTitle('CCAAS API 文档')
    .setDescription(
      '# Claude Code as a Service API 文档\n\n' +
      '本文档提供 CCAAS 平台的 RESTful API 接口说明。\n\n' +
      '## 认证方式\n\n' +
      '大部分 API 需要在请求头中提供 API Key：\n' +
      '```\n' +
      'X-API-Key: ccaas_xxxxxxxxxxxxxxxx\n' +
      '```\n\n' +
      '## 核心概念\n\n' +
      '- **Solution（租户）**: 多租户隔离的基本单位\n' +
      '- **Session（会话）**: 与 AgentEngine 的交互会话\n' +
      '- **Message（消息）**: 用户和 Agent 之间的对话消息\n' +
      '- **Skill（技能）**: 自定义的 Agent 能力扩展\n' +
      '- **MCP Server**: Model Context Protocol 服务器\n\n' +
      '## WebSocket 事件\n\n' +
      '除了 REST API，CCAAS 还通过 WebSocket 推送实时事件：\n' +
      '- `text_delta` - 流式文本增量\n' +
      '- `tool_activity` - 工具调用活动\n' +
      '- `agent_status` - Agent 状态变更\n' +
      '- `token_usage` - Token 使用统计\n'
    )
    .setVersion('3.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-API-Key', in: 'header' },
      'api-key'
    )
    .addTag('sessions', '会话管理 - Session 创建、消息发送、状态查询')
    .addTag('messages', '消息历史 - 消息查询、工具事件、思考块')
    .addTag('conversations', '会话元数据 - 列表、搜索、置顶、删除')
    .addTag('queue', '队列监控 - 消息处理队列状态')
    .addTag('files', '文件资源 - 文件上传、下载、预览')
    .addTag('skills', '技能管理 - Skill CRUD、版本控制')
    .addTag('mcp', 'MCP 服务器 - MCP 服务器配置与管理')
    .addTag('auth', '认证授权 - API Key 与用户管理')
    .addTag('solutions', 'Solution 管理 - 多 Solution 配置（旧称：tenants/租户）')
    .addTag('scheduler', '⚠️ [Alpha] 定时任务 - 定时执行 Agent 任务（功能尚在开发中，API 可能变更）')
    .addTag('jobs', '⚠️ [Alpha] 后台任务 - 异步任务管理（功能尚在开发中，API 可能变更）')
    .addTag('builder', 'Builder 开发者 - 自有 Solution 与 API Key 管理')
    .addTag('admin', '管理接口 - 系统管理功能')
    .build();

  const documentZh = SwaggerModule.createDocument(app, configZh);
  SwaggerModule.setup('api/docs', app, documentZh, {
    customSiteTitle: 'CCAAS API 文档',
    customfavIcon: 'https://docs.nestjs.com/assets/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // =========================================================================
  // Swagger Documentation - English Version
  // =========================================================================
  const configEn = new DocumentBuilder()
    .setTitle('CCAAS API Documentation')
    .setDescription(
      '# Claude Code as a Service API Documentation\n\n' +
      'This documentation provides RESTful API specifications for the CCAAS platform.\n\n' +
      '## Authentication\n\n' +
      'Most APIs require an API Key in the request header:\n' +
      '```\n' +
      'X-API-Key: ccaas_xxxxxxxxxxxxxxxx\n' +
      '```\n\n' +
      '## Core Concepts\n\n' +
      '- **Solution**: Basic unit of isolation in ccaas-core (formerly known as "tenant"; renamed in α 2026-05)\n' +
      '- **Session**: Interactive session with AgentEngine\n' +
      '- **Message**: Conversation messages between user and agent\n' +
      '- **Skill**: Custom agent capability extensions\n' +
      '- **MCP Server**: Model Context Protocol server\n\n' +
      '## WebSocket Events\n\n' +
      'Besides REST APIs, CCAAS also pushes real-time events via WebSocket:\n' +
      '- `text_delta` - Streaming text deltas\n' +
      '- `tool_activity` - Tool invocation activities\n' +
      '- `agent_status` - Agent status changes\n' +
      '- `token_usage` - Token usage statistics\n'
    )
    .setVersion('3.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-API-Key', in: 'header' },
      'api-key'
    )
    .addTag('sessions', 'Session Management - Session creation, messaging, status')
    .addTag('messages', 'Message History - Query messages, tool events, thinking blocks')
    .addTag('conversations', 'Conversation Metadata - List, search, pin, delete')
    .addTag('queue', 'Queue Monitoring - Message processing queue status')
    .addTag('files', 'File Resources - Upload, download, preview files')
    .addTag('skills', 'Skill Management - Skill CRUD, version control')
    .addTag('mcp', 'MCP Servers - MCP server configuration and management')
    .addTag('auth', 'Authentication - API Key and user management')
    .addTag('solutions', 'Solution Management - Multi-solution configuration (formerly known as "tenants")')
    .addTag('scheduler', '⚠️ [Alpha] Scheduled Tasks - Execute agent tasks on schedule (under development, API may change)')
    .addTag('jobs', '⚠️ [Alpha] Background Jobs - Async job management (under development, API may change)')
    .addTag('builder', 'Builder API - Manage own solutions and API keys')
    .addTag('admin', 'Admin APIs - System administration')
    .build();

  const documentEn = SwaggerModule.createDocument(app, configEn);
  SwaggerModule.setup('api/docs/en', app, documentEn, {
    customSiteTitle: 'CCAAS API Documentation',
    customfavIcon: 'https://docs.nestjs.com/assets/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // Get port configuration
  const port = configService.get<number>('port', 3001);

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`WebSocket server ready on: ws://localhost:${port}`);
  logger.log(`Swagger 文档（中文）: http://localhost:${port}/api/docs`);
  logger.log(`Swagger Docs (EN): http://localhost:${port}/api/docs/en`);

  // Note: Solution auto-discovery is triggered via SolutionLoaderModule.onApplicationBootstrap()
  // See packages/backend/src/solutions/solution-loader.module.ts
}

bootstrap();
