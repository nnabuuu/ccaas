import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmConfigModule } from './typeorm/typeorm.module';
import { RecipeModule } from './recipe/recipe.module';
import { ReferenceableModule } from './referenceable/referenceable.module';
import { SolutionRegisterService } from './solution-register.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmConfigModule,
    RecipeModule,
    ReferenceableModule,
  ],
  providers: [SolutionRegisterService],
})
export class AppModule {}
