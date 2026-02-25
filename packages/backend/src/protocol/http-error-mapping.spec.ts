/**
 * HTTP Error Mapping Tests
 */

import {
  getHttpStatus,
  isClientError,
  isServerError,
  httpStatusToErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
} from './http-error-mapping';
import type { ErrorCode } from './errors';

describe('http-error-mapping', () => {
  describe('ERROR_CODE_TO_HTTP_STATUS', () => {
    it('should map all error codes to HTTP status', () => {
      const errorCodes: ErrorCode[] = [
        'VALIDATION_ERROR',
        'PERMISSION_DENIED',
        'NOT_FOUND',
        'SKILL_NOT_FOUND',
        'SESSION_EXPIRED',
        'RATE_LIMITED',
        'TIMEOUT',
        'INTERNAL_ERROR',
        'CLI_ERROR',
        'CONNECTION_LOST',
        'MCP_ERROR',
        'INVALID_OUTPUT',
        'PARTIAL_FAILURE',
      ];

      errorCodes.forEach((code) => {
        expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeDefined();
        expect(typeof ERROR_CODE_TO_HTTP_STATUS[code]).toBe('number');
      });
    });

    it('should map client errors to 4xx status codes', () => {
      expect(ERROR_CODE_TO_HTTP_STATUS.VALIDATION_ERROR).toBe(400);
      expect(ERROR_CODE_TO_HTTP_STATUS.SESSION_EXPIRED).toBe(401);
      expect(ERROR_CODE_TO_HTTP_STATUS.PERMISSION_DENIED).toBe(403);
      expect(ERROR_CODE_TO_HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(ERROR_CODE_TO_HTTP_STATUS.SKILL_NOT_FOUND).toBe(404);
      expect(ERROR_CODE_TO_HTTP_STATUS.RATE_LIMITED).toBe(429);
    });

    it('should map server errors to 5xx status codes', () => {
      expect(ERROR_CODE_TO_HTTP_STATUS.INTERNAL_ERROR).toBe(500);
      expect(ERROR_CODE_TO_HTTP_STATUS.CLI_ERROR).toBe(500);
      expect(ERROR_CODE_TO_HTTP_STATUS.INVALID_OUTPUT).toBe(500);
      expect(ERROR_CODE_TO_HTTP_STATUS.PARTIAL_FAILURE).toBe(500);
      expect(ERROR_CODE_TO_HTTP_STATUS.MCP_ERROR).toBe(502);
      expect(ERROR_CODE_TO_HTTP_STATUS.CONNECTION_LOST).toBe(503);
      expect(ERROR_CODE_TO_HTTP_STATUS.TIMEOUT).toBe(504);
    });
  });

  describe('getHttpStatus', () => {
    it('should return correct status for error codes', () => {
      expect(getHttpStatus('VALIDATION_ERROR')).toBe(400);
      expect(getHttpStatus('SESSION_EXPIRED')).toBe(401);
      expect(getHttpStatus('PERMISSION_DENIED')).toBe(403);
      expect(getHttpStatus('SKILL_NOT_FOUND')).toBe(404);
      expect(getHttpStatus('RATE_LIMITED')).toBe(429);
      expect(getHttpStatus('INTERNAL_ERROR')).toBe(500);
      expect(getHttpStatus('MCP_ERROR')).toBe(502);
      expect(getHttpStatus('CONNECTION_LOST')).toBe(503);
      expect(getHttpStatus('TIMEOUT')).toBe(504);
    });

    it('should return 500 for unknown error codes', () => {
      const unknownCode = 'UNKNOWN_ERROR' as ErrorCode;
      expect(getHttpStatus(unknownCode)).toBe(500);
    });
  });

  describe('isClientError', () => {
    it('should return true for client error codes', () => {
      expect(isClientError('VALIDATION_ERROR')).toBe(true);
      expect(isClientError('SESSION_EXPIRED')).toBe(true);
      expect(isClientError('PERMISSION_DENIED')).toBe(true);
      expect(isClientError('NOT_FOUND')).toBe(true);
      expect(isClientError('SKILL_NOT_FOUND')).toBe(true);
      expect(isClientError('RATE_LIMITED')).toBe(true);
    });

    it('should return false for server error codes', () => {
      expect(isClientError('INTERNAL_ERROR')).toBe(false);
      expect(isClientError('CLI_ERROR')).toBe(false);
      expect(isClientError('MCP_ERROR')).toBe(false);
      expect(isClientError('CONNECTION_LOST')).toBe(false);
      expect(isClientError('TIMEOUT')).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should return true for server error codes', () => {
      expect(isServerError('INTERNAL_ERROR')).toBe(true);
      expect(isServerError('CLI_ERROR')).toBe(true);
      expect(isServerError('MCP_ERROR')).toBe(true);
      expect(isServerError('CONNECTION_LOST')).toBe(true);
      expect(isServerError('TIMEOUT')).toBe(true);
      expect(isServerError('INVALID_OUTPUT')).toBe(true);
      expect(isServerError('PARTIAL_FAILURE')).toBe(true);
    });

    it('should return false for client error codes', () => {
      expect(isServerError('VALIDATION_ERROR')).toBe(false);
      expect(isServerError('SESSION_EXPIRED')).toBe(false);
      expect(isServerError('PERMISSION_DENIED')).toBe(false);
      expect(isServerError('SKILL_NOT_FOUND')).toBe(false);
      expect(isServerError('RATE_LIMITED')).toBe(false);
    });
  });

  describe('httpStatusToErrorCode', () => {
    it('should map HTTP status to error codes', () => {
      expect(httpStatusToErrorCode(400)).toBe('VALIDATION_ERROR');
      expect(httpStatusToErrorCode(401)).toBe('SESSION_EXPIRED');
      expect(httpStatusToErrorCode(403)).toBe('PERMISSION_DENIED');
      expect(httpStatusToErrorCode(404)).toBe('NOT_FOUND');
      expect(httpStatusToErrorCode(429)).toBe('RATE_LIMITED');
      expect(httpStatusToErrorCode(502)).toBe('MCP_ERROR');
      expect(httpStatusToErrorCode(503)).toBe('CONNECTION_LOST');
      expect(httpStatusToErrorCode(504)).toBe('TIMEOUT');
    });

    it('should default to INTERNAL_ERROR for unmapped status codes', () => {
      expect(httpStatusToErrorCode(500)).toBe('INTERNAL_ERROR');
      expect(httpStatusToErrorCode(501)).toBe('INTERNAL_ERROR');
      expect(httpStatusToErrorCode(505)).toBe('INTERNAL_ERROR');
      expect(httpStatusToErrorCode(999)).toBe('INTERNAL_ERROR');
    });
  });
});
