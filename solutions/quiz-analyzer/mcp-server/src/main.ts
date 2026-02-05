import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 CORS
  app.enableCors();

  // 设置全局前缀（可选）
  // app.setGlobalPrefix('api');

  const port = process.env.MCP_PORT || 3006;

  await app.listen(port);

  console.log(`Quiz Analyzer MCP Server listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
}

bootstrap();
