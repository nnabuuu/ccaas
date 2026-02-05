import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface KnowledgePointNode {
  id: string;
  name: string;
  code?: string;
  level: number;
  gradeLevel?: string;
  children: KnowledgePointNode[];
}

@Injectable()
export class KnowledgePointsService implements OnModuleInit {
  private knowledgePointsTree: Record<string, KnowledgePointNode[]> = {};

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    // 模块初始化时加载知识点树
    this.loadKnowledgePointsTree();
  }

  /**
   * 加载知识点树到内存
   */
  loadKnowledgePointsTree(): Record<string, KnowledgePointNode[]> {
    try {
      const rows = this.databaseService.query<any>(`
        SELECT id, subject_id, parent_id, name, code, level, grade_level
        FROM knowledge_points
        ORDER BY level ASC, name ASC
      `);

      // Build tree structure
      const nodeMap = new Map<string, KnowledgePointNode>();
      const rootsBySubject: Record<string, KnowledgePointNode[]> = {};

      // Pass 1: Create node objects
      rows.forEach((row) => {
        nodeMap.set(row.id, {
          id: row.id,
          name: row.name,
          code: row.code,
          level: row.level,
          gradeLevel: row.grade_level,
          children: [],
        });
      });

      // Pass 2: Build parent-child relationships
      rows.forEach((row) => {
        const node = nodeMap.get(row.id)!;

        if (row.parent_id) {
          const parent = nodeMap.get(row.parent_id);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          // Root node
          if (!rootsBySubject[row.subject_id]) {
            rootsBySubject[row.subject_id] = [];
          }
          rootsBySubject[row.subject_id].push(node);
        }
      });

      this.knowledgePointsTree = rootsBySubject;
      console.log(`✓ Knowledge points tree loaded (${Object.keys(rootsBySubject).length} subjects)`);

      return rootsBySubject;
    } catch (error) {
      console.warn('Failed to load knowledge points tree:', error);
      return {};
    }
  }

  /**
   * 获取知识点树
   */
  getTree(subjectId?: string): Record<string, KnowledgePointNode[]> | KnowledgePointNode[] {
    if (subjectId) {
      return this.knowledgePointsTree[subjectId] || [];
    }
    return this.knowledgePointsTree;
  }

  /**
   * 按年级过滤树
   */
  filterTreeByGrade(tree: KnowledgePointNode[], gradeLevel: string): KnowledgePointNode[] {
    return tree
      .map((node) => ({
        ...node,
        children: node.children
          ? this.filterTreeByGrade(node.children, gradeLevel)
          : [],
      }))
      .filter(
        (node) =>
          !node.gradeLevel ||
          node.gradeLevel === gradeLevel ||
          node.children.length > 0,
      );
  }

  /**
   * 统计树节点数量
   */
  countNodes(tree: KnowledgePointNode[]): number {
    return tree.reduce(
      (sum, node) =>
        sum + 1 + (node.children ? this.countNodes(node.children) : 0),
      0,
    );
  }

  /**
   * 搜索知识点
   */
  searchKnowledgePoints(params: {
    query?: string;
    subjectId?: string;
    gradeLevel?: string;
    parentId?: string | null;
    limit?: number;
  }) {
    let sql = `
      SELECT
        kp.id,
        kp.name,
        kp.code,
        kp.level,
        kp.grade_level,
        kp.parent_id,
        s.name as subject_name,
        parent_kp.name as parent_name,
        (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) as children_count
      FROM knowledge_points kp
      LEFT JOIN subjects s ON kp.subject_id = s.id
      LEFT JOIN knowledge_points parent_kp ON kp.parent_id = parent_kp.id
      WHERE 1=1
    `;

    const sqlParams: any[] = [];

    if (params.query) {
      sql += ` AND kp.name LIKE ?`;
      sqlParams.push(`%${params.query}%`);
    }

    if (params.subjectId) {
      sql += ` AND kp.subject_id = ?`;
      sqlParams.push(params.subjectId);
    }

    if (params.gradeLevel) {
      sql += ` AND kp.grade_level = ?`;
      sqlParams.push(params.gradeLevel);
    }

    if (params.parentId !== undefined) {
      if (params.parentId === null) {
        sql += ` AND kp.parent_id IS NULL`;
      } else {
        sql += ` AND kp.parent_id = ?`;
        sqlParams.push(params.parentId);
      }
    }

    sql += ` ORDER BY kp.level ASC, kp.name ASC LIMIT ?`;
    sqlParams.push(params.limit || 20);

    return this.databaseService.query(sql, sqlParams);
  }

  /**
   * 获取子节点
   */
  getChildren(params: {
    parentId?: string | null;
    subjectId?: string;
    level?: number;
    limit?: number;
  }) {
    let sql = `
      SELECT
        kp.id,
        kp.name,
        kp.code,
        kp.level,
        kp.grade_level,
        kp.parent_id,
        (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) as children_count,
        CASE WHEN (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) > 0
          THEN 1 ELSE 0 END as has_children
      FROM knowledge_points kp
      WHERE 1=1
    `;

    const sqlParams: any[] = [];

    if (params.parentId !== undefined) {
      if (params.parentId === null) {
        sql += ` AND kp.parent_id IS NULL`;
      } else {
        sql += ` AND kp.parent_id = ?`;
        sqlParams.push(params.parentId);
      }
    }

    if (params.subjectId) {
      sql += ` AND kp.subject_id = ?`;
      sqlParams.push(params.subjectId);
    }

    if (params.level !== undefined) {
      sql += ` AND kp.level = ?`;
      sqlParams.push(params.level);
    }

    sql += ` ORDER BY kp.name ASC LIMIT ?`;
    sqlParams.push(params.limit || 100);

    const children = this.databaseService.query(sql, sqlParams);

    // Get parent info if needed
    let parent = null;
    if (params.parentId && params.parentId !== null) {
      parent = this.databaseService.queryOne(
        `SELECT id, name, level, parent_id FROM knowledge_points WHERE id = ?`,
        [params.parentId],
      );
    }

    return { parent, children, count: children.length };
  }

  /**
   * 获取节点路径（面包屑）
   */
  getNodePath(nodeId: string) {
    const path: any[] = [];
    let currentId = nodeId;

    while (currentId) {
      const node = this.databaseService.queryOne<any>(
        `SELECT id, name, level, parent_id, subject_id FROM knowledge_points WHERE id = ?`,
        [currentId],
      );

      if (!node) break;

      path.unshift({
        id: node.id,
        name: node.name,
        level: node.level,
      });

      currentId = node.parent_id;
    }

    // Get subject info
    let subject = null;
    if (path.length > 0) {
      const firstNode = this.databaseService.queryOne<any>(
        `SELECT subject_id FROM knowledge_points WHERE id = ?`,
        [nodeId],
      );

      if (firstNode) {
        subject = this.databaseService.queryOne(
          `SELECT id, name FROM subjects WHERE id = ?`,
          [firstNode.subject_id],
        );
      }
    }

    return {
      subject,
      path,
      depth: path.length,
    };
  }

  /**
   * 在指定范围内搜索
   */
  searchInScope(params: {
    parentId?: string;
    subjectId?: string;
    query: string;
    maxDepth?: number;
    limit?: number;
  }) {
    let sql: string;
    const sqlParams: any[] = [];

    if (params.parentId) {
      // Search in subtree using recursive CTE
      sql = `
        WITH RECURSIVE descendants AS (
          SELECT id, name, level, parent_id, subject_id
          FROM knowledge_points
          WHERE id = ?

          UNION ALL

          SELECT kp.id, kp.name, kp.level, kp.parent_id, kp.subject_id
          FROM knowledge_points kp
          INNER JOIN descendants d ON kp.parent_id = d.id
          ${params.maxDepth ? 'WHERE kp.level <= d.level + ?' : ''}
        )
        SELECT
          d.id,
          d.name,
          d.level,
          d.parent_id,
          parent_kp.name as parent_name,
          s.name as subject_name,
          (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = d.id) as children_count
        FROM descendants d
        LEFT JOIN knowledge_points parent_kp ON d.parent_id = parent_kp.id
        LEFT JOIN subjects s ON d.subject_id = s.id
        WHERE d.name LIKE ?
        ORDER BY d.level ASC, d.name ASC
        LIMIT ?
      `;

      sqlParams.push(params.parentId);
      if (params.maxDepth) {
        sqlParams.push(params.maxDepth);
      }
      sqlParams.push(`%${params.query}%`);
      sqlParams.push(params.limit || 20);
    } else if (params.subjectId) {
      // Search in subject
      sql = `
        SELECT
          kp.id,
          kp.name,
          kp.level,
          kp.parent_id,
          parent_kp.name as parent_name,
          s.name as subject_name,
          (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) as children_count
        FROM knowledge_points kp
        LEFT JOIN knowledge_points parent_kp ON kp.parent_id = parent_kp.id
        LEFT JOIN subjects s ON kp.subject_id = s.id
        WHERE kp.subject_id = ?
          AND kp.name LIKE ?
        ORDER BY kp.level ASC, kp.name ASC
        LIMIT ?
      `;

      sqlParams.push(params.subjectId, `%${params.query}%`, params.limit || 20);
    } else {
      // Global search
      sql = `
        SELECT
          kp.id,
          kp.name,
          kp.level,
          kp.parent_id,
          parent_kp.name as parent_name,
          s.name as subject_name,
          (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) as children_count
        FROM knowledge_points kp
        LEFT JOIN knowledge_points parent_kp ON kp.parent_id = parent_kp.id
        LEFT JOIN subjects s ON kp.subject_id = s.id
        WHERE kp.name LIKE ?
        ORDER BY kp.level ASC, kp.name ASC
        LIMIT ?
      `;

      sqlParams.push(`%${params.query}%`, params.limit || 20);
    }

    const results = this.databaseService.query(sql, sqlParams);

    return {
      results,
      count: results.length,
      scope: params.parentId ? 'subtree' : params.subjectId ? 'subject' : 'global',
      query: params.query,
    };
  }

  /**
   * 获取根分类列表
   */
  getRootCategories(limit = 50) {
    const categories = this.databaseService.query(`
      SELECT
        s.id,
        s.name,
        s.code,
        s.description,
        COUNT(DISTINCT kp.id) as kp_count,
        COUNT(DISTINCT CASE WHEN kp.parent_id IS NULL THEN kp.id END) as root_count,
        MAX(kp.level) as max_level,
        MIN(kp.level) as min_level
      FROM subjects s
      INNER JOIN knowledge_points kp ON kp.subject_id = s.id
      GROUP BY s.id
      HAVING kp_count > 0
      ORDER BY kp_count DESC
      LIMIT ?
    `, [limit]);

    return {
      categories,
      total: categories.length,
    };
  }
}
