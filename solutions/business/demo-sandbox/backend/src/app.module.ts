import { Module } from '@nestjs/common';
import { SolutionRegisterService } from './solution-register.service';
import { EntitiesModule } from './entities/entities.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [EntitiesModule, DemoModule],
  providers: [SolutionRegisterService],
})
export class AppModule {}
