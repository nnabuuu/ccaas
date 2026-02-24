import { z } from 'zod'

export class ApiValidationError extends Error {
  readonly zodError: z.ZodError
  readonly rawData: unknown

  constructor(
    message: string,
    zodError: z.ZodError,
    rawData: unknown,
  ) {
    super(message)
    this.name = 'ApiValidationError'
    this.zodError = zodError
    this.rawData = rawData
  }
}

/**
 * Safely parse and validate API response data using Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw API response data
 * @param context - Context string for error messages (e.g., "TokenAnalytics")
 * @returns Validated and typed data
 * @throws ApiValidationError if validation fails
 */
export function parseApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    console.error(`[API Validation Error] ${context}:`, {
      errors: result.error.errors,
      receivedData: data,
    })

    throw new ApiValidationError(
      `Invalid API response for ${context}`,
      result.error,
      data,
    )
  }

  return result.data
}

/**
 * Safely parse with fallback to default value
 * Logs validation errors but doesn't throw
 */
export function parseApiResponseSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string,
  fallback: T,
): T {
  if (data === undefined) return fallback
  try {
    return parseApiResponse(schema, data, context)
  } catch (error) {
    console.warn(`[API Validation] Using fallback for ${context}:`, error)
    return fallback
  }
}
