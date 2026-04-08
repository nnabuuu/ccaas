import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: '*' });
  app.useStaticAssets(join(__dirname, '..', 'src', 'public'));
  await app.listen(3021);
  console.log('[ContextLayerDemo] Running on http://localhost:3021');
  console.log('[ContextLayerDemo] Demo UI at http://localhost:3021/index.html');
}
bootstrap();
