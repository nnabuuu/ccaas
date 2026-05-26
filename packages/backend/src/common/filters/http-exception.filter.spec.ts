/**
 * Global HTTP Exception Filter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './http-exception.filter';
import {
  ProtocolHttpException,
  ValidationException,
  SkillNotFoundException,
  AlreadyExistsException,
  RateLimitedException,
  SessionExpiredException,
} from '../../protocol/http-exceptions';

describe('GlobalHttpExceptionFilter', () => {
  let filter: GlobalHttpExceptionFilter;

  const mockRequest = {
    path: '/api/test',
    method: 'GET',
    headers: {},
    ip: '127.0.0.1',
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const mockHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as any;

  beforeEach(async () => {
    filter = new GlobalHttpExceptionFilter();
    jest.clearAllMocks();
  });

  describe('ProtocolHttpException', () => {
    it('should handle ValidationException', () => {
      const exception = new ValidationException('Invalid input', ['email']);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400,
          recoverable: false,
          retryable: false,
          failedFields: ['email'],
          path: '/api/test',
        }),
      );
    });

    it('should handle SkillNotFoundException', () => {
      const exception = new SkillNotFoundException('skill-123');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SKILL_NOT_FOUND',
          message: 'Skill not found: skill-123',
          statusCode: 404,
          path: '/api/test',
        }),
      );
    });

    it('should handle AlreadyExistsException', () => {
      const exception = new AlreadyExistsException("Solution with slug 'test' already exists");

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ALREADY_EXISTS',
          message: "Solution with slug 'test' already exists",
          statusCode: 409,
          recoverable: false,
          retryable: false,
          path: '/api/test',
        }),
      );
    });

    it('should handle RateLimitedException with retry info', () => {
      const exception = new RateLimitedException(30000);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMITED',
          statusCode: 429,
          retryable: true,
          recoverable: true,
          retryAfterMs: 30000,
        }),
      );
    });
  });

  describe('NestJS HttpException', () => {
    it('should handle BadRequestException', () => {
      const exception = new BadRequestException('Bad request');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Bad request',
          statusCode: 400,
          path: '/api/test',
        }),
      );
    });

    it('should handle UnauthorizedException', () => {
      const exception = new UnauthorizedException();

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SESSION_EXPIRED',
          statusCode: 401,
          path: '/api/test',
        }),
      );
    });

    it('should handle HttpException with array message', () => {
      const exception = new BadRequestException(['error1', 'error2']);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'error1, error2',
        }),
      );
    });
  });

  describe('Custom domain errors', () => {
    it('should handle SessionExpiredException', () => {
      const exception = new SessionExpiredException('Invalid token');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SESSION_EXPIRED',
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });

    it('should handle RateLimitedException', () => {
      const exception = new RateLimitedException(60000);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMITED',
          statusCode: 429,
          retryAfterMs: 60000,
        }),
      );
    });

    it('should handle custom error with statusCode', () => {
      const exception = {
        message: 'Custom error',
        statusCode: 418,
        code: 'CUSTOM_ERROR',
      };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(418);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom error',
          statusCode: 418,
        }),
      );
    });
  });

  describe('Uncaught errors', () => {
    it('should handle Error objects', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error',
          statusCode: 500,
          recoverable: false,
          retryable: false,
        }),
      );
    });

    it('should handle non-Error exceptions', () => {
      const exception = 'String error';

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500,
        }),
      );
    });
  });

  describe('Request context', () => {
    it('should include request ID from header', () => {
      const mockRequestWithId = {
        ...mockRequest,
        headers: { 'x-request-id': 'custom-req-id' },
      };

      const mockHostWithId = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequestWithId,
        }),
      } as any;

      const exception = new ValidationException('Test');

      filter.catch(exception, mockHostWithId);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'custom-req-id',
        }),
      );
    });

    it('should generate request ID if not provided', () => {
      const exception = new ValidationException('Test');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
        }),
      );
    });

    it('should include timestamp', () => {
      const exception = new ValidationException('Test');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });
  });

  describe('Retryable logic', () => {
    it('should mark 5xx errors as retryable', () => {
      const exception = new HttpException('Server error', 500);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryable: true,
        }),
      );
    });

    it('should mark 429 as retryable', () => {
      const exception = new HttpException('Rate limited', 429);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryable: true,
        }),
      );
    });

    it('should not mark 4xx errors as retryable (except 429)', () => {
      const exception = new BadRequestException();

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryable: false,
        }),
      );
    });
  });
});
