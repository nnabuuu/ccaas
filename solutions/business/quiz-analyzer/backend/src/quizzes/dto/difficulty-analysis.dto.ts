import {
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

// 挑战性方面
export class ChallengingAspectDto {
  @IsString()
  aspect: string; // 例如："概念理解"、"计算复杂度"、"陷阱识别"

  @IsString()
  description: string; // 详细描述

  @IsEnum(['低', '中', '高'])
  difficulty: '低' | '中' | '高';

  @IsString()
  affectedStudents: string; // 例如："约70%的学生在这里遇到困难"
}

// 前置知识要求
export class PrerequisiteKnowledgeDto {
  @IsString()
  topic: string; // 知识点名称

  @IsEnum(['必需', '重要', '有帮助'])
  importance: '必需' | '重要' | '有帮助';

  @IsString()
  lackImpact: string; // 缺失该知识会导致什么问题
}

// 时间估算（分层）
export class TimeEstimateDto {
  @IsString()
  fastLearner: string; // 例如："5-8分钟"

  @IsString()
  averageLearner: string; // 例如："10-15分钟"

  @IsString()
  slowLearner: string; // 例如："20-30分钟"

  @IsString()
  rationale: string; // 时间估算的理由
}

// 适用性信息
export class SuitabilityInfoDto {
  @IsString()
  gradeLevel: string; // 例如："初三及以上"

  @IsString()
  priorKnowledge: string; // 例如："已学习一元二次方程基本概念"

  @IsString()
  recommendedUse: string; // 例如："作为因式分解单元的巩固练习"
}

// 难度分析（完整结构）
export class DifficultyAnalysisDto {
  @IsString()
  overview: string; // 总体难度描述："简单"、"较易"、"中等"、"较难"、"困难"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChallengingAspectDto)
  challengingAspects: ChallengingAspectDto[]; // 挑战性方面（1-5个）

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrerequisiteKnowledgeDto)
  prerequisiteKnowledge: PrerequisiteKnowledgeDto[]; // 前置知识（1-10个）

  @IsArray()
  @IsString({ each: true })
  commonDifficulties: string[]; // 常见困难（文本列表）

  @IsObject()
  @ValidateNested()
  @Type(() => TimeEstimateDto)
  timeEstimate: TimeEstimateDto; // 分层时间估算

  @IsObject()
  @ValidateNested()
  @Type(() => SuitabilityInfoDto)
  suitableFor: SuitabilityInfoDto; // 适用性分析

  @IsOptional()
  @IsString()
  teacherNotes?: string; // 给教师的额外建议（可选）

  @IsOptional()
  @IsString()
  studentNotes?: string; // 给学生的额外建议（可选）
}
