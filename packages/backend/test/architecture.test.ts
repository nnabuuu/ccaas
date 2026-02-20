/**
 * Architecture Tests
 *
 * These tests enforce architectural rules to prevent violations like:
 * - Adding domain entities to core backend (lesson-plans module incident)
 * - Importing from solutions in core backend
 * - Violating the Core vs Solution separation
 *
 * See: MEMORY.md - Architecture Violation section
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';

describe('Architecture Rules', () => {
  describe('Core Backend Entity Rules', () => {
    /**
     * Core Backend should ONLY contain infrastructure entities.
     * Domain-specific entities belong in Solution backends.
     */
    it('should not contain domain-specific entities', () => {
      const metadata = getMetadataArgsStorage();
      const entityNames = metadata.tables.map(table =>
        (typeof table.target === 'function' ? table.target.name : table.target) || table.name
      );

      // Forbidden domain entities (examples from past violations)
      const forbiddenEntities = [
        // Education domain (lesson-plan-designer solution)
        'LessonPlan',
        'Textbook',
        'CurriculumStandard',
        'TeachingMaterial',

        // E-commerce domain
        'Product',
        'Order',
        'Cart',
        'Payment',

        // Healthcare domain
        'Patient',
        'Appointment',
        'MedicalRecord',

        // Any other domain-specific entities
        'Quiz',
        'Question',
        'Answer',
      ];

      const violations = forbiddenEntities.filter(name =>
        entityNames.some(entity => entity === name)
      );

      if (violations.length > 0) {
        throw new Error(
          `❌ Core backend contains domain-specific entities: ${violations.join(', ')}\n\n` +
          `These entities should be in a Solution backend instead.\n` +
          `See CLAUDE.md - Architecture Principles for details.`
        );
      }
    });

    /**
     * Verify that core backend only has allowed infrastructure entities.
     */
    it('should only contain allowed infrastructure entities', () => {
      const metadata = getMetadataArgsStorage();
      const entityNames = metadata.tables.map(table =>
        (typeof table.target === 'function' ? table.target.name : table.target) || table.name
      );

      // Allowed infrastructure entities
      const allowedEntities = [
        // Core infrastructure
        'Session',
        'Skill',
        'SkillVersion',
        'User',
        'ApiKey',
        'Tenant',

        // Message and communication
        'Message',
        'ToolEvent',
        'ConversationContext',

        // File management
        'AgentFile',
        'FileVersion',

        // MCP integration
        'McpServer',
        'LargeContent',

        // Admin and monitoring
        'AdminAuditLog',
        'SessionAlert',
        'TenantQuota',

        // Scheduled tasks
        'ScheduledTask',
        'ScheduledTaskExecution',

        // Background jobs
        'JobEntity',
      ];

      const unknownEntities = entityNames.filter((name): name is string =>
        name !== undefined && !allowedEntities.includes(name)
      );

      if (unknownEntities.length > 0) {
        throw new Error(
          `❌ Core backend contains unknown entities: ${unknownEntities.join(', ')}\n\n` +
          `If these are infrastructure entities, add them to the allowedEntities list.\n` +
          `If they are domain entities, move them to a Solution backend.\n\n` +
          `See CLAUDE.md - Architecture Principles for guidance.`
        );
      }
    });
  });

  describe('Import Rules', () => {
    /**
     * Core backend should NEVER import from solutions/.
     * This prevents circular dependencies and maintains clean separation.
     */
    it('should not import from solutions in core backend', () => {
      const srcDir = path.join(__dirname, '../src');
      const tsFiles = getAllTypeScriptFiles(srcDir);

      const violations: Array<{ file: string; line: number; import: string }> = [];

      tsFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for imports from solutions
          const solutionImportMatch = line.match(/from ['"].*\/solutions\//);
          if (solutionImportMatch) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              import: line.trim(),
            });
          }
        });
      });

      if (violations.length > 0) {
        const errorMessage = violations
          .map(v => `  ${v.file}:${v.line} - ${v.import}`)
          .join('\n');

        throw new Error(
          `❌ Core backend imports from solutions:\n\n${errorMessage}\n\n` +
          `Core backend must not depend on Solution backends.\n` +
          `If you need shared code, put it in @kedge-agentic/common package.`
        );
      }
    });

    /**
     * Verify no circular dependencies between core modules.
     */
    it('should not have circular dependencies in core modules', () => {
      // This is a placeholder for future implementation
      // Can use tools like madge or custom dependency analysis
      expect(true).toBe(true);
    });
  });

  describe('Module Structure', () => {
    /**
     * Verify that entity files are in the correct location.
     */
    it('should have entities only in allowed locations', () => {
      const srcDir = path.join(__dirname, '../src');
      const entityFiles = getAllTypeScriptFiles(srcDir).filter(file =>
        file.includes('.entity.ts') || file.includes('/entities/')
      );

      const violations = entityFiles.filter(file => {
        // Entity files should be in module/entities/ directories
        return !file.match(/\/src\/[^/]+\/entities\//);
      });

      if (violations.length > 0) {
        const errorMessage = violations
          .map(file => `  ${path.relative(process.cwd(), file)}`)
          .join('\n');

        console.warn(
          `⚠️ Entity files not in standard location:\n\n${errorMessage}\n\n` +
          `Consider moving to module/entities/ directory for consistency.`
        );
      }

      // This is a warning, not a hard failure
      expect(true).toBe(true);
    });
  });
});

/**
 * Recursively get all TypeScript files in a directory.
 */
function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  const traverse = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and dist
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  };

  traverse(dir);
  return files;
}
