// Re-export all schemas from common/ (single source of truth)
export {
  FieldSchemas,
  ErrorStepSchema,
  StudentAnswerSchema,
  EnhancedRelatedQuizSchema,
  ErrorPatternSchema,
  validateAndFixField,
} from './common/schemas.js';
