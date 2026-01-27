/**
 * Parse ID or Slug Pipe
 *
 * Validates that a parameter is either a valid UUID or a valid slug.
 * Used for endpoints that accept both ID and slug lookups.
 */

import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Slug pattern: lowercase letters, numbers, and hyphens, 1-100 chars
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/;

@Injectable()
export class ParseIdOrSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('ID or slug is required');
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new BadRequestException('ID or slug cannot be empty');
    }

    if (trimmed.length > 100) {
      throw new BadRequestException('ID or slug is too long (max 100 characters)');
    }

    // Check if it's a valid UUID
    if (UUID_REGEX.test(trimmed)) {
      return trimmed;
    }

    // Check if it's a valid slug
    if (SLUG_REGEX.test(trimmed)) {
      return trimmed;
    }

    throw new BadRequestException(
      'Invalid ID or slug format. Must be a valid UUID or a slug (lowercase letters, numbers, and hyphens)',
    );
  }
}
