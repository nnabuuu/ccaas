import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatePromotion } from '../entities/template-promotion.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TemplatePromotion])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
