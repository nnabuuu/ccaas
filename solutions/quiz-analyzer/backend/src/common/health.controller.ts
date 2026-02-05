import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from '../database/entities';

@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
  ) {}

  @Get()
  async check() {
    // Check database connection
    try {
      const count = await this.quizRepository.count();

      return {
        status: 'healthy',
        service: 'quiz-analyzer-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          quizCount: count,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'quiz-analyzer-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          error: error.message,
        },
      };
    }
  }
}
