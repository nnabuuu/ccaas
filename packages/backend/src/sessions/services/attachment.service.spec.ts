import { BadRequestException } from '@nestjs/common';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  let service: AttachmentService;

  beforeEach(() => {
    service = new AttachmentService();
  });

  describe('resolveAttachments', () => {
    it('returns undefined for empty array', () => {
      expect(service.resolveAttachments([], '/workspace')).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(service.resolveAttachments(undefined, '/workspace')).toBeUndefined();
    });

    it('resolves relative paths to absolute paths within workspace', () => {
      const result = service.resolveAttachments(
        [{ type: 'image', path: 'photo.png' }],
        '/workspace/sessions/abc',
      );

      expect(result).toEqual([
        {
          type: 'image',
          absolutePath: '/workspace/sessions/abc/photo.png',
          mimeType: 'image/png',
        },
      ]);
    });

    it('resolves nested paths', () => {
      const result = service.resolveAttachments(
        [{ type: 'document', path: 'uploads/doc.pdf' }],
        '/workspace',
      );

      expect(result).toEqual([
        {
          type: 'document',
          absolutePath: '/workspace/uploads/doc.pdf',
          mimeType: 'application/pdf',
        },
      ]);
    });

    // ── Path traversal protection ──────────────────────────────────────────

    it('throws on path traversal with ../', () => {
      expect(() =>
        service.resolveAttachments(
          [{ type: 'image', path: '../../etc/passwd' }],
          '/workspace/sessions/abc',
        ),
      ).toThrow(BadRequestException);
    });

    it('throws on path traversal with absolute path', () => {
      expect(() =>
        service.resolveAttachments(
          [{ type: 'image', path: '/etc/passwd' }],
          '/workspace/sessions/abc',
        ),
      ).toThrow(BadRequestException);
    });

    it('allows paths that look like traversal but resolve inside workspace', () => {
      const result = service.resolveAttachments(
        [{ type: 'image', path: 'subdir/../photo.png' }],
        '/workspace',
      );

      expect(result![0].absolutePath).toBe('/workspace/photo.png');
    });
  });

  describe('guessMimeType', () => {
    it('returns correct MIME for common image types', () => {
      expect(service.guessMimeType('photo.png')).toBe('image/png');
      expect(service.guessMimeType('photo.jpg')).toBe('image/jpeg');
      expect(service.guessMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(service.guessMimeType('photo.webp')).toBe('image/webp');
      expect(service.guessMimeType('photo.gif')).toBe('image/gif');
    });

    it('returns application/octet-stream for unknown extensions', () => {
      expect(service.guessMimeType('file.xyz')).toBe('application/octet-stream');
    });
  });

  describe('validateAttachmentPaths', () => {
    it('does not throw for valid paths', () => {
      expect(() =>
        service.validateAttachmentPaths(
          [{ type: 'image', path: 'photo.png' }],
          '/workspace',
        ),
      ).not.toThrow();
    });

    it('throws for path traversal', () => {
      expect(() =>
        service.validateAttachmentPaths(
          [{ type: 'image', path: '../../etc/passwd' }],
          '/workspace',
        ),
      ).toThrow(BadRequestException);
    });
  });
});
