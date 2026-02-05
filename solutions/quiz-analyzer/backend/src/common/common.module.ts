import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { Quiz } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Quiz])],
  controllers: [HealthController],
})
export class CommonModule {}
