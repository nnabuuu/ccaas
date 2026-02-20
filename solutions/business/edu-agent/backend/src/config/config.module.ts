import { Module } from '@nestjs/common';
import { SolutionConfigController } from './config.controller';

@Module({
  controllers: [SolutionConfigController],
})
export class SolutionConfigModule {}
