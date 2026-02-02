import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MosaicModule } from './mosaic/mosaic.module';
import { CatalogController } from './catalog/catalog.controller';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/api/uploads',
    }),
    MosaicModule,
  ],
  controllers: [CatalogController, UploadController],
})
export class AppModule {}
