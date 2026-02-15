import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5281',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3003;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log('');
  logger.log('Task Manager Tutorial Backend (NestJS)');
  logger.log('=======================================');
  logger.log(`HTTP:   http://${host}:${port}`);
  logger.log('');
}

bootstrap();
