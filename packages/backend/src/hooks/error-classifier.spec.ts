/**
 * Error Classifier Tests
 *
 * TDD tests for classifyToolError function.
 */

import { classifyToolError, ToolErrorType } from './error-classifier';

describe('classifyToolError', () => {
  describe('file_not_found classification', () => {
    it('should classify ENOENT as file_not_found', () => {
      expect(classifyToolError('Error: ENOENT: no such file or directory')).toBe('file_not_found');
    });

    it('should classify "no such file" as file_not_found', () => {
      expect(classifyToolError('no such file or directory')).toBe('file_not_found');
    });

    it('should classify "file not found" as file_not_found', () => {
      expect(classifyToolError('Error: file not found at /path/to/file')).toBe('file_not_found');
    });

    it('should classify ENOENT with path as file_not_found', () => {
      expect(classifyToolError("Error: ENOENT: no such file or directory, open '/test/file.txt'")).toBe('file_not_found');
    });
  });

  describe('permission_denied classification', () => {
    it('should classify EACCES as permission_denied', () => {
      expect(classifyToolError('Error: EACCES: permission denied')).toBe('permission_denied');
    });

    it('should classify "permission denied" as permission_denied', () => {
      expect(classifyToolError('permission denied: /root/secret')).toBe('permission_denied');
    });

    it('should classify "access denied" as permission_denied', () => {
      expect(classifyToolError('Access denied to resource')).toBe('permission_denied');
    });

    it('should classify EPERM as permission_denied', () => {
      expect(classifyToolError('Error: EPERM: operation not permitted')).toBe('permission_denied');
    });
  });

  describe('timeout classification', () => {
    it('should classify ETIMEDOUT as timeout', () => {
      expect(classifyToolError('Error: ETIMEDOUT')).toBe('timeout');
    });

    it('should classify "timed out" as timeout', () => {
      expect(classifyToolError('Command timed out after 30000ms')).toBe('timeout');
    });

    it('should classify "timeout" as timeout', () => {
      expect(classifyToolError('Request timeout exceeded')).toBe('timeout');
    });

    it('should classify "time out" (with space) as timeout', () => {
      expect(classifyToolError('Operation time out')).toBe('timeout');
    });
  });

  describe('command_failed classification', () => {
    it('should classify "exit code" as command_failed', () => {
      expect(classifyToolError('Command failed with exit code 1')).toBe('command_failed');
    });

    it('should classify non-zero exit code as command_failed', () => {
      expect(classifyToolError('Process exited with exit code 127')).toBe('command_failed');
    });

    it('should classify "command not found" as command_failed', () => {
      expect(classifyToolError('bash: nonexistent: command not found')).toBe('command_failed');
    });

    it('should classify "command failed" as command_failed', () => {
      expect(classifyToolError('Command failed: git status')).toBe('command_failed');
    });
  });

  describe('network_error classification', () => {
    it('should classify ECONNREFUSED as network_error', () => {
      expect(classifyToolError('Error: connect ECONNREFUSED 127.0.0.1:3000')).toBe('network_error');
    });

    it('should classify ENOTFOUND as network_error', () => {
      expect(classifyToolError('Error: getaddrinfo ENOTFOUND example.com')).toBe('network_error');
    });

    it('should classify "connection refused" as network_error', () => {
      expect(classifyToolError('Connection refused by server')).toBe('network_error');
    });

    it('should classify socket errors as network_error', () => {
      expect(classifyToolError('Socket error: connection reset')).toBe('network_error');
    });

    it('should classify getaddrinfo errors as network_error', () => {
      expect(classifyToolError('getaddrinfo EAI_AGAIN example.com')).toBe('network_error');
    });

    it('should classify ECONNRESET as network_error', () => {
      expect(classifyToolError('Error: read ECONNRESET')).toBe('network_error');
    });
  });

  describe('parse_error classification', () => {
    it('should classify SyntaxError as parse_error', () => {
      expect(classifyToolError('SyntaxError: Unexpected token')).toBe('parse_error');
    });

    it('should classify JSON parse errors as parse_error', () => {
      expect(classifyToolError('JSON.parse error: Unexpected end of input')).toBe('parse_error');
    });

    it('should classify "invalid json" as parse_error', () => {
      expect(classifyToolError('Invalid JSON response')).toBe('parse_error');
    });

    it('should classify "unexpected token" as parse_error', () => {
      expect(classifyToolError('Unexpected token < in JSON at position 0')).toBe('parse_error');
    });

    it('should classify YAML parse errors as parse_error', () => {
      expect(classifyToolError('YAMLException: bad indentation')).toBe('parse_error');
    });
  });

  describe('validation_error classification', () => {
    it('should classify "validation error" as validation_error', () => {
      expect(classifyToolError('Validation error: required field missing')).toBe('validation_error');
    });

    it('should classify "invalid argument" as validation_error', () => {
      expect(classifyToolError('Invalid argument: file_path must be absolute')).toBe('validation_error');
    });

    it('should classify "required field" as validation_error', () => {
      expect(classifyToolError('Required field "name" is missing')).toBe('validation_error');
    });

    it('should classify "must be" with validation context as validation_error', () => {
      expect(classifyToolError('Parameter must be a string')).toBe('validation_error');
    });

    it('should classify "invalid parameter" as validation_error', () => {
      expect(classifyToolError('Invalid parameter value')).toBe('validation_error');
    });
  });

  describe('unknown classification', () => {
    it('should return unknown for unrecognized errors', () => {
      expect(classifyToolError('Something unexpected happened')).toBe('unknown');
    });

    it('should return unknown for empty strings', () => {
      expect(classifyToolError('')).toBe('unknown');
    });

    it('should return unknown for generic errors', () => {
      expect(classifyToolError('Error occurred during processing')).toBe('unknown');
    });
  });

  describe('object error content', () => {
    it('should handle object error content with .error property', () => {
      const errorObj = { error: 'Error: ENOENT: no such file or directory' };
      expect(classifyToolError(errorObj)).toBe('file_not_found');
    });

    it('should handle object error content with .message property', () => {
      const errorObj = { message: 'permission denied' };
      expect(classifyToolError(errorObj)).toBe('permission_denied');
    });

    it('should handle nested error objects', () => {
      const errorObj = { error: { message: 'ETIMEDOUT' } };
      expect(classifyToolError(errorObj)).toBe('timeout');
    });

    it('should handle object with code property', () => {
      const errorObj = { code: 'ECONNREFUSED', message: 'Connection refused' };
      expect(classifyToolError(errorObj)).toBe('network_error');
    });
  });

  describe('undefined and null input', () => {
    it('should handle undefined input', () => {
      expect(classifyToolError(undefined)).toBe('unknown');
    });

    it('should handle null input', () => {
      expect(classifyToolError(null)).toBe('unknown');
    });

    it('should handle number input', () => {
      expect(classifyToolError(42 as unknown as string)).toBe('unknown');
    });

    it('should handle boolean input', () => {
      expect(classifyToolError(false as unknown as string)).toBe('unknown');
    });
  });

  describe('case insensitivity', () => {
    it('should classify uppercase ENOENT', () => {
      expect(classifyToolError('ERROR: ENOENT')).toBe('file_not_found');
    });

    it('should classify lowercase eacces', () => {
      expect(classifyToolError('error: eacces')).toBe('permission_denied');
    });

    it('should classify mixed case Timeout', () => {
      expect(classifyToolError('Request Timeout')).toBe('timeout');
    });
  });

  describe('priority of classification', () => {
    it('should prioritize file_not_found over command_failed', () => {
      // "not found" appears in both patterns, but file_not_found should match first
      expect(classifyToolError('Error: ENOENT: no such file or directory, stat')).toBe('file_not_found');
    });

    it('should classify command exit code even with other text', () => {
      expect(classifyToolError('npm ERR! code 1\nnpm ERR! command failed')).toBe('command_failed');
    });
  });
});
