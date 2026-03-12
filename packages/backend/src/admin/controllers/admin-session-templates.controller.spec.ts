/**
 * Admin Session Templates Controller Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminSessionTemplatesController } from './admin-session-templates.controller';
import { TenantsService } from '../../tenants/tenants.service';
import { AuditService } from '../services/audit.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';
import type { RequestContext } from '../../auth/types';

const TENANT_ID = 'tenant-uuid-1234';

function makeTenant(sessionTemplates: Record<string, unknown> = {}, defaultSessionTemplate?: string) {
  return {
    id: TENANT_ID,
    config: {
      sessionTemplates,
      ...(defaultSessionTemplate ? { defaultSessionTemplate } : {}),
    },
  };
}

const mockCtx: RequestContext = { apiKeyId: 'admin-key-id' } as RequestContext;

describe('AdminSessionTemplatesController', () => {
  let controller: AdminSessionTemplatesController;
  let tenantsService: jest.Mocked<TenantsService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSessionTemplatesController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminSessionTemplatesController);
    tenantsService = module.get(TenantsService) as jest.Mocked<TenantsService>;
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;
  });

  // ---------------------------------------------------------------------------
  // listTemplates
  // ---------------------------------------------------------------------------

  describe('listTemplates', () => {
    it('returns templates and defaultTemplate from tenant config', async () => {
      const templates = { 'my-template': { description: 'Test' } };
      tenantsService.findOne.mockResolvedValue(
        makeTenant(templates, 'my-template') as any,
      );

      const result = await controller.listTemplates(TENANT_ID);

      expect(result.templates).toEqual(templates);
      expect(result.defaultTemplate).toBe('my-template');
    });

    it('returns empty object when tenant has no templates', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      const result = await controller.listTemplates(TENANT_ID);

      expect(result.templates).toEqual({});
      expect(result.defaultTemplate).toBeUndefined();
    });

    it('throws NotFoundException when tenant not found', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(controller.listTemplates(TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplate
  // ---------------------------------------------------------------------------

  describe('getTemplate', () => {
    it('returns the named template', async () => {
      const template = { description: 'Teacher template' };
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'teacher-view': template }) as any,
      );

      const result = await controller.getTemplate(TENANT_ID, 'teacher-view');

      expect(result).toEqual({ name: 'teacher-view', template });
    });

    it('throws NotFoundException when template not found', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      await expect(
        controller.getTemplate(TENANT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when tenant not found', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(
        controller.getTemplate(TENANT_ID, 'any-template'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // createTemplate
  // ---------------------------------------------------------------------------

  describe('createTemplate', () => {
    it('creates a new template and logs audit', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      const dto = {
        name: 'new-template',
        template: { description: 'New template' },
      };

      const result = await controller.createTemplate(TENANT_ID, dto as any, mockCtx);

      expect(result).toEqual({ name: 'new-template', template: dto.template });
      expect(tenantsService.update).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          config: expect.objectContaining({
            sessionTemplates: { 'new-template': dto.template },
          }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sessionTemplate.create' }),
      );
    });

    it('throws ConflictException when template already exists', async () => {
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'existing-template': {} }) as any,
      );

      await expect(
        controller.createTemplate(
          TENANT_ID,
          { name: 'existing-template', template: {} } as any,
          mockCtx,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when at template limit (50)', async () => {
      const templates: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        templates[`template-${i}`] = {};
      }
      tenantsService.findOne.mockResolvedValue(makeTenant(templates) as any);

      await expect(
        controller.createTemplate(
          TENANT_ID,
          { name: 'one-more', template: {} } as any,
          mockCtx,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('succeeds audit failure gracefully (no throw)', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);
      auditService.log.mockRejectedValue(new Error('audit DB down'));

      // Should not throw even if audit fails
      await expect(
        controller.createTemplate(
          TENANT_ID,
          { name: 'template-x', template: {} } as any,
          mockCtx,
        ),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // updateTemplate
  // ---------------------------------------------------------------------------

  describe('updateTemplate', () => {
    it('updates the template and logs audit', async () => {
      const original = { description: 'Old description' };
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'my-template': original }) as any,
      );

      const newTemplate = { description: 'New description' };
      const result = await controller.updateTemplate(
        TENANT_ID,
        'my-template',
        { template: newTemplate } as any,
        mockCtx,
      );

      expect(result).toEqual({ name: 'my-template', template: newTemplate });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sessionTemplate.update',
          metadata: expect.objectContaining({
            previousValue: original,
            newValue: newTemplate,
          }),
        }),
      );
    });

    it('throws NotFoundException when template not found', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      await expect(
        controller.updateTemplate(
          TENANT_ID,
          'nonexistent',
          { template: {} } as any,
          mockCtx,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTemplate
  // ---------------------------------------------------------------------------

  describe('deleteTemplate', () => {
    it('deletes the template and logs audit', async () => {
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'my-template': { description: 'Test' } }) as any,
      );

      const result = await controller.deleteTemplate(TENANT_ID, 'my-template', mockCtx);

      expect(result.message).toContain('my-template');
      expect(tenantsService.update).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          config: expect.objectContaining({
            sessionTemplates: {},
          }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sessionTemplate.delete' }),
      );
    });

    it('clears defaultSessionTemplate when deleting the default template', async () => {
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'default-tpl': {} }, 'default-tpl') as any,
      );

      await controller.deleteTemplate(TENANT_ID, 'default-tpl', mockCtx);

      const updateCall = tenantsService.update.mock.calls[0][1] as { config: Record<string, unknown> };
      expect(updateCall.config['defaultSessionTemplate']).toBeUndefined();
    });

    it('preserves defaultSessionTemplate when deleting a non-default template', async () => {
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'other-tpl': {}, 'default-tpl': {} }, 'default-tpl') as any,
      );

      await controller.deleteTemplate(TENANT_ID, 'other-tpl', mockCtx);

      const updateCall = tenantsService.update.mock.calls[0][1] as { config: Record<string, unknown> };
      expect(updateCall.config['defaultSessionTemplate']).toBe('default-tpl');
    });

    it('throws NotFoundException when template not found', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      await expect(
        controller.deleteTemplate(TENANT_ID, 'nonexistent', mockCtx),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // previewTemplate
  // ---------------------------------------------------------------------------

  describe('previewTemplate', () => {
    it('returns template and resolved params with no explicit params', async () => {
      const template = {
        enabledSkills: ['skill-a'],
        appendSystemPrompt: 'Base prompt',
        mcpServers: { 'server-1': { command: 'node', args: [] } },
      };
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'my-template': template }) as any,
      );

      const result = await controller.previewTemplate(TENANT_ID, 'my-template', {});

      expect(result.template).toEqual(template);
      expect(result.resolved.enabledSkills).toEqual(['skill-a']);
      expect(result.resolved.appendSystemPrompt).toBe('Base prompt');
    });

    it('merges explicit params with template config', async () => {
      const template = {
        appendSystemPrompt: 'Base prompt',
        mcpServers: { 'server-1': { command: 'node', args: [] } },
      };
      tenantsService.findOne.mockResolvedValue(
        makeTenant({ 'my-template': template }) as any,
      );

      const result = await controller.previewTemplate(TENANT_ID, 'my-template', {
        explicitParams: {
          appendSystemPrompt: 'Extra context',
          mcpServers: { 'server-2': { command: 'python', args: [] } },
        },
      });

      expect(result.resolved.appendSystemPrompt).toBe('Base prompt\n\nExtra context');
      expect(result.resolved.mcpServers).toEqual({
        'server-1': { command: 'node', args: [] },
        'server-2': { command: 'python', args: [] },
      });
    });

    it('throws NotFoundException when template not found', async () => {
      tenantsService.findOne.mockResolvedValue(makeTenant() as any);

      await expect(
        controller.previewTemplate(TENANT_ID, 'nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
