/**
 * McpPoolService - Core CRUD Tests
 *
 * Tests for MCP server create() with duplicate slug detection.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { McpPoolService } from './mcp-pool.service';
import { McpServer } from './entities/mcp-server.entity';
import { RestAdapterService } from './rest-adapter.service';
import { AlreadyExistsException } from '../protocol/http-exceptions';

describe('McpPoolService', () => {
  let service: McpPoolService;
  let mcpServerRepo: Record<string, jest.Mock>;

  const solutionId = 'tenant-1';

  beforeEach(async () => {
    mcpServerRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
      ),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpPoolService,
        { provide: getRepositoryToken(McpServer), useValue: mcpServerRepo },
        { provide: RestAdapterService, useValue: { createAdapter: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(0) } },
      ],
    }).compile();

    service = module.get<McpPoolService>(McpPoolService);
  });

  afterEach(() => {
    service.shutdown();
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const createDto = {
      name: 'My MCP Server',
      slug: 'my-mcp-server',
      type: 'custom' as const,
      config: {},
    };

    it('should create an MCP server successfully when slug is unique', async () => {
      mcpServerRepo.findOne.mockResolvedValue(null);

      const result = await service.create(solutionId, createDto);

      expect(mcpServerRepo.findOne).toHaveBeenCalledWith({
        where: { solutionId, slug: 'my-mcp-server' },
      });
      expect(mcpServerRepo.create).toHaveBeenCalled();
      expect(mcpServerRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('name', 'My MCP Server');
    });

    it('should throw AlreadyExistsException when slug already exists', async () => {
      mcpServerRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        solutionId,
        slug: 'my-mcp-server',
        name: 'Existing Server',
      });

      await expect(service.create(solutionId, createDto)).rejects.toThrow(AlreadyExistsException);

      expect(mcpServerRepo.create).not.toHaveBeenCalled();
      expect(mcpServerRepo.save).not.toHaveBeenCalled();
    });

    it('should include slug in AlreadyExistsException message', async () => {
      mcpServerRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        solutionId,
        slug: 'my-mcp-server',
        name: 'Existing Server',
      });

      await expect(service.create(solutionId, createDto)).rejects.toThrow(/my-mcp-server/);
    });

    it('should generate slug from name when slug is not provided', async () => {
      mcpServerRepo.findOne.mockResolvedValue(null);

      await service.create(solutionId, {
        name: 'Weather API',
        type: 'custom' as const,
        config: {},
      });

      expect(mcpServerRepo.findOne).toHaveBeenCalledWith({
        where: { solutionId, slug: 'weather-api' },
      });
    });
  });
});
