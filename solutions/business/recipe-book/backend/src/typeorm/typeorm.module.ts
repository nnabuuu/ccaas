import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { Recipe } from '../entities/recipe.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: path.resolve(__dirname, '../../data/recipe-book.db'),
      entities: [Recipe],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class TypeOrmConfigModule {}
