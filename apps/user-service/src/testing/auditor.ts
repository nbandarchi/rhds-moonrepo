import { OpenApiAuditor, type FileOperations } from '@rhds/api'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { createApp } from '../server'

// File operations using Node.js sync APIs to avoid async/await issues in vitest
const fileOps: FileOperations = {
  readFile: (path: string) => readFileSync(path, 'utf8'),
  writeFile: (path: string, content: string) =>
    writeFileSync(path, content, 'utf8'),
  mkdir: (path: string, options?: { recursive?: boolean }) => {
    mkdirSync(path, options)
  },
  glob: (pattern: string) => {
    // Enhanced glob implementation for various file patterns
    const lastSlash = pattern.lastIndexOf('/')
    const dir = lastSlash > 0 ? pattern.substring(0, lastSlash) : '.'
    const filePattern = pattern.substring(lastSlash + 1)

    try {
      const files = readdirSync(dir)

      if (filePattern === '*.json') {
        return files
          .filter((file) => file.endsWith('.json'))
          .map((file) => join(dir, file))
      }
      if (filePattern === '*.md') {
        return files
          .filter((file) => file.endsWith('.md'))
          .map((file) => join(dir, file))
      }
      // For more complex patterns, just return files that match the extension
      const ext = filePattern.replace('*', '')
      return files
        .filter((file) => file.endsWith(ext))
        .map((file) => join(dir, file))
    } catch {
      return []
    }
  },
  removeFile: (path: string) => {
    try {
      unlinkSync(path)
    } catch {
      // Ignore errors - file might not exist
    }
  },
}

// Create the auditor instance
export const auditor = new OpenApiAuditor({
  schemaPath: './generated/openapi-schema.json',
  trafficDir: './generated/traffic',
  reportPath: './generated/audit-report.md',
  fileOps,
})

// Export the setup function for vitest globalSetup
export default async function setup() {
  return auditor.setup(createApp)
}
