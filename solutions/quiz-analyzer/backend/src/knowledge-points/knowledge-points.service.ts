import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { KnowledgePoint } from '../database/entities';
import { SearchKnowledgePointsDto } from './dto/search-knowledge-points.dto';

@Injectable()
export class KnowledgePointsService {
  constructor(
    @InjectRepository(KnowledgePoint)
    private knowledgePointsRepository: Repository<KnowledgePoint>,
  ) {}

  async search(dto: SearchKnowledgePointsDto) {
    const { query, subjectId, gradeLevel, parentId, limit = 20 } = dto;

    const queryBuilder = this.knowledgePointsRepository
      .createQueryBuilder('kp')
      .leftJoinAndSelect('kp.subject', 'subject')
      .leftJoinAndSelect('kp.parent', 'parent');

    if (query) {
      queryBuilder.andWhere('kp.name LIKE :query', { query: `%${query}%` });
    }

    if (subjectId) {
      queryBuilder.andWhere('kp.subject_id = :subjectId', { subjectId });
    }

    if (gradeLevel) {
      queryBuilder.andWhere('kp.grade_level = :gradeLevel', { gradeLevel });
    }

    if (parentId !== undefined) {
      if (parentId === null || parentId === 'null') {
        queryBuilder.andWhere('kp.parent_id IS NULL');
      } else {
        queryBuilder.andWhere('kp.parent_id = :parentId', { parentId });
      }
    }

    const knowledgePoints = await queryBuilder
      .orderBy('kp.level', 'ASC')
      .addOrderBy('kp.name', 'ASC')
      .limit(limit)
      .getMany();

    // Get children count for each
    const results = await Promise.all(
      knowledgePoints.map(async (kp) => {
        const childrenCount = await this.knowledgePointsRepository.count({
          where: { parent_id: kp.id },
        });

        return {
          id: kp.id,
          name: kp.name,
          code: kp.code,
          level: kp.level,
          grade_level: kp.grade_level,
          parent_id: kp.parent_id,
          subject_name: kp.subject?.name,
          parent_name: kp.parent?.name,
          children_count: childrenCount,
        };
      })
    );

    return {
      knowledgePoints: results,
      count: results.length,
    };
  }

  async getTree(subjectId: string, gradeLevel?: string) {
    // Get all knowledge points for the subject
    const queryBuilder = this.knowledgePointsRepository
      .createQueryBuilder('kp')
      .where('kp.subject_id = :subjectId', { subjectId });

    if (gradeLevel) {
      queryBuilder.andWhere('kp.grade_level = :gradeLevel', { gradeLevel });
    }

    const allKnowledgePoints = await queryBuilder
      .orderBy('kp.level', 'ASC')
      .addOrderBy('kp.name', 'ASC')
      .getMany();

    // Build tree structure
    const nodeMap = new Map<string, any>();

    // Create nodes
    allKnowledgePoints.forEach(kp => {
      nodeMap.set(kp.id, {
        id: kp.id,
        name: kp.name,
        code: kp.code,
        level: kp.level,
        gradeLevel: kp.grade_level,
        children: [],
      });
    });

    // Build parent-child relationships
    const roots: any[] = [];
    allKnowledgePoints.forEach(kp => {
      const node = nodeMap.get(kp.id);
      if (kp.parent_id && nodeMap.has(kp.parent_id)) {
        nodeMap.get(kp.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return {
      tree: roots,
      totalNodes: allKnowledgePoints.length,
    };
  }

  async findOne(id: string) {
    const kp = await this.knowledgePointsRepository.findOne({
      where: { id },
      relations: ['subject', 'parent', 'children'],
    });

    if (!kp) {
      throw new NotFoundException(`Knowledge point with ID ${id} not found`);
    }

    return kp;
  }
}
