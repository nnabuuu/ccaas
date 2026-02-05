/**
 * Claude Code as a Service - NestJS Bootstrap
 *
 * Main entry point for the NestJS application.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins (dev environment)
  app.enableCors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3001);

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`WebSocket server ready on: ws://localhost:${port}`);
}

bootstrap();
