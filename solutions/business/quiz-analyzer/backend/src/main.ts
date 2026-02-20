import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor for request logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT || 3005;
  await app.listen(port);

  logger.log(`\n✓ Quiz Analyzer Backend listening on port ${port}`);
  logger.log(`  API: http://localhost:${port}/api/v1`);
  logger.log(`  Health: http://localhost:${port}/health`);
  logger.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
}

bootstrap();
