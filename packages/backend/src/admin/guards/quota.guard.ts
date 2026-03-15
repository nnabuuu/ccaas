/**
 * Quota Guard
 *
 * Checks tenant token quota before allowing message processing.
 * Applied on SessionsController.sendMessage() to enforce monthly limits.
 *
 * Reads tenantId from request body, looks up tenant plan,
 * and delegates to QuotaService for the actual check.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { QuotaService } from '../quota.service';
import { TenantsService } from '../../tenants/tenants.service';
import { QuotaExceededException } from '../../protocol/http-exceptions';

@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly quotaService: QuotaService,
    private readonly tenantsService: TenantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.body?.tenantId;

    if (!tenantId) {
      // Let the controller handle missing tenantId
      return true;
    }

    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      // Let the controller handle invalid tenant
      return true;
    }

    const result = await this.quotaService.checkQuota(tenant.id, tenant.plan);

    if (!result.allowed) {
      this.logger.warn(
        `Quota exceeded for tenant ${tenant.id} (${tenant.slug}): ` +
          `${result.used}/${result.limit} tokens`,
      );
      throw new QuotaExceededException({
        limit: result.limit,
        used: result.used,
        period: 'monthly',
        resetsAt: result.resetsAt,
      });
    }

    return true;
  }
}
