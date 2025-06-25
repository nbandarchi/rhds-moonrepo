import { z } from 'zod'
import type { ZodType } from 'zod'

const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format for ID parameter.'),
})

const NotFoundResponseSchema = z.object({ message: z.string() })
const BadRequestResponseSchema = z.object({ message: z.string() })

export const SchemaBuilder = {
  getById<TEntity extends ZodType>(entitySchema: TEntity) {
    return {
      params: UuidParamSchema,
      response: {
        200: entitySchema,
        400: BadRequestResponseSchema,
        404: NotFoundResponseSchema,
      },
    }
  },

  getAll<TEntity extends ZodType>(entitySchema: TEntity) {
    return {
      response: {
        200: z.array(entitySchema),
      },
    }
  },

  post<TEntity extends ZodType, TInsert extends ZodType>(
    entitySchema: TEntity,
    insertSchema: TInsert
  ) {
    return {
      body: insertSchema,
      response: {
        200: entitySchema,
        400: BadRequestResponseSchema,
      },
    }
  },

  update<TEntity extends ZodType, TUpdate extends ZodType>(
    entitySchema: TEntity,
    updateSchema: TUpdate
  ) {
    return {
      params: UuidParamSchema,
      body: updateSchema,
      response: {
        200: entitySchema,
        400: BadRequestResponseSchema,
        404: NotFoundResponseSchema,
      },
    }
  },

  delete(entitySchema?: ZodType) {
    return {
      params: UuidParamSchema,
      response: {
        200: entitySchema || z.object({ id: z.string(), deleted: z.boolean() }),
        400: BadRequestResponseSchema,
        404: NotFoundResponseSchema,
      },
    }
  },
}
