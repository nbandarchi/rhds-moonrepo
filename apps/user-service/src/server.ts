import Fastify from 'fastify'
import { UserRepository } from './routes/users/users.repository'
import { createDbClient } from './db/client'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from './db/schema'
import { registerUserRoutes } from './routes/users/users.routes'
import FastifySwagger from '@fastify/swagger'
import FastifySwaggerUi from '@fastify/swagger-ui'

type Repositories = {
    users: UserRepository
}

declare module 'fastify' {
    interface FastifyInstance {
        db: NodePgDatabase<typeof schema>
        repositories: Repositories
    }
}

export async function createApp() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    })

    await fastify.register(FastifySwagger, {
        openapi: {
            info: {
                title: 'User Service API',
                version: '1.0.0',
            },
        },
    })

    await fastify.register(FastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'full',
            deepLinking: true,
        },
    })

    // Create database client and attach to app
    const { db } = createDbClient()
    fastify.decorate('db', db)

    // Create repositories and attach to app
    fastify.decorate('repositories', {
        users: new UserRepository(db),
    })

    // Error handling
    fastify.setErrorHandler((error, _, reply) => {
        const statusCode = error.statusCode || 500

        reply.status(statusCode).send({
            error: true,
            message: error.message,
            statusCode,
        })
    })

    registerUserRoutes(fastify)

    return fastify
}
