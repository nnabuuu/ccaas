/**
 * BundleService Unit Tests
 */

import { BundleService } from './bundle.service';
import { BUILTIN_BUNDLES } from './bundle-registry';

describe('BundleService', () => {
  let service: BundleService;

  beforeEach(() => {
    service = new BundleService();
  });

  describe('getAvailableBundles', () => {
    it('returns all built-in bundles', () => {
      const bundles = service.getAvailableBundles();
      expect(bundles.length).toBe(Object.keys(BUILTIN_BUNDLES).length);
      expect(bundles.map(b => b.id)).toContain('structured-output');
      expect(bundles.map(b => b.id)).toContain('file-attachments');
      expect(bundles.map(b => b.id)).toContain('shared-context');
    });
  });

  describe('getBundle', () => {
    it('returns bundle by ID', () => {
      const bundle = service.getBundle('structured-output');
      expect(bundle).toBeDefined();
      expect(bundle!.id).toBe('structured-output');
    });

    it('returns undefined for unknown ID', () => {
      expect(service.getBundle('nonexistent')).toBeUndefined();
    });
  });

  describe('validateBundleSubset', () => {
    it('returns empty array when all requested bundles are enabled', () => {
      const invalid = service.validateBundleSubset(
        ['structured-output'],
        ['structured-output', 'file-attachments'],
      );
      expect(invalid).toEqual([]);
    });

    it('returns IDs not in tenant-enabled set', () => {
      const invalid = service.validateBundleSubset(
        ['structured-output', 'file-attachments'],
        ['structured-output'],
      );
      expect(invalid).toEqual(['file-attachments']);
    });
  });

  describe('resolveActiveBundles', () => {
    it('uses all tenant-enabled bundles when templateBundles is undefined', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['structured-output', 'file-attachments'],
      );
      expect(result.activeBundleIds).toEqual(['structured-output', 'file-attachments']);
      expect(result.toolEventTriggers).toHaveLength(2);
    });

    it('filters template bundles to tenant-enabled subset', () => {
      const result = service.resolveActiveBundles(
        ['structured-output', 'file-attachments'],
        ['structured-output'], // only structured-output enabled
      );
      expect(result.activeBundleIds).toEqual(['structured-output']);
      expect(result.toolEventTriggers).toHaveLength(1);
      expect(result.toolEventTriggers[0].toolName).toBe('write_output');
    });

    it('skips unknown bundle IDs with warning (no crash)', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['structured-output', 'nonexistent-bundle'],
      );
      expect(result.activeBundleIds).toEqual(['structured-output']);
    });

    it('collects MCP servers from file-attachments bundle', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['file-attachments'],
      );
      expect(result.mcpServers).toHaveProperty('bundle:file-attachments');
      const server = result.mcpServers['bundle:file-attachments'];
      expect(server.command).toBe('node');
      // Args should have ${CORE_MCP_DIR} resolved
      expect(server.args[0]).not.toContain('${CORE_MCP_DIR}');
      expect(server.args[0]).toContain('attach-file-server');
    });

    it('does not include MCP servers for structured-output (no mcpServer)', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['structured-output'],
      );
      expect(Object.keys(result.mcpServers)).toHaveLength(0);
    });

    it('returns empty result when no bundles enabled', () => {
      const result = service.resolveActiveBundles(undefined, []);
      expect(result.activeBundleIds).toEqual([]);
      expect(result.toolEventTriggers).toEqual([]);
      expect(result.mcpServers).toEqual({});
      expect(result.appendSystemPrompts).toEqual([]);
    });

    it('collects MCP servers from shared-context bundle', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['shared-context'],
      );
      expect(result.mcpServers).toHaveProperty('bundle:shared-context');
      const server = result.mcpServers['bundle:shared-context'];
      expect(server.command).toBe('node');
      expect(server.args[0]).not.toContain('${CORE_MCP_DIR}');
      expect(server.args[0]).toContain('shared-context-server');
    });

    it('shared-context bundle has no toolEventTriggers', () => {
      const result = service.resolveActiveBundles(
        undefined,
        ['shared-context'],
      );
      expect(result.toolEventTriggers).toHaveLength(0);
    });

    it('collects appendSystemPrompts from active bundles', () => {
      // Built-in bundles don't have appendSystemPrompt, test with mock
      const originalBundle = BUILTIN_BUNDLES['structured-output'];
      BUILTIN_BUNDLES['structured-output'] = {
        ...originalBundle,
        appendSystemPrompt: 'Use write_output to sync data.',
      };

      try {
        const result = service.resolveActiveBundles(undefined, ['structured-output']);
        expect(result.appendSystemPrompts).toEqual(['Use write_output to sync data.']);
      } finally {
        // Restore
        BUILTIN_BUNDLES['structured-output'] = originalBundle;
      }
    });
  });
});
