import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  RouteShorthandOptions,
} from 'fastify'
import type { z, ZodType } from 'zod'
import { type JsonSchema7Type, zodToJsonSchema } from 'zod-to-json-schema'

export interface RouteSchema {
  body?: ZodType
  querystring?: ZodType
  params?: ZodType
  response?: Record<number, ZodType>
}

export type TypedRouteHandler<S extends RouteSchema> = (context: {
  body: S['body'] extends ZodType ? z.infer<S['body']> : undefined
  query: S['querystring'] extends ZodType
    ? z.infer<S['querystring']>
    : undefined
  params: S['params'] extends ZodType ? z.infer<S['params']> : undefined
  request: FastifyRequest
  reply: FastifyReply
  repositories: FastifyInstance['repositories']
}) => Promise<unknown>

function buildFastifySchema(
  routeSchema: RouteSchema
): RouteShorthandOptions['schema'] {
  const schema: RouteShorthandOptions['schema'] = {}
  if (routeSchema.body) {
    schema.body = zodToJsonSchema(routeSchema.body)
  }
  if (routeSchema.querystring) {
    schema.querystring = zodToJsonSchema(routeSchema.querystring)
  }
  if (routeSchema.params) {
    schema.params = zodToJsonSchema(routeSchema.params)
  }
  if (routeSchema.response) {
    const response = {} as Record<string, JsonSchema7Type>
    for (const statusCode in routeSchema.response) {
      response[statusCode] = zodToJsonSchema(routeSchema.response[statusCode])
    }
    schema.response = response
  }
  return schema
}

export function createRouteRegistry(fastify: FastifyInstance, prefix?: string) {
  const registerRoute = <S extends RouteSchema>(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    schemaDef: S,
    handler: TypedRouteHandler<S>
  ) => {
    const fastifySchema = buildFastifySchema(schemaDef)

    const url = prefix ? (path === '/' ? prefix : `${prefix}${path}`) : path

    fastify.route({
      method: method.toUpperCase() as
        | 'GET'
        | 'POST'
        | 'PUT'
        | 'DELETE'
        | 'PATCH',
      url,
      schema: fastifySchema,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        return handler({
          body: request.body as S['body'] extends ZodType
            ? z.infer<S['body']>
            : undefined,
          query: request.query as S['querystring'] extends ZodType
            ? z.infer<S['querystring']>
            : undefined,
          params: request.params as S['params'] extends ZodType
            ? z.infer<S['params']>
            : undefined,
          request,
          reply,
          repositories: fastify.repositories,
        })
      },
    })
  }

  return {
    registerRoute,
    get: <S extends RouteSchema>(
      path: string,
      schemaDef: S,
      handler: TypedRouteHandler<S>
    ) => registerRoute('get', path, schemaDef, handler),
    post: <S extends RouteSchema>(
      path: string,
      schemaDef: S,
      handler: TypedRouteHandler<S>
    ) => registerRoute('post', path, schemaDef, handler),
    put: <S extends RouteSchema>(
      path: string,
      schemaDef: S,
      handler: TypedRouteHandler<S>
    ) => registerRoute('put', path, schemaDef, handler),
    delete: <S extends RouteSchema>(
      path: string,
      schemaDef: S,
      handler: TypedRouteHandler<S>
    ) => registerRoute('delete', path, schemaDef, handler),
    patch: <S extends RouteSchema>(
      path: string,
      schemaDef: S,
      handler: TypedRouteHandler<S>
    ) => registerRoute('patch', path, schemaDef, handler),
  }
}
