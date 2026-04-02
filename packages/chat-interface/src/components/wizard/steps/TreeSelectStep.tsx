/**
 * TreeSelectStep — Hierarchical tree with checkboxes
 *
 * Fetches tree data from dataEndpoint, renders expandable tree nodes
 * with selection state. Falls back to mock data when API unavailable.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { StepProps } from '../types';

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

const MOCK_TREE: TreeNode[] = [
  {
    id: 'ch1',
    label: '第一章 有理数',
    children: [
      { id: 'ch1-1', label: '1.1 正数与负数' },
      { id: 'ch1-2', label: '1.2 有理数' },
      { id: 'ch1-3', label: '1.3 有理数的加减法' },
    ],
  },
  {
    id: 'ch2',
    label: '第二章 整式的加减',
    children: [
      { id: 'ch2-1', label: '2.1 整式' },
      { id: 'ch2-2', label: '2.2 整式的加减' },
    ],
  },
  {
    id: 'ch3',
    label: '第三章 一元一次方程',
    children: [
      { id: 'ch3-1', label: '3.1 从算式到方程' },
      { id: 'ch3-2', label: '3.2 解一元一次方程' },
      { id: 'ch3-3', label: '3.3 实际问题与一元一次方程' },
    ],
  },
];

export function TreeSelectStep({ step, value, onChange, allAnswers, apiBaseUrl }: StepProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [usingMock, setUsingMock] = useState(false);
  const fetchAttempted = useRef(false);

  // Value format: { ids: string[], labels: Record<string, string> }
  // Backward compat: also accept plain string[]
  const valueObj = value as { ids?: string[]; labels?: Record<string, string> } | string[] | undefined;
  const selected: string[] = Array.isArray(valueObj) ? valueObj : (valueObj?.ids || []);

  // Build ID→label map from current tree data for emitting with selections
  const buildLabelMap = useCallback((ids: string[], nodes: TreeNode[]): Record<string, string> => {
    const map: Record<string, string> = {};
    const walk = (items: TreeNode[]) => {
      for (const n of items) {
        if (ids.includes(n.id)) map[n.id] = n.label;
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return map;
  }, []);

  const loadData = useCallback(async () => {
    if (!step.dataEndpoint) {
      setTreeData(MOCK_TREE);
      setUsingMock(true);
      setExpanded(new Set(MOCK_TREE.map(n => n.id)));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(allAnswers)) {
        if (val != null) params.set(key, typeof val === 'string' ? val : JSON.stringify(val));
      }
      const base = apiBaseUrl || '';
      const url = `${base}${step.dataEndpoint}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const nodes = Array.isArray(data) ? data : data.tree || data.items || [];
      if (nodes.length === 0) throw new Error('Empty data');
      setTreeData(nodes);
      setUsingMock(false);
      setExpanded(new Set(nodes.map((n: TreeNode) => n.id)));
    } catch (err) {
      // Fallback to mock data
      setTreeData(MOCK_TREE);
      setUsingMock(true);
      setExpanded(new Set(MOCK_TREE.map(n => n.id)));
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [step.dataEndpoint, apiBaseUrl, allAnswers]);

  useEffect(() => {
    if (fetchAttempted.current) return;
    fetchAttempted.current = true;
    loadData();
  }, [loadData]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const toggleSelect = useCallback(
    (nodeId: string) => {
      const nextIds = selected.includes(nodeId)
        ? selected.filter((id) => id !== nodeId)
        : [...selected, nodeId];
      onChange({ ids: nextIds, labels: buildLabelMap(nextIds, treeData) });
    },
    [selected, onChange, treeData, buildLabelMap],
  );

  // Select/deselect all leaf nodes
  const getAllLeafIds = useCallback((nodes: TreeNode[]): string[] => {
    const ids: string[] = [];
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        ids.push(...getAllLeafIds(node.children));
      } else {
        ids.push(node.id);
      }
    }
    return ids;
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = getAllLeafIds(treeData);
    onChange({ ids: allIds, labels: buildLabelMap(allIds, treeData) });
  }, [treeData, getAllLeafIds, onChange, buildLabelMap]);

  const handleDeselectAll = useCallback(() => {
    onChange({ ids: [], labels: {} });
  }, [onChange]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>加载章节数据中...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Error banner with retry */}
      {error && usingMock && (
        <div style={{
          fontSize: 11,
          color: 'var(--warning-t)',
          background: 'var(--warning-bg)',
          padding: '6px 10px',
          borderRadius: 'var(--r, 8px)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>使用示例数据（{error}）</span>
          <button
            onClick={() => { fetchAttempted.current = false; loadData(); }}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: '0.5px solid var(--warning-t)',
              background: 'transparent',
              color: 'var(--warning-t)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            重试
          </button>
        </div>
      )}

      {/* Select all / deselect all */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={handleSelectAll} style={actionBtnStyle}>全选</button>
        <button onClick={handleDeselectAll} style={actionBtnStyle}>全不选</button>
      </div>

      {/* Tree */}
      <div style={{ maxHeight: 280, overflow: 'auto' }}>
        {treeData.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            selected={selected}
            onToggleExpand={toggleExpand}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {selected.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, padding: '0 4px' }}>
          已选择 {selected.length} 项
        </div>
      )}
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  selected: string[];
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected.includes(node.id);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          paddingLeft: 8 + depth * 20,
          cursor: 'pointer',
          borderRadius: 'var(--r, 8px)',
          fontSize: 13,
          color: 'var(--t1)',
          transition: 'background 0.1s',
        }}
        onClick={() => onToggleSelect(node.id)}
      >
        {hasChildren && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            style={{ width: 16, textAlign: 'center', fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span style={{ width: 16, flexShrink: 0 }} />}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            border: `1.5px solid ${isSelected ? 'var(--info-t)' : 'var(--t3)'}`,
            background: isSelected ? 'var(--info-t)' : 'transparent',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {isSelected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="var(--bg1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ flex: 1, minWidth: 0 }}>{node.label}</span>
      </div>
      {hasChildren && isExpanded &&
        node.children!.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selected={selected}
            onToggleExpand={onToggleExpand}
            onToggleSelect={onToggleSelect}
          />
        ))}
    </>
  );
}

const actionBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 'var(--r, 8px)',
  border: '0.5px solid var(--b1)',
  background: 'var(--bg2)',
  color: 'var(--t3)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
};
