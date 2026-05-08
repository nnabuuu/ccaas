import { BadRequestException } from '@nestjs/common';
import { validateCode } from './validate-code';

describe('validateCode', () => {
  it('returns uppercase for valid lowercase code', () => {
    expect(validateCode('abc234')).toBe('ABC234');
  });

  it('accepts valid uppercase code as-is', () => {
    expect(validateCode('HX3KM7')).toBe('HX3KM7');
  });

  it('accepts all digits 2-9', () => {
    expect(validateCode('234567')).toBe('234567');
    expect(validateCode('AAAAAA')).toBe('AAAAAA');
  });

  it('rejects code with 0 (ambiguous character)', () => {
    expect(() => validateCode('ABC0DE')).toThrow(BadRequestException);
  });

  it('rejects code with 1 (ambiguous character)', () => {
    expect(() => validateCode('ABC1DE')).toThrow(BadRequestException);
  });

  it('rejects code shorter than 6 characters', () => {
    expect(() => validateCode('ABC23')).toThrow(BadRequestException);
  });

  it('rejects code longer than 6 characters', () => {
    expect(() => validateCode('ABC2345')).toThrow(BadRequestException);
  });

  it('rejects code with special characters', () => {
    expect(() => validateCode('ABC-23')).toThrow(BadRequestException);
  });

  it('rejects empty string', () => {
    expect(() => validateCode('')).toThrow(BadRequestException);
  });
});
