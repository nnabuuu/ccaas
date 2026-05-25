import { Module } from '@nestjs/common';
import { SolutionRegisterService } from './solution-register.service';
import { EntitiesModule } from './entities/entities.module';

@Module({
  imports: [EntitiesModule],
  providers: [SolutionRegisterService],
})
export class AppModule {}
