import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Disable default body parser so we can set a custom size limit for base64 image uploads
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || /^http:\/\/localhost:\d+$/,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3007;
  await app.listen(port, '0.0.0.0');

  logger.log('');
  logger.log('Live-Lesson Backend');
  logger.log('====================');
  logger.log(`HTTP: http://0.0.0.0:${port}`);
  logger.log('');
}

bootstrap();
