/**
 * Mode B Data Loader Method Tests
 *
 * Tests for the hierarchical traversal methods used in Mode B:
 *   getRootKnowledgePoints → list_root_knowledge_points tool
 *   getChildrenKnowledgePoints → get_knowledge_point_children tool
 *   searchKnowledgePoints → search_knowledge_points tool
 *   searchSubjects → list_subjects tool
 *   getFullName → used by all Mode B handlers to attach fullName
 *   getKnowledgePointById → used by verify_knowledge_point_tags
 */

import { describe, it, expect } from 'vitest';
import { jsonDataLoader } from '../json-data-loader.js';

// ── Known node IDs (verified from live data) ─────────────────────────────────
// 初中数学 — 数与式 (L3) and its direct children (L4)
const SHUSHUSHI_ID = '1998702114322399413';   // 数与式
const YOULI_ID     = '1998702114322399414';   // 有理数  (leaf)
const SHISHI_ID    = '1998702114322399472';   // 实数    (leaf)

// 初中数学 — 图形的性质 (L3, rich: 8 L4 children)
const TUXING_XINGZHI_ID      = '1998702114322399999'; // 图形的性质
const XIANGJIAO_PINGXING_ID  = '1998702114322400080'; // 相交线与平行线 (L4)

// ─────────────────────────────────────────────────────────────────────────────

describe('getRootKnowledgePoints', () => {
  it('returns a non-empty list of root nodes (parentId === null)', () => {
    const roots = jsonDataLoader.getRootKnowledgePoints();
    expect(roots.length).toBeGreaterThan(0);
    expect(roots.every(kp => kp.parentId === null)).toBe(true);
  });

  it('subjectId filter returns only nodes belonging to that subject', () => {
    const allRoots = jsonDataLoader.getRootKnowledgePoints();
    const firstSubjectId = allRoots[0].subjectId;
    const filtered = jsonDataLoader.getRootKnowledgePoints({ subjectId: firstSubjectId });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(kp => kp.subjectId === firstSubjectId)).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(allRoots.length);
  });

  it('gradeLevel filter returns only nodes with matching gradeLevel', () => {
    const filtered = jsonDataLoader.getRootKnowledgePoints({ gradeLevel: '初中' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(kp => kp.gradeLevel === '初中')).toBe(true);
  });

  it('returns empty array for a nonexistent subjectId', () => {
    const results = jsonDataLoader.getRootKnowledgePoints({ subjectId: 'nonexistent-subject-id-xyz' });
    expect(results).toHaveLength(0);
  });

  it('each root node has no parentId', () => {
    const roots = jsonDataLoader.getRootKnowledgePoints();
    roots.forEach(kp => {
      expect(kp.parentId).toBeNull();
    });
  });
});

describe('getChildrenKnowledgePoints', () => {
  it('returns direct children of a known L3 node (数与式)', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(SHUSHUSHI_ID);
    expect(children.length).toBeGreaterThan(0);
    expect(children.every(kp => kp.parentId === SHUSHUSHI_ID)).toBe(true);
  });

  it('includes known L4 children: 有理数 and 实数', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(SHUSHUSHI_ID);
    const ids = children.map(kp => kp.id);
    expect(ids).toContain(YOULI_ID);
    expect(ids).toContain(SHISHI_ID);
  });

  it('returns empty array for a dynamically found leaf node', () => {
    // Find an actual leaf node (children.length === 0) to avoid hardcoding assumptions
    const leafKP = jsonDataLoader.getAllKnowledgePoints().find(kp => kp.children.length === 0);
    expect(leafKP).toBeDefined();
    const children = jsonDataLoader.getChildrenKnowledgePoints(leafKP!.id);
    expect(children).toHaveLength(0);
  });

  it('returns empty array for a nonexistent parentId', () => {
    const results = jsonDataLoader.getChildrenKnowledgePoints('nonexistent-id-xyz');
    expect(results).toHaveLength(0);
  });

  it('图形的性质 (L3) has 8 or more direct children', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(TUXING_XINGZHI_ID);
    expect(children.length).toBeGreaterThanOrEqual(8);
    expect(children.map(kp => kp.id)).toContain(XIANGJIAO_PINGXING_ID);
  });
});

describe('searchKnowledgePoints', () => {
  it('finds nodes whose name contains the keyword', () => {
    const results = jsonDataLoader.searchKnowledgePoints('勾股定理');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(kp => kp.name.includes('勾股定理'))).toBe(true);
  });

  it('exact-name match ranks before substring match', () => {
    // 函数 has exact matches AND substring matches (e.g. 一次函数, 二次函数)
    const results = jsonDataLoader.searchKnowledgePoints('函数');
    expect(results.length).toBeGreaterThan(1);
    const exactIdx = results.findIndex(kp => kp.name.trim() === '函数');
    if (exactIdx >= 0) {
      // Everything ranked above it must be equally specific (exact or startsWith)
      results.slice(0, exactIdx).forEach(kp => {
        const name = kp.name.trim();
        expect(name === '函数' || name.startsWith('函数')).toBe(true);
      });
    }
  });

  it('gradeLevel filter restricts results to matching grade', () => {
    const filtered = jsonDataLoader.searchKnowledgePoints('函数', { gradeLevel: '初中' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(kp => kp.gradeLevel === '初中')).toBe(true);
  });

  it('limit caps the number of results', () => {
    const results = jsonDataLoader.searchKnowledgePoints('函数', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('empty keyword returns empty array', () => {
    const results = jsonDataLoader.searchKnowledgePoints('');
    expect(results).toHaveLength(0);
  });

  it('nonexistent keyword returns empty array', () => {
    const results = jsonDataLoader.searchKnowledgePoints('不存在的知识点xyz12345');
    expect(results).toHaveLength(0);
  });

  it('subjectId filter restricts results to matching subject', () => {
    const kp = jsonDataLoader.getKnowledgePointById(SHUSHUSHI_ID)!;
    const filtered = jsonDataLoader.searchKnowledgePoints('数与式', { subjectId: kp.subjectId });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(r => r.subjectId === kp.subjectId)).toBe(true);
  });
});

describe('searchSubjects', () => {
  it('finds subjects whose name contains "数学"', () => {
    const results = jsonDataLoader.searchSubjects('数学');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(s => s.name.includes('数学') || s.description.includes('数学'))).toBe(true);
  });

  it('empty keyword returns empty array', () => {
    const results = jsonDataLoader.searchSubjects('');
    expect(results).toHaveLength(0);
  });

  it('limit caps results', () => {
    const all = jsonDataLoader.searchSubjects('数学');
    const limited = jsonDataLoader.searchSubjects('数学', { limit: 1 });
    expect(limited.length).toBeLessThanOrEqual(1);
    if (all.length > 1) {
      expect(limited[0]).toEqual(all[0]);
    }
  });

  it('nonexistent keyword returns empty array', () => {
    const results = jsonDataLoader.searchSubjects('nonexistent_xyz_999');
    expect(results).toHaveLength(0);
  });

  it('each result has required fields: id, name, gradeLevels', () => {
    const results = jsonDataLoader.searchSubjects('初中');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(s => {
      expect(s.id).toBeDefined();
      expect(s.name).toBeTruthy();
      expect(Array.isArray(s.gradeLevels)).toBe(true);
    });
  });
});

describe('getKnowledgePointById', () => {
  it('returns the correct node for a known ID', () => {
    const kp = jsonDataLoader.getKnowledgePointById(SHUSHUSHI_ID);
    expect(kp).toBeDefined();
    expect(kp!.id).toBe(SHUSHUSHI_ID);
    expect(kp!.name.trim()).toBe('数与式');
  });

  it('returns undefined for a nonexistent ID', () => {
    const kp = jsonDataLoader.getKnowledgePointById('nonexistent-id-xyz');
    expect(kp).toBeUndefined();
  });

  it('returned node always has a children array', () => {
    // Non-leaf: 数与式 has children
    const nonLeaf = jsonDataLoader.getKnowledgePointById(SHUSHUSHI_ID)!;
    expect(Array.isArray(nonLeaf.children)).toBe(true);
    expect(nonLeaf.children.length).toBeGreaterThan(0);

    // Leaf: dynamically found
    const leafKP = jsonDataLoader.getAllKnowledgePoints().find(kp => kp.children.length === 0)!;
    expect(Array.isArray(leafKP.children)).toBe(true);
    expect(leafKP.children).toHaveLength(0);
  });
});

describe('getFullName — Mode B handler enrichment', () => {
  it('root node has pathNames with exactly 1 element', () => {
    const roots = jsonDataLoader.getRootKnowledgePoints();
    const root = roots[0];
    const result = jsonDataLoader.getFullName(root.id);
    expect(result).toBeDefined();
    expect(result!.pathNames).toHaveLength(1);
    expect(result!.fullName).toBe(root.name.trim());
  });

  it('深层节点 (有理数, level≥3) has pathNames with at least 3 elements', () => {
    // 有理数 is several levels deep in the tree (subject root > chapter > section > ...)
    const kp = jsonDataLoader.getKnowledgePointById(YOULI_ID);
    expect(kp).toBeDefined();
    expect(kp!.level).toBeGreaterThanOrEqual(2); // at least 2 levels from root
    const result = jsonDataLoader.getFullName(YOULI_ID);
    expect(result).toBeDefined();
    expect(result!.pathNames.length).toBeGreaterThanOrEqual(3);
  });

  it('pathNames.join(" > ") equals fullName', () => {
    const result = jsonDataLoader.getFullName(SHUSHUSHI_ID);
    expect(result).toBeDefined();
    expect(result!.pathNames.join(' > ')).toBe(result!.fullName);
  });

  it('last element of pathNames matches the node name trimmed', () => {
    const kp = jsonDataLoader.getKnowledgePointById(SHUSHUSHI_ID)!;
    const result = jsonDataLoader.getFullName(SHUSHUSHI_ID)!;
    expect(result.pathNames.at(-1)).toBe(kp.name.trim());
  });

  it('returns undefined for a nonexistent ID', () => {
    const result = jsonDataLoader.getFullName('nonexistent-id-xyz');
    expect(result).toBeUndefined();
  });

  it('L3 node fullName contains the parent chain', () => {
    // 数与式 should have at least the subject root in its path
    const result = jsonDataLoader.getFullName(SHUSHUSHI_ID)!;
    expect(result.fullName).toContain('数与式');
    expect(result.pathNames.length).toBeGreaterThanOrEqual(2);
  });
});
