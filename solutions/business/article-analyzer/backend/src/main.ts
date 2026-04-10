import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.forRoot());
  app.enableCors({ origin: '*' });
  await app.listen(3033);
  console.log('[ArticleAnalyzer] Running on http://localhost:3033');
}
bootstrap();
