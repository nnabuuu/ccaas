import { BadRequestException } from '@nestjs/common';

const CODE_RE = /^[A-Z2-9]{6}$/;

export function validateCode(code: string): string {
  const upper = code.toUpperCase();
  if (!CODE_RE.test(upper)) {
    throw new BadRequestException('Invalid session code format');
  }
  return upper;
}
