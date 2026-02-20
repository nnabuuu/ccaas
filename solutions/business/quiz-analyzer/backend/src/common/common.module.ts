import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { ConfigController } from './config.controller';
import { Quiz } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Quiz])],
  controllers: [HealthController, ConfigController],
})
export class CommonModule {}
