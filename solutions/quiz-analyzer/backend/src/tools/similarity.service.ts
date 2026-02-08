/**
 * Error-Based Similarity Algorithms
 *
 * Multi-factor weighted scoring for quiz recommendation based on error patterns:
 * - 40% Error Type Similarity: Same error types indicate similar confusion patterns
 * - 30% Error Step Similarity: Step position matters (early vs late mistakes)
 * - 30% Knowledge Point Similarity: Original algorithm as fallback
 */

import { Injectable } from '@nestjs/common';
import { ErrorStepInterface, ErrorPatternInterface, ErrorType } from './types';

@Injectable()
export class SimilarityService {
  /**
   * Calculate Jaccard similarity on error type sets
   * Measures overlap between student's error types and quiz's error patterns
   */
  calculateErrorTypeSimilarity(
    targetErrors: ErrorStepInterface[],
    candidateErrorPatterns: ErrorPatternInterface[]
  ): number {
    if (targetErrors.length === 0 || candidateErrorPatterns.length === 0) {
      return 0;
    }

    // Extract unique error types
    const targetTypes = new Set(targetErrors.map(e => e.errorType));
    const candidateTypes = new Set(candidateErrorPatterns.map(p => p.errorType));

    // Jaccard similarity: intersection / union
    const intersection = new Set([...targetTypes].filter(t => candidateTypes.has(t)));
    const union = new Set([...targetTypes, ...candidateTypes]);

    let baseSimilarity = intersection.size / union.size;

    // Enhancement 1: Boost score for high-frequency error matches
    let frequencyBonus = 0;
    for (const errorType of intersection) {
      const pattern = candidateErrorPatterns.find(p => p.errorType === errorType);
      if (pattern && pattern.totalOccurrences > 10) {
        frequencyBonus += Math.min(0.1, pattern.totalOccurrences / 200);
      }
    }

    // Enhancement 2: Exact match on primary error type (most severe)
    const primaryTargetError = targetErrors
      .filter(e => e.severity === 'critical')
      .sort((a, b) => a.stepNumber - b.stepNumber)[0];

    let primaryMatchBonus = 0;
    if (primaryTargetError) {
      const matchingPattern = candidateErrorPatterns.find(
        p => p.errorType === primaryTargetError.errorType
      );
      if (matchingPattern) {
        primaryMatchBonus = 0.2;
      }
    }

    // Enhancement 3: Multiple shared error types = cumulative bonus
    let multipleMatchBonus = 0;
    if (intersection.size >= 2) {
      multipleMatchBonus = Math.min(0.15, intersection.size * 0.05);
    }

    return Math.min(1.0, baseSimilarity + frequencyBonus + primaryMatchBonus + multipleMatchBonus);
  }

  /**
   * Calculate step position similarity with exponential decay
   * Errors at similar step positions indicate similar solution difficulty curves
   */
  calculateStepSimilarity(
    targetErrors: ErrorStepInterface[],
    candidateErrorPatterns: ErrorPatternInterface[]
  ): number {
    if (targetErrors.length === 0 || candidateErrorPatterns.length === 0) {
      return 0;
    }

    let totalSimilarity = 0;
    let matchCount = 0;

    for (const targetError of targetErrors) {
      for (const candidatePattern of candidateErrorPatterns) {
        if (targetError.errorType === candidatePattern.errorType) {
          const candidateStep = candidatePattern.stepNumber ?? 0;
          const stepDistance = Math.abs(targetError.stepNumber - candidateStep);
          const similarity = Math.exp(-0.5 * stepDistance);
          totalSimilarity += similarity;
          matchCount++;
        }
      }
    }

    return matchCount > 0 ? totalSimilarity / matchCount : 0;
  }

  /**
   * Calculate knowledge point similarity using Jaccard index
   */
  calculateKnowledgePointSimilarity(
    targetKPs: string[],
    candidateKPs: string[]
  ): number {
    if (targetKPs.length === 0 || candidateKPs.length === 0) {
      return 0;
    }

    const targetSet = new Set(targetKPs);
    const candidateSet = new Set(candidateKPs);

    const intersection = new Set([...targetSet].filter(kp => candidateSet.has(kp)));
    const union = new Set([...targetSet, ...candidateSet]);

    return intersection.size / union.size;
  }

  /**
   * Calculate overall similarity score using weighted combination
   */
  calculateOverallSimilarity(
    errorTypeSim: number,
    errorStepSim: number,
    knowledgePointSim: number
  ): number {
    return (
      errorTypeSim * 0.40 +
      errorStepSim * 0.30 +
      knowledgePointSim * 0.30
    );
  }

  /**
   * Generate human-readable recommendation reason
   */
  generateRecommendationReason(
    errorTypes: ErrorType[],
    totalOccurrences: number,
    matchedSteps: number[]
  ): string {
    const errorTypeNames: Record<ErrorType, string> = {
      [ErrorType.CONCEPT_MISUNDERSTANDING]: '概念理解错误',
      [ErrorType.CALCULATION_ERROR]: '计算错误',
      [ErrorType.FORMULA_MISUSE]: '公式应用错误',
      [ErrorType.STEP_OMISSION]: '步骤遗漏',
      [ErrorType.STEP_ORDER_WRONG]: '步骤顺序错误',
      [ErrorType.CONDITION_NEGLECT]: '条件遗漏',
      [ErrorType.REASONING_ERROR]: '推理错误',
      [ErrorType.SYMBOL_CONFUSION]: '符号混淆',
      [ErrorType.UNIT_CONVERSION_ERROR]: '单位换算错误',
      [ErrorType.RANGE_ERROR]: '取值范围错误',
      [ErrorType.SPECIAL_CASE_NEGLECT]: '特殊情况遗漏',
      [ErrorType.OTHER]: '其他错误',
    };

    const primaryError = errorTypes[0];
    const primaryErrorName = errorTypeNames[primaryError] || '错误';

    let reason = `这道题有${totalOccurrences}位学生`;

    if (matchedSteps.length > 0) {
      const stepStr = matchedSteps.length === 1
        ? `第${matchedSteps[0]}步`
        : `第${matchedSteps.join('、')}步`;
      reason += `在${stepStr}`;
    }

    reason += `犯了相同的${primaryErrorName}`;

    if (errorTypes.length > 1) {
      const additionalErrors = errorTypes.slice(1).map(et => errorTypeNames[et]).join('、');
      reason += `，还涉及${additionalErrors}`;
    }

    reason += '，可以帮助巩固相关知识点';

    return reason;
  }
}
