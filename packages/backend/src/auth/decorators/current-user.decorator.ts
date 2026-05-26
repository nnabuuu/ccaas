/**
 * Current User Decorator
 *
 * Extracts the current user from the request context.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { UserSolution } from '../../users/entities/user-solution.entity';
import type { RequestContext } from '../types';

export interface CurrentUserData {
  user?: User;
  userTenant?: UserSolution;
  userId?: string;
}

/**
 * Get the current user from the request context
 *
 * @example
 * ```typescript
 * @Get()
 * findAll(@CurrentUser() currentUser: CurrentUserData) {
 *   console.log(currentUser.user?.name);
 *   console.log(currentUser.userTenant?.role);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    const context: RequestContext | undefined = request.context;

    if (!context) {
      return {};
    }

    return {
      user: context.user,
      userTenant: context.userTenant,
      userId: context.userId,
    };
  },
);
