import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgePointsController } from './knowledge-points.controller';
import { KnowledgePointsService } from './knowledge-points.service';
import { KnowledgePoint } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgePoint])],
  controllers: [KnowledgePointsController],
  providers: [KnowledgePointsService],
  exports: [KnowledgePointsService],
})
export class KnowledgePointsModule {}
