/**
 * Protocol HTTP Exceptions Tests
 */

import {
  ProtocolHttpException,
  ValidationException,
  SkillNotFoundException,
  ResourceNotFoundException,
  AlreadyExistsException,
  PermissionDeniedException,
  SessionExpiredException,
  RateLimitedException,
  TimeoutException,
  InternalException,
  McpException,
  ConnectionLostException,
  InvalidOutputException,
  PartialFailureException,
  CliException,
} from './http-exceptions';

describe('http-exceptions', () => {
  describe('ProtocolHttpException', () => {
    it('should create exception with correct properties', () => {
      const exception = new ProtocolHttpException(
        'VALIDATION_ERROR',
        'Test error',
        true,
        true,
        5000,
        ['field1'],
        { data: 'partial' },
      );

      expect(exception.errorCode).toBe('VALIDATION_ERROR');
      expect(exception.message).toBe('Test error');
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
      expect(exception.retryAfterMs).toBe(5000);
      expect(exception.failedFields).toEqual(['field1']);
      expect(exception.partialOutput).toEqual({ data: 'partial' });
      expect(exception.getStatus()).toBe(400);
    });

    it('should create error response with all fields', () => {
      const exception = new ProtocolHttpException(
        'TIMEOUT',
        'Request timeout',
        true,
        true,
        10000,
      );

      const response = exception.toResponse('/api/test', 'req-123');

      expect(response.code).toBe('TIMEOUT');
      expect(response.message).toBe('Request timeout');
      expect(response.statusCode).toBe(504);
      expect(response.recoverable).toBe(true);
      expect(response.retryable).toBe(true);
      expect(response.retryAfterMs).toBe(10000);
      expect(response.path).toBe('/api/test');
      expect(response.requestId).toBe('req-123');
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('ValidationException', () => {
    it('should create validation error with default message', () => {
      const exception = new ValidationException();

      expect(exception.errorCode).toBe('VALIDATION_ERROR');
      expect(exception.message).toBe('Validation failed');
      expect(exception.getStatus()).toBe(400);
      expect(exception.recoverable).toBe(false);
      expect(exception.retryable).toBe(false);
    });

    it('should create validation error with custom message and fields', () => {
      const exception = new ValidationException('Invalid input', [
        'email',
        'password',
      ]);

      expect(exception.message).toBe('Invalid input');
      expect(exception.failedFields).toEqual(['email', 'password']);
    });
  });

  describe('SkillNotFoundException', () => {
    it('should create skill not found error', () => {
      const exception = new SkillNotFoundException('skill-123');

      expect(exception.errorCode).toBe('SKILL_NOT_FOUND');
      expect(exception.message).toBe('Skill not found: skill-123');
      expect(exception.getStatus()).toBe(404);
      expect(exception.recoverable).toBe(false);
    });
  });

  describe('AlreadyExistsException', () => {
    it('should create already exists error with default message', () => {
      const exception = new AlreadyExistsException();

      expect(exception.errorCode).toBe('ALREADY_EXISTS');
      expect(exception.message).toBe('Resource already exists');
      expect(exception.getStatus()).toBe(409);
      expect(exception.recoverable).toBe(false);
      expect(exception.retryable).toBe(false);
    });

    it('should create already exists error with custom message', () => {
      const exception = new AlreadyExistsException(
        "Solution with slug 'my-tenant' already exists",
      );

      expect(exception.message).toBe("Solution with slug 'my-tenant' already exists");
    });
  });

  describe('PermissionDeniedException', () => {
    it('should create permission denied error with default message', () => {
      const exception = new PermissionDeniedException();

      expect(exception.errorCode).toBe('PERMISSION_DENIED');
      expect(exception.message).toBe('Permission denied');
      expect(exception.getStatus()).toBe(403);
    });

    it('should create permission denied error with custom message', () => {
      const exception = new PermissionDeniedException(
        'Missing skills:write scope',
      );

      expect(exception.message).toBe('Missing skills:write scope');
    });
  });

  describe('SessionExpiredException', () => {
    it('should create session expired error without session ID', () => {
      const exception = new SessionExpiredException();

      expect(exception.errorCode).toBe('SESSION_EXPIRED');
      expect(exception.message).toBe('Session expired');
      expect(exception.getStatus()).toBe(401);
    });

    it('should create session expired error with session ID', () => {
      const sessionId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const exception = new SessionExpiredException(sessionId);

      expect(exception.message).toBe(`Session expired: ${sessionId}`);
    });

    it('should create session expired error with custom message', () => {
      const exception = new SessionExpiredException('Invalid API key');

      expect(exception.message).toBe('Invalid API key');
    });
  });

  describe('RateLimitedException', () => {
    it('should create rate limit error with default retry time', () => {
      const exception = new RateLimitedException();

      expect(exception.errorCode).toBe('RATE_LIMITED');
      expect(exception.message).toBe('Rate limit exceeded. Retry after 60000ms');
      expect(exception.getStatus()).toBe(429);
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
      expect(exception.retryAfterMs).toBe(60000);
    });

    it('should create rate limit error with custom retry time', () => {
      const exception = new RateLimitedException(30000);

      expect(exception.message).toBe('Rate limit exceeded. Retry after 30000ms');
      expect(exception.retryAfterMs).toBe(30000);
    });
  });

  describe('TimeoutException', () => {
    it('should create timeout error with default message', () => {
      const exception = new TimeoutException();

      expect(exception.errorCode).toBe('TIMEOUT');
      expect(exception.message).toBe('Request timeout');
      expect(exception.getStatus()).toBe(504);
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
    });

    it('should create timeout error with custom message', () => {
      const exception = new TimeoutException('Agent took too long');

      expect(exception.message).toBe('Agent took too long');
    });
  });

  describe('InternalException', () => {
    it('should create internal error with default message', () => {
      const exception = new InternalException();

      expect(exception.errorCode).toBe('INTERNAL_ERROR');
      expect(exception.message).toBe('Internal server error');
      expect(exception.getStatus()).toBe(500);
      expect(exception.recoverable).toBe(false);
    });
  });

  describe('McpException', () => {
    it('should create MCP error', () => {
      const exception = new McpException('MCP server error', { serverId: '1' });

      expect(exception.errorCode).toBe('MCP_ERROR');
      expect(exception.message).toBe('MCP server error');
      expect(exception.getStatus()).toBe(502);
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
      expect(exception.partialOutput).toEqual({ serverId: '1' });
    });
  });

  describe('ConnectionLostException', () => {
    it('should create connection lost error', () => {
      const exception = new ConnectionLostException();

      expect(exception.errorCode).toBe('CONNECTION_LOST');
      expect(exception.message).toBe('Connection lost');
      expect(exception.getStatus()).toBe(503);
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
    });
  });

  describe('InvalidOutputException', () => {
    it('should create invalid output error', () => {
      const exception = new InvalidOutputException('Invalid JSON', [
        'response',
      ]);

      expect(exception.errorCode).toBe('INVALID_OUTPUT');
      expect(exception.message).toBe('Invalid JSON');
      expect(exception.getStatus()).toBe(500);
      expect(exception.failedFields).toEqual(['response']);
    });
  });

  describe('PartialFailureException', () => {
    it('should create partial failure error', () => {
      const exception = new PartialFailureException(
        'Some fields failed',
        ['address', 'phone'],
        { name: 'John', email: 'john@example.com' },
      );

      expect(exception.errorCode).toBe('PARTIAL_FAILURE');
      expect(exception.message).toBe('Some fields failed');
      expect(exception.getStatus()).toBe(500);
      expect(exception.failedFields).toEqual(['address', 'phone']);
      expect(exception.partialOutput).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
    });
  });

  describe('CliException', () => {
    it('should create CLI error', () => {
      const exception = new CliException('Process crashed');

      expect(exception.errorCode).toBe('CLI_ERROR');
      expect(exception.message).toBe('Process crashed');
      expect(exception.getStatus()).toBe(500);
      expect(exception.recoverable).toBe(true);
      expect(exception.retryable).toBe(true);
    });
  });
});
