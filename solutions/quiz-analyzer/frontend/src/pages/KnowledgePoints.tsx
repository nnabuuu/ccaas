import { useState, useEffect } from 'react';
import { knowledgePointsApi } from '../api/client';
import type { KnowledgePoint } from '../types';
import './KnowledgePoints.css';

export default function KnowledgePoints() {
  const [tree, setTree] = useState<KnowledgePoint[]>([]);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  const loadKnowledgePoints = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await knowledgePointsApi.getTree();
      setTree(data.tree);
      setTotalNodes(data.totalNodes);

      // Auto-expand root nodes
      const rootIds = data.tree.map((node) => node.id);
      setExpandedNodes(new Set(rootIds));
    } catch (err: any) {
      console.error('Failed to load knowledge points:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderTree = (nodes: KnowledgePoint[], level = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);

      return (
        <div key={node.id} className="tree-node" style={{ marginLeft: `${level * 2}rem` }}>
          <div className="node-header" onClick={() => hasChildren && toggleNode(node.id)}>
            {hasChildren && (
              <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
            )}
            {!hasChildren && <span className="leaf-icon">•</span>}
            <span className="node-name">{node.name}</span>
            {node.code && <span className="node-code">{node.code}</span>}
            <span className="node-level">L{node.level}</span>
            {node.grade_level && (
              <span className="node-grade">{node.grade_level}年级</span>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div className="node-children">{renderTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="knowledge-points-page">
      <div className="page-header">
        <h1>知识点体系</h1>
        <div className="stats">
          <span>共 {totalNodes} 个知识点</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="tree-container">{renderTree(tree)}</div>
      )}

      {!loading && tree.length === 0 && (
        <div className="empty-state">暂无知识点数据</div>
      )}
    </div>
  );
}
