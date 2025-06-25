import createError from '@fastify/error'

/**
 * NotFoundError (HTTP 404)
 * Thrown when a requested resource cannot be found.
 */
export const NotFoundError = createError(
  'RHDS_NOT_FOUND',
  '%s',
  404,
)

/**
 * ValidationError (HTTP 400)
 * Thrown when a request payload fails validation.
 * A placeholder ("%s") is available to inject the validation message.
 */
export const ValidationError = createError(
  'RHDS_VALIDATION',
  'Validation error: %s',
  400,
)

/**
 * ConflictError (HTTP 409)
 * Thrown when a request results in a conflict, e.g., duplicate data.
 * A placeholder ("%s") is available to inject a conflict detail message.
 */
export const ConflictError = createError(
  'RHDS_CONFLICT',
  'Conflict error: %s',
  409,
)

/**
 * UnauthorizedError (HTTP 401)
 * Thrown when authentication fails or credentials are missing.
 */
export const UnauthorizedError = createError(
  'RHDS_UNAUTHORIZED',
  'Unauthorized',
  401,
)

/**
 * ForbiddenError (HTTP 403)
 * Thrown when a user is authenticated but not allowed to perform the operation.
 */
export const ForbiddenError = createError(
  'RHDS_FORBIDDEN',
  'Forbidden',
  403,
)

/**
 * Utility type for any RHDS-specific Fastify error.
 */
export type RhdsFastifyError =
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof ConflictError>
  | InstanceType<typeof UnauthorizedError>
  | InstanceType<typeof ForbiddenError>
