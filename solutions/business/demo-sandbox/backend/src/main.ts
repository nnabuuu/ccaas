import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  const port = Number(process.env.PORT ?? 3008);
  await app.listen(port);
  console.log(`[DemoSandbox] Backend running on http://localhost:${port}`);
}

bootstrap();
