import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LessonController } from './lesson.controller';
import * as fs from 'fs';

jest.mock('fs');

const mockLessonService = {
  findAll: jest.fn().mockReturnValue([{ id: 'lesson-1' }]),
  findManifest: jest.fn().mockReturnValue({ id: 'lesson-1', title: 'Test' }),
};

function createMockRes() {
  const res: any = {};
  res.setHeader = jest.fn();
  return res;
}

const fakeStream = { pipe: jest.fn() };

describe('LessonController', () => {
  let controller: LessonController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new LessonController(mockLessonService as any);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.createReadStream as jest.Mock).mockReturnValue(fakeStream);
  });

  // --- findAll / findManifest ---

  it('findAll delegates to service', () => {
    expect(controller.findAll()).toEqual([{ id: 'lesson-1' }]);
  });

  it('findManifest delegates to service', () => {
    expect(controller.findManifest('lesson-1')).toEqual({ id: 'lesson-1', title: 'Test' });
  });

  // --- getAudio ---

  it('getAudio rejects invalid lesson ID', () => {
    const res = createMockRes();
    expect(() => controller.getAudio('../bad', 'file.mp3', res)).toThrow(BadRequestException);
  });

  it('getAudio rejects invalid filename', () => {
    const res = createMockRes();
    expect(() => controller.getAudio('lesson-1', 'BAD.exe', res)).toThrow(BadRequestException);
  });

  it('getAudio throws 404 when file missing', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const res = createMockRes();
    expect(() => controller.getAudio('lesson-1', 'intro.mp3', res)).toThrow(NotFoundException);
  });

  it('getAudio streams mp3 with correct headers', () => {
    const res = createMockRes();
    controller.getAudio('lesson-1', 'intro.mp3', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    expect(fakeStream.pipe).toHaveBeenCalledWith(res);
  });

  it('getAudio streams wav with correct content-type', () => {
    const res = createMockRes();
    controller.getAudio('lesson-1', 'clip.wav', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav');
  });

  // --- getResource ---

  it('getResource rejects invalid lesson ID', () => {
    const res = createMockRes();
    expect(() => controller.getResource('../hack', 'img.png', res)).toThrow(BadRequestException);
  });

  it('getResource rejects ID with underscores', () => {
    const res = createMockRes();
    expect(() => controller.getResource('bad_id', 'img.png', res)).toThrow(BadRequestException);
  });

  it('getResource rejects invalid filename (no extension)', () => {
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', 'noext', res)).toThrow(BadRequestException);
  });

  it('getResource rejects disallowed extension', () => {
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', 'file.exe', res)).toThrow(BadRequestException);
  });

  it('getResource rejects path traversal in filename', () => {
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', '../etc/passwd.png', res)).toThrow(BadRequestException);
  });

  it('getResource throws 404 when file missing', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', 'missing.png', res)).toThrow(NotFoundException);
  });

  it('getResource streams png with correct headers', () => {
    const res = createMockRes();
    controller.getResource('lesson-1', '1_01_scene_square_plot.png', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    expect(fakeStream.pipe).toHaveBeenCalledWith(res);
  });

  it('getResource streams jpg with correct mime', () => {
    const res = createMockRes();
    controller.getResource('lesson-1', 'photo.jpg', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
  });

  it('getResource rejects svg (XSS risk)', () => {
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', 'diagram.svg', res)).toThrow(BadRequestException);
  });

  it('getResource rejects filename with dots in stem', () => {
    const res = createMockRes();
    expect(() => controller.getResource('lesson-1', 'img.bak.png', res)).toThrow(BadRequestException);
  });

  it('getResource allows uppercase and underscores in filename', () => {
    const res = createMockRes();
    // Should NOT throw
    controller.getResource('lesson-1', 'My_Image-01.webp', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
  });
});
