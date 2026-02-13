import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Quick check of critical dependencies (for load balancers)
   */
  async checkCriticalDependencies(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detailed service status check (for monitoring systems)
   */
  async getServiceStatus() {
    return {
      database: await this.checkDatabase(),
      websocket: 'ok', // WebSocket starts with application
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
