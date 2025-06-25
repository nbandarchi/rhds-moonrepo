import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'RHDSApi',
            fileName: 'index',
            formats: ['es']
        },
        rollupOptions: {
            external: [
                'fastify',
                'fastify-plugin',
                'drizzle-orm',
                'drizzle-orm/pg-core',
                'drizzle-orm/node-postgres',
                'pg',
                'pg-cloudflare',
                'zod',
                'zod-to-json-schema',
                'openai',
                'openai/resources/chat',
                'node:child_process',
                'node:util'
            ]
        }
    },
    plugins: [
        dts({
            insertTypesEntry: true
        })
    ]
})