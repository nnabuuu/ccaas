import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseTypeDef } from '../adapters/persistence/entities/exercise-type-def.entity';
import { ExerciseTypeController } from './exercise-type.controller';
import { ExerciseTypeRegistryService } from './exercise-type-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseTypeDef])],
  controllers: [ExerciseTypeController],
  providers: [ExerciseTypeRegistryService],
  exports: [ExerciseTypeRegistryService],
})
export class ExerciseTypeModule {}
