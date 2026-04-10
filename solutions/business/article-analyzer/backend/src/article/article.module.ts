import { Module } from '@nestjs/common';
import { ArticleController, RunController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  controllers: [ArticleController, RunController],
  providers: [ArticleService],
})
export class ArticleModule {}
