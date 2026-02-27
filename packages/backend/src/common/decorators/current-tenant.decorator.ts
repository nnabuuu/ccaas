/**
 * CurrentTenant Decorator
 *
 * Extracts tenant ID from request context.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.id;
  },
);
