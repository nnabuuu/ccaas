import { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { knowledgePointsApi } from '../api/client';
import type { KnowledgePoint } from '../types';

export default function KnowledgePoints() {
  const [tree, setTree] = useState<KnowledgePoint[]>([]);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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

  const filterTree = (nodes: KnowledgePoint[], query: string): KnowledgePoint[] => {
    if (!query) return nodes;

    const filtered: KnowledgePoint[] = [];
    const lowerQuery = query.toLowerCase();

    for (const node of nodes) {
      const matches = node.name.toLowerCase().includes(lowerQuery) ||
        node.code?.toLowerCase().includes(lowerQuery);

      const filteredChildren = node.children
        ? filterTree(node.children, query)
        : [];

      if (matches || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });

        // Auto-expand nodes that match
        if (filteredChildren.length > 0) {
          setExpandedNodes((prev) => new Set([...prev, node.id]));
        }
      }
    }

    return filtered;
  };

  const renderTree = (nodes: KnowledgePoint[], level = 0) => {
    const filteredNodes = level === 0 ? filterTree(nodes, searchQuery) : nodes;

    return filteredNodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);

      const levelColors = [
        'bg-primary-50 text-primary-700 border-primary-200',
        'bg-secondary-50 text-secondary-700 border-secondary-200',
        'bg-cta-50 text-cta-700 border-cta-200',
        'bg-purple-50 text-purple-700 border-purple-200',
      ];

      const colorClass = levelColors[Math.min(level, levelColors.length - 1)];

      return (
        <div key={node.id} className="mb-2" style={{ marginLeft: `${level * 1.5}rem` }}>
          <div
            className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
              hasChildren ? 'cursor-pointer hover:shadow-md' : ''
            } ${colorClass}`}
            onClick={() => hasChildren && toggleNode(node.id)}
          >
            {/* Expand/Collapse Icon */}
            {hasChildren && (
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5" />
                )}
              </div>
            )}
            {!hasChildren && (
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-current opacity-50" />
              </div>
            )}

            {/* Node Content */}
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <span className="font-semibold">{node.name}</span>
              {node.code && (
                <span className="px-2 py-0.5 bg-white/80 rounded text-xs font-mono">
                  {node.code}
                </span>
              )}
              <span className="px-2 py-0.5 bg-white/80 rounded text-xs">
                级别 {node.level}
              </span>
              {node.grade_level && (
                <span className="px-2 py-0.5 bg-white/80 rounded text-xs">
                  {node.grade_level}年级
                </span>
              )}
            </div>

            {/* Children Count */}
            {hasChildren && (
              <span className="flex-shrink-0 text-xs opacity-70">
                {node.children!.length} 项
              </span>
            )}
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="mt-2 animate-slide-up">
              {renderTree(node.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">知识点体系</h1>
            <p className="text-slate-600">共 {totalNodes} 个知识点</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <AcademicCapIcon className="w-6 h-6 text-primary-600" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索知识点名称或代码..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all shadow-soft"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner w-8 h-8" />
          <span className="ml-3 text-slate-600">加载中...</span>
        </div>
      ) : (
        <>
          {/* Tree Container */}
          {tree.length > 0 ? (
            <div className="bento-card animate-slide-up">
              {renderTree(tree)}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <AcademicCapIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                暂无知识点数据
              </h3>
              <p className="text-slate-500">请先导入知识点数据</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
