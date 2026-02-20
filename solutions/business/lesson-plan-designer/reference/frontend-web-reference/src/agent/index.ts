/**
 * Agent Module
 *
 * Exports all agent-related functionality for page-driven interaction
 */

// Element Discovery
export {
  discoverFormElements,
  findElementById,
  getDOMElementByFieldId,
  inferElementType,
  extractCurrentValue,
  extractOptions,
  type AgentElement,
  type ElementType,
  type SelectOption,
  type DiscoveryOptions,
} from './element-discovery'

// Widget Registry
export {
  registerWidget,
  getWidgetDefinition,
  identifyWidget,
  getRegisteredWidgets,
  type WidgetDefinition,
  type WidgetState,
  type InteractionHint,
} from './widget-registry'

// Form Interception
export {
  onFormSubmit,
  extractValidationErrors,
  createInterceptedSubmit,
  interceptFormSubmission,
  createSubmissionTracker,
  type FormSubmitResult,
  type ValidationError,
  type FormEventCallback,
} from './form-interception'

// Agent Output Renderer (FS-Only Architecture)
// Note: SSE renderer is deprecated, output updates now come via Socket.io
export {
  LessonPlanRenderer,
  getRenderer,
  useAgentRenderer,
  type ProgressInfo,
  type AgentOutput,
  type OutputChangeEvent,
  type FormSetter,
  type ProgressListener,
} from './renderer'
