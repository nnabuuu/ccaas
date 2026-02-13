/**
 * Health Module
 *
 * System health monitoring module.
 * Provides health check and status endpoints for load balancers and monitoring systems.
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule], // Need SessionService for stats
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
