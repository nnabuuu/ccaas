export * from './types'
export { registerExerciseType, getExerciseType, getRegisteredTypes } from './registry'
// Side-effect import registers all 11 built-in types
import './built-in'
