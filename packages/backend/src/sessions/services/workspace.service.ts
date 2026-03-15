/**
 * Workspace Service
 *
 * Handles session workspace file operations and MCP server symlink management.
 *
 * Responsibilities:
 * - Session workspace file operations (read, tree traversal)
 * - Directory tree building with security validations
 * - Path sanitization & security (directory traversal prevention)
 * - MIME type detection
 * - MCP server symlink creation and path resolution
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { ManagedSession, WorkspaceFileInfo, WorkspaceTreeResponse, FileTreeNode } from '../../common/interfaces';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly workspaceDir: string;

  constructor(private readonly configService: ConfigService) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
  }

  /**
   * Create MCP symlinks for session workspace
   *
   * Creates symlinks from session workspace to tenant MCP servers.
   * This allows sessions to use tenant-specific MCP servers via relative paths.
   *
   * @param session - Session with mcpServers configuration
   */
  async createMcpSymlinks(session: ManagedSession): Promise<void> {
    if (!session.tenantId || !session.mcpServers) {
      return;
    }

    const sessionMcpDir = path.join(session.workspaceDir, '.claude', 'mcp-servers');
    const workspaceRoot = path.resolve(this.workspaceDir);

    for (const [serverName, config] of Object.entries(session.mcpServers)) {
      // Skip if args don't contain tenant-relative paths
      if (!config.args || config.args.length === 0) continue;

      const firstArg = config.args[0];
      if (!firstArg.startsWith('tenants/')) continue;

      // Extract server name from tenant path: tenants/{tenantId}/mcp-servers/{serverName}/...
      const pathParts = firstArg.split('/');
      if (pathParts.length < 4 || pathParts[2] !== 'mcp-servers') continue;

      const mcpServerName = pathParts[3];

      // Resolve tenant MCP server path
      const tenantMcpPath = path.join(
        workspaceRoot,
        'tenants',
        session.tenantId,
        'mcp-servers',
        mcpServerName,
      );

      // Create symlink in session workspace
      const symlinkPath = path.join(sessionMcpDir, mcpServerName);

      try {
        if (fs.existsSync(symlinkPath)) {
          fs.unlinkSync(symlinkPath);  // Remove if exists
        }
        fs.symlinkSync(tenantMcpPath, symlinkPath, 'dir');
        this.logger.debug(`Created symlink: ${symlinkPath} -> ${tenantMcpPath}`);
      } catch (err: any) {
        this.logger.warn(`Failed to create MCP symlink for ${mcpServerName}: ${err.message}`);
      }
    }
  }

  /**
   * Resolve MCP server paths from tenant-relative to session-relative symlink paths
   *
   * Transforms args: tenants/{tenantId}/mcp-servers/{server}/dist/index.js
   * To: .claude/mcp-servers/{server}/dist/index.js
   *
   * Transforms env vars: tenants/{tenantId}/solution-backend/agri.db
   * To: /absolute/path/to/workspace/tenants/{tenantId}/solution-backend/agri.db
   *
   * @param mcpServers - MCP server configuration
   * @returns Resolved configuration with session-relative args and absolute env paths
   */
  resolveSessionMcpPaths(
    mcpServers: Record<string, {
      command: string;
      args: string[];
      description?: string;
      env?: Record<string, string>;
    }>,
  ): Record<string, {
    command: string;
    args: string[];
    description?: string;
    env?: Record<string, string>;
  }> {
    const workspaceRoot = path.resolve(this.workspaceDir);
    const resolved: Record<string, any> = {};

    for (const [name, config] of Object.entries(mcpServers)) {
      resolved[name] = {
        ...config,
        args: (config.args || []).map(arg => {
          // If arg looks like tenant path, convert to session-relative symlink path
          if (arg.startsWith('tenants/')) {
            const pathParts = arg.split('/');
            // Extract: tenants/{tenantId}/mcp-servers/{serverName}/{...rest}
            if (pathParts.length >= 4 && pathParts[2] === 'mcp-servers') {
              const serverName = pathParts[3];
              const relPath = pathParts.slice(4).join('/');  // Path after server name
              return `.claude/mcp-servers/${serverName}/${relPath}`;
            }
          }
          return arg;
        }),
        // Resolve env vars with tenant-relative paths to absolute paths
        env: config.env
          ? Object.fromEntries(
              Object.entries(config.env).map(([k, v]) => {
                if (v.startsWith('tenants/')) {
                  const resolved = path.resolve(workspaceRoot, v);
                  if (!resolved.startsWith(workspaceRoot + path.sep)) {
                    this.logger.warn(`[Security] Env path traversal blocked: ${k}=${v}`);
                    return [k, v]; // Return unresolved
                  }
                  return [k, resolved];
                }
                return [k, v];
              }),
            )
          : undefined,
      };
    }

    return resolved;
  }

  /**
   * Get workspace file for download
   *
   * Security: Validates path to prevent directory traversal attacks.
   *
   * @param session - Session (or null if workspace lookup by sessionId)
   * @param sessionId - Session ID for workspace lookup
   * @param relativePath - Relative file path within workspace
   * @returns File information for download
   * @throws NotFoundException if session or file not found
   * @throws BadRequestException if path is invalid
   */
  async getWorkspaceFile(
    session: ManagedSession | null,
    sessionId: string,
    relativePath: string,
  ): Promise<WorkspaceFileInfo> {
    // 1. Get workspace directory
    const workspaceDir = session?.workspaceDir ||
      path.join(this.workspaceDir, 'sessions', sessionId);

    if (!fs.existsSync(workspaceDir)) {
      throw new NotFoundException(`Session workspace not found: ${sessionId}`);
    }

    // 2. Sanitize path (CRITICAL SECURITY)
    const sanitizedPath = this.sanitizeFilePath(relativePath);
    const absolutePath = path.join(workspaceDir, sanitizedPath);

    // 3. Prevent directory traversal
    const resolvedPath = path.resolve(absolutePath);
    const resolvedWorkspace = path.resolve(workspaceDir);

    if (!resolvedPath.startsWith(resolvedWorkspace + path.sep) && resolvedPath !== resolvedWorkspace) {
      this.logger.warn(`[Security] Path traversal blocked: ${relativePath}`);
      throw new BadRequestException('Invalid file path');
    }

    // 4. Check file exists and is a regular file
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(`File not found: ${relativePath}`);
    }

    const stats = fs.lstatSync(absolutePath);

    if (stats.isSymbolicLink()) {
      this.logger.warn(`[Security] Symlink blocked: ${relativePath}`);
      throw new BadRequestException('Symlinks not allowed');
    }

    if (!stats.isFile()) {
      throw new BadRequestException('Path does not point to a file');
    }

    // 5. Return file info
    const filename = path.basename(absolutePath);
    return {
      filename,
      absolutePath,
      mimeType: this.detectMimeType(filename),
      size: stats.size,
    };
  }

  /**
   * Get file content from session workspace for inline viewing
   *
   * Returns text content for displayable files, or null for binary/large files.
   *
   * @param session - Session (or null if workspace lookup by sessionId)
   * @param sessionId - Session ID for workspace lookup
   * @param relativePath - Relative file path within workspace
   */
  async getWorkspaceFileContent(
    session: ManagedSession | null,
    sessionId: string,
    relativePath: string,
  ): Promise<{ content: string | null; mimeType: string; size: number; filename: string; isBinary: boolean }> {
    const fileInfo = await this.getWorkspaceFile(session, sessionId, relativePath);
    const MAX_SIZE = 512 * 1024; // 512KB display limit

    const isBinary = !this.isTextMimeType(fileInfo.mimeType);

    if (isBinary || fileInfo.size > MAX_SIZE) {
      return { content: null, mimeType: fileInfo.mimeType, size: fileInfo.size, filename: fileInfo.filename, isBinary: true };
    }

    const content = fs.readFileSync(fileInfo.absolutePath, 'utf8');
    return { content, mimeType: fileInfo.mimeType, size: fileInfo.size, filename: fileInfo.filename, isBinary: false };
  }

  private isTextMimeType(mimeType: string): boolean {
    return mimeType.startsWith('text/') ||
      ['application/json', 'application/xml', 'application/javascript',
       'application/typescript', 'application/yaml'].includes(mimeType);
  }

  /**
   * Get directory tree for session workspace
   *
   * @param session - Session (or null if workspace lookup by sessionId)
   * @param sessionId - Session ID for workspace lookup
   * @returns Workspace tree structure
   * @throws NotFoundException if session workspace not found
   */
  async getWorkspaceTree(
    session: ManagedSession | null,
    sessionId: string,
  ): Promise<WorkspaceTreeResponse> {
    const workspaceDir = session?.workspaceDir ||
      path.join(this.workspaceDir, 'sessions', sessionId);

    if (!fs.existsSync(workspaceDir)) {
      throw new NotFoundException(`Session workspace not found: ${sessionId}`);
    }

    const tree = this.buildDirectoryTree(workspaceDir, '');
    return { tree };
  }

  /**
   * Sanitize file path to prevent traversal attacks
   *
   * Security checks:
   * - Block absolute paths
   * - Block null bytes (poison null terminator attack)
   * - Block backslash (Windows path traversal)
   * - Block URL-encoded characters (double encoding attack)
   * - Normalize and block .. paths
   *
   * @param filePath - User-provided file path
   * @returns Sanitized path
   * @throws BadRequestException if path is invalid
   */
  private sanitizeFilePath(filePath: string): string {
    // Block absolute paths (must be caught before any processing)
    if (path.isAbsolute(filePath)) {
      throw new BadRequestException('Invalid file path');
    }

    // Block null bytes (poison null terminator attack)
    if (filePath.includes('\0')) {
      throw new BadRequestException('Invalid file path');
    }

    // Block backslash (Windows path traversal)
    if (filePath.includes('\\')) {
      throw new BadRequestException('Invalid file path');
    }

    // Block URL-encoded special characters (double encoding attack)
    if (filePath.includes('%')) {
      throw new BadRequestException('Invalid file path');
    }

    // Remove leading/trailing slashes
    let sanitized = filePath.replace(/^\/+|\/+$/g, '');

    // Normalize path (resolves .. and .)
    sanitized = path.normalize(sanitized);

    // Block paths that still contain ..
    if (sanitized.includes('..')) {
      throw new BadRequestException('Invalid file path');
    }

    return sanitized;
  }

  /**
   * Build directory tree recursively
   *
   * @param basePath - Base workspace path
   * @param relativePath - Current relative path
   * @returns Array of tree nodes (folders and files)
   */
  private buildDirectoryTree(basePath: string, relativePath: string): FileTreeNode[] {
    const fullPath = path.join(basePath, relativePath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      const entryPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          id: `folder-${entryPath}`,
          name: entry.name,
          type: 'folder',
          path: entryPath,
          children: this.buildDirectoryTree(basePath, entryPath),
        });
      } else if (entry.isFile()) {
        const stats = fs.statSync(path.join(basePath, entryPath));
        nodes.push({
          id: `file-${entryPath}`,
          name: entry.name,
          type: 'file',
          path: entryPath,
          size: stats.size,
          mimeType: this.detectMimeType(entry.name),
        });
      }
    }

    // Sort: folders first, then files (alphabetically)
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Detect MIME type from filename
   *
   * @param filename - File name with extension
   * @returns MIME type string
   */
  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const mimeMap: Record<string, string> = {
      // Text
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'text/typescript',

      // Images
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',

      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',

      // Documents
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    return mimeMap[ext] || 'application/octet-stream';
  }
}
