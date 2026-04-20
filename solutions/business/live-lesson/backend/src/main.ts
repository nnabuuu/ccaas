import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
