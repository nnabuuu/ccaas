import { Module } from '@nestjs/common';
import { DemoEntityProvider } from './demo-entity.provider';
import { EntitiesController } from './entities.controller';

@Module({
  controllers: [EntitiesController],
  providers: [DemoEntityProvider],
  exports: [DemoEntityProvider],
})
export class EntitiesModule {}
