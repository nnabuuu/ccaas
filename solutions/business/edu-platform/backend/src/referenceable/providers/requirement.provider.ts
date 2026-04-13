import { Injectable } from '@nestjs/common';
import type {
  EntityContextProvider,
  EntityContext,
  AtReference,
  EditOperation,
  EditResult,
} from '@kedge-agentic/context-layer/core';
import { CurriculumService } from '../../curriculum/curriculum.service';
import { SUBJECT_MAP } from '../constants';

@Injectable()
export class RequirementProvider implements EntityContextProvider {
  constructor(private curriculumService: CurriculumService) {}

  async getContext(id: string, _userId: string): Promise<EntityContext> {
    // CurriculumService doesn't have a direct getById — use getChildren of parent or search
    // We'll search by id pattern and find the exact match
    const allNodes = this.findNodeById(id);

    if (!allNodes) {
      throw new Error(`Requirement with id "${id}" not found`);
    }

    const node = allNodes;
    const relations: AtReference[] = [];

    // If this node has a parent, include it as a relation
    if (node.parent_id) {
      const parent = this.findNodeById(node.parent_id);
      if (parent) {
        relations.push({
          type: 'requirement',
          id: parent.id,
          display_name: `课标:${parent.name}`,
          summary: `${SUBJECT_MAP[parent.subject] ?? parent.subject} ${parent.name}`,
        });
      }
    }

    return {
      ref: {
        type: 'requirement',
        id: node.id,
        display_name: `课标:${node.name}`,
        summary: this.buildSummary(node),
      },
      structured: {
        name: node.name,
        level: node.level,
        subject: node.subject,
        grade_range: node.grade_range,
        sort_order: node.sort_order,
        cognitive: node.cognitive,
        parent_id: node.parent_id,
      },
      relations,
      attachments: [],
    };
  }

  async serialize(id: string, _userId: string): Promise<string> {
    const node = this.findNodeById(id);
    if (!node) throw new Error(`Requirement with id "${id}" not found`);

    const parts: string[] = [
      '---',
      `name: ${node.name}`,
      `subject: ${SUBJECT_MAP[node.subject] ?? node.subject}`,
      `level: ${node.level ?? ''}`,
      `grade_range: ${node.grade_range ?? ''}`,
      '---',
    ];

    if (node.cognitive) {
      parts.push('', `## 认知要求`, '', node.cognitive);
    }

    return parts.join('\n');
  }

  async edit(
    _id: string,
    _ops: EditOperation[],
    _userId: string,
  ): Promise<EditResult> {
    return { success: false, error: '课标要求为只读资源，不支持编辑' };
  }

  async search(query: string, _userId: string, _limit: number): Promise<AtReference[]> {
    const nodes = this.curriculumService.search(query);
    return nodes.map((node: any) => ({
      type: 'requirement',
      id: node.id,
      display_name: `课标:${node.name}`,
      summary: this.buildSummary(node),
    }));
  }

  private findNodeById(id: string): any | null {
    // Try to find the node by getting children of all subjects
    const subjects = this.curriculumService.getSubjects();
    for (const { subject } of subjects) {
      const tree = this.curriculumService.getTree(subject);
      const found = this.findInTree(tree, id);
      if (found) return found;
    }
    return null;
  }

  private findInTree(nodes: any[], id: string): any | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      // Try children
      const children = this.curriculumService.getChildren(node.id);
      if (children.length > 0) {
        const found = this.findInTree(children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private buildSummary(node: any): string {
    const parts: string[] = [];
    if (node.subject) parts.push(SUBJECT_MAP[node.subject] ?? node.subject);
    if (node.name) parts.push(node.name);
    if (node.grade_range) parts.push(`(${node.grade_range}年级)`);
    const summary = parts.join(' ');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  }
}
