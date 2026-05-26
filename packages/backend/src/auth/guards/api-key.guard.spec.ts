import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from '../api-key.service';
import { IS_PUBLIC_KEY, IS_OPTIONAL_AUTH_KEY } from '../decorators';
import { SessionExpiredException } from '../../protocol/http-exceptions';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let reflector: Reflector;

  // Helpers
  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = { headers, context: undefined, solutionId: undefined, tenant: undefined };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function getRequest(ctx: ExecutionContext) {
    return ctx.switchToHttp().getRequest() as any;
  }

  beforeEach(() => {
    apiKeyService = {
      createContext: jest.fn(),
    } as any;
    reflector = new Reflector();
    guard = new ApiKeyGuard(apiKeyService, reflector);
  });

  // ── @Public routes ──────────────────────────────────────────────────

  describe('@Public routes', () => {
    it('should allow access without calling apiKeyService', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return false;
      });
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyService.createContext).not.toHaveBeenCalled();
    });
  });

  // ── @OptionalAuth routes ────────────────────────────────────────────

  describe('@OptionalAuth routes', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return false;
      });
    });

    it('should attach anonymous context when no API key and anonymous allowed', async () => {
      const anonymousCtx = {
        solutionId: 'default-tenant',
        tenant: { id: 'default-tenant', name: 'Default' },
        requestId: 'req-1',
        timestamp: new Date(),
        isAnonymous: true,
      };
      apiKeyService.createContext.mockResolvedValue(anonymousCtx as any);
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyService.createContext).toHaveBeenCalledWith(undefined);
      const req = getRequest(ctx);
      expect(req.context).toBe(anonymousCtx);
      expect(req.solutionId).toBe('default-tenant');
    });

    it('should validate and attach context when valid API key provided', async () => {
      const authCtx = {
        solutionId: 'tenant-1',
        tenant: { id: 'tenant-1' },
        apiKeyId: 'key-1',
        apiKeyScopes: ['chat'],
        requestId: 'req-2',
        timestamp: new Date(),
        isAnonymous: false,
      };
      apiKeyService.createContext.mockResolvedValue(authCtx as any);
      const ctx = createMockContext({ authorization: 'Bearer sk-valid-key-123456' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyService.createContext).toHaveBeenCalledWith('sk-valid-key-123456');
      const req = getRequest(ctx);
      expect(req.context).toBe(authCtx);
      expect(req.context.isAnonymous).toBe(false);
    });

    it('should reject invalid API key with 401', async () => {
      apiKeyService.createContext.mockRejectedValue(
        new SessionExpiredException('Invalid API key'),
      );
      const ctx = createMockContext({ authorization: 'Bearer sk-invalid-key-999' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should fall back to handleOptionalAuth when no key and createContext fails', async () => {
      // First call (no rawKey) fails — simulates AUTH_ALLOW_ANONYMOUS=false
      // handleOptionalAuth retries createContext() without key, also fails
      apiKeyService.createContext.mockRejectedValue(
        new SessionExpiredException('API key required'),
      );
      const ctx = createMockContext();

      const result = await guard.canActivate(ctx);

      // handleOptionalAuth catches and sets context = null, still returns true
      expect(result).toBe(true);
      const req = getRequest(ctx);
      expect(req.context).toBeNull();
    });
  });

  // ── @Auth (required auth) routes ────────────────────────────────────

  describe('@Auth (required auth) routes', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === IS_OPTIONAL_AUTH_KEY) return false;
        return false;
      });
    });

    it('should attach context when valid API key provided', async () => {
      const authCtx = {
        solutionId: 'tenant-1',
        tenant: { id: 'tenant-1' },
        apiKeyId: 'key-1',
        requestId: 'req-3',
        timestamp: new Date(),
        isAnonymous: false,
      };
      apiKeyService.createContext.mockResolvedValue(authCtx as any);
      const ctx = createMockContext({ 'x-api-key': 'sk-valid-key-123456' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(getRequest(ctx).context).toBe(authCtx);
    });

    it('should reject when no API key provided and anonymous access fails', async () => {
      apiKeyService.createContext.mockRejectedValue(
        new SessionExpiredException('API key required'),
      );
      const ctx = createMockContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid API key with 401', async () => {
      apiKeyService.createContext.mockRejectedValue(
        new SessionExpiredException('Invalid API key'),
      );
      const ctx = createMockContext({ authorization: 'Bearer sk-bad-key' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── API key extraction ──────────────────────────────────────────────

  describe('API key extraction', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      apiKeyService.createContext.mockResolvedValue({
        solutionId: 't', tenant: { id: 't' }, requestId: 'r', timestamp: new Date(), isAnonymous: false,
      } as any);
    });

    it('should extract from Bearer token', async () => {
      const ctx = createMockContext({ authorization: 'Bearer sk-my-key-12345' });
      await guard.canActivate(ctx);
      expect(apiKeyService.createContext).toHaveBeenCalledWith('sk-my-key-12345');
    });

    it('should extract direct sk- key from authorization header', async () => {
      const ctx = createMockContext({ authorization: 'sk-direct-key-12345' });
      await guard.canActivate(ctx);
      expect(apiKeyService.createContext).toHaveBeenCalledWith('sk-direct-key-12345');
    });

    it('should extract from x-api-key header', async () => {
      const ctx = createMockContext({ 'x-api-key': 'sk-xapi-key-12345' });
      await guard.canActivate(ctx);
      expect(apiKeyService.createContext).toHaveBeenCalledWith('sk-xapi-key-12345');
    });

    it('should pass undefined when no key headers present', async () => {
      const ctx = createMockContext();
      await guard.canActivate(ctx);
      expect(apiKeyService.createContext).toHaveBeenCalledWith(undefined);
    });
  });
});
