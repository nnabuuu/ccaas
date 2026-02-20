/**
 * Error-Based Similarity Algorithms
 *
 * Multi-factor weighted scoring for quiz recommendation based on error patterns:
 * - 40% Error Type Similarity: Same error types indicate similar confusion patterns
 * - 30% Error Step Similarity: Step position matters (early vs late mistakes)
 * - 30% Knowledge Point Similarity: Original algorithm as fallback
 */

import { ErrorStep, ErrorPattern, ErrorType } from './types.js';

/**
 * Calculate Jaccard similarity on error type sets
 * Measures overlap between student's error types and quiz's error patterns
 *
 * @param targetErrors - Errors from student's answer
 * @param candidateErrorPatterns - Aggregated error patterns from candidate quiz
 * @returns Similarity score 0.0-1.0
 */
export function calculateErrorTypeSimilarity(
  targetErrors: ErrorStep[],
  candidateErrorPatterns: ErrorPattern[]
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
      // High frequency = common mistake = valuable practice
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
      primaryMatchBonus = 0.2; // Significant bonus for matching primary error
    }
  }

  // Enhancement 3: Multiple shared error types = cumulative bonus
  let multipleMatchBonus = 0;
  if (intersection.size >= 2) {
    multipleMatchBonus = Math.min(0.15, intersection.size * 0.05);
  }

  // Combine base similarity with enhancements (capped at 1.0)
  return Math.min(1.0, baseSimilarity + frequencyBonus + primaryMatchBonus + multipleMatchBonus);
}

/**
 * Calculate step position similarity with exponential decay
 * Errors at similar step positions indicate similar solution difficulty curves
 *
 * Decay function: e^(-0.5 * distance)
 * - Same step = 1.0 similarity
 * - 1 step off = 0.61 similarity
 * - 2 steps off = 0.37 similarity
 * - 3+ steps off = < 0.22 similarity
 *
 * @param targetErrors - Errors from student's answer
 * @param candidateErrorPatterns - Aggregated error patterns from candidate quiz
 * @returns Similarity score 0.0-1.0
 */
export function calculateStepSimilarity(
  targetErrors: ErrorStep[],
  candidateErrorPatterns: ErrorPattern[]
): number {
  if (targetErrors.length === 0 || candidateErrorPatterns.length === 0) {
    return 0;
  }

  let totalSimilarity = 0;
  let matchCount = 0;

  for (const targetError of targetErrors) {
    for (const candidatePattern of candidateErrorPatterns) {
      // Only compare same error types
      if (targetError.errorType === candidatePattern.errorType) {
        // Handle null step numbers (error not tied to specific step)
        const candidateStep = candidatePattern.stepNumber ?? 0;
        const stepDistance = Math.abs(targetError.stepNumber - candidateStep);

        // Exponential decay: e^(-0.5 * distance)
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
 * Original algorithm from existing system - measures concept overlap
 *
 * @param targetKPs - Knowledge point IDs from student's answer analysis
 * @param candidateKPs - Knowledge point IDs from candidate quiz
 * @returns Similarity score 0.0-1.0
 */
export function calculateKnowledgePointSimilarity(
  targetKPs: string[],
  candidateKPs: string[]
): number {
  if (targetKPs.length === 0 || candidateKPs.length === 0) {
    return 0;
  }

  const targetSet = new Set(targetKPs);
  const candidateSet = new Set(candidateKPs);

  // Jaccard similarity: intersection / union
  const intersection = new Set([...targetSet].filter(kp => candidateSet.has(kp)));
  const union = new Set([...targetSet, ...candidateSet]);

  return intersection.size / union.size;
}

/**
 * Calculate overall similarity score using weighted combination
 *
 * Formula:
 * overallSimilarity =
 *   (errorTypeSimilarity × 0.40) +
 *   (errorStepSimilarity × 0.30) +
 *   (knowledgePointSimilarity × 0.30)
 *
 * Weights Rationale:
 * - 40% Error Type: Most important - same error type = similar confusion
 * - 30% Error Step: Step position matters (early vs late mistakes are different)
 * - 30% Knowledge Point: Keep original similarity for fallback
 *
 * @param errorTypeSim - Error type similarity (0.0-1.0)
 * @param errorStepSim - Error step similarity (0.0-1.0)
 * @param knowledgePointSim - Knowledge point similarity (0.0-1.0)
 * @returns Overall similarity score 0.0-1.0
 */
export function calculateOverallSimilarity(
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
 * Extract unique keywords from natural language description
 * Used for semantic similarity matching (simple implementation)
 *
 * Future enhancement: Use OpenAI embeddings API for better semantic matching
 *
 * @param description - Natural language error description
 * @returns Array of lowercase keywords
 */
export function extractKeywords(description: string): Set<string> {
  // Remove punctuation and split into words
  const words = description
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // Keep Chinese characters
    .split(/\s+/)
    .filter(word => word.length > 1); // Remove single characters

  // Filter out common stop words (Chinese and English)
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '这', '他',
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'was', 'are', 'were', 'been', 'be'
  ]);

  return new Set(words.filter(word => !stopWords.has(word)));
}

/**
 * Calculate Jaccard similarity between two keyword sets
 *
 * @param set1 - First keyword set
 * @param set2 - Second keyword set
 * @returns Similarity score 0.0-1.0
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) {
    return 0;
  }

  const intersection = new Set([...set1].filter(k => set2.has(k)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate natural language description similarity (optional enhancement)
 * Uses simple keyword matching - can be improved with ML embeddings
 *
 * @param targetDescription - Target error description
 * @param candidateDescriptions - Candidate error descriptions
 * @returns Maximum similarity score 0.0-1.0
 */
export function calculateDescriptionSimilarity(
  targetDescription: string,
  candidateDescriptions: string[]
): number {
  if (!targetDescription || candidateDescriptions.length === 0) {
    return 0;
  }

  const targetKeywords = extractKeywords(targetDescription);

  let maxSimilarity = 0;
  for (const candidateDesc of candidateDescriptions) {
    const candidateKeywords = extractKeywords(candidateDesc);
    const similarity = jaccardSimilarity(targetKeywords, candidateKeywords);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

/**
 * Generate human-readable recommendation reason
 * Explains why this quiz is recommended based on error patterns
 *
 * @param errorTypes - Matched error types
 * @param totalOccurrences - Total times this error occurred
 * @param matchedSteps - Step numbers where errors match
 * @returns Natural language explanation in Chinese
 */
export function generateRecommendationReason(
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
