import type { FastifyInstance } from 'fastify'

export interface TrafficRecord {
  method: string
  url: string
  status: number
  request: unknown
  response: unknown
}

export interface FileOperations {
  readFile: (path: string) => Promise<string> | string
  writeFile: (path: string, content: string) => Promise<void> | void
  mkdir: (
    path: string,
    options?: { recursive?: boolean }
  ) => Promise<void> | void
  glob: (pattern: string) => Promise<string[]> | string[]
  removeFile?: (path: string) => Promise<void> | void
}

export interface AuditorOptions {
  schemaPath: string
  trafficDir: string
  reportPath: string
  fileOps: FileOperations
}

export class OpenApiAuditor {
  private traffic: TrafficRecord[] = []

  constructor(private options: AuditorOptions) {}

  /**
   * Fastify plugin that records traffic for auditing
   */
  registerPlugin(fastify: FastifyInstance) {
    this.traffic = []

    fastify.decorate('traffic', this.traffic)

    // Initialize traffic holder on request
    fastify.addHook('onRequest', async (request) => {
      // @ts-expect-error - attach temp holder
      request.__traffic = {
        method: request.method,
        url: request.url,
        request: undefined,
      }
    })

    // Capture parsed request body after body parsing
    fastify.addHook('preHandler', async (request: any) => {
      if (request.__traffic) {
        request.__traffic.request = request.body
      }
    })

    // Capture response after serialization
    fastify.addHook('onSend', async (request: any, reply, payload) => {
      const partial = request.__traffic
      if (!partial) return

      partial.status = reply.statusCode
      partial.response = this.parseResponsePayload(payload)

      this.traffic.push(partial as TrafficRecord)
    })
  }

  /**
   * Global setup function - clears generated directory and generates OpenAPI schema
   */
  async setup(createApp: () => Promise<FastifyInstance>) {
    // Clear the generated directory to avoid lingering files
    await this.clearGeneratedDirectory()

    const app = await createApp()
    await app.ready()

    // Generate OpenAPI schema
    const schema = app.swagger()
    await this.options.fileOps.mkdir(this.getDir(this.options.schemaPath), {
      recursive: true,
    })
    await this.options.fileOps.writeFile(
      this.options.schemaPath,
      JSON.stringify(schema, null, 2)
    )

    await app.close()
    console.log('✅ OpenAPI schema generated at:', this.options.schemaPath)

    // Return teardown function
    return () => this.teardown()
  }

  /**
   * Global teardown function - writes traffic and generates audit report
   */
  async teardown() {
    console.log('📊 Global teardown: Starting OpenAPI traffic audit...')

    try {
      // Write traffic data
      console.log(this.traffic.length)
      if (this.traffic.length > 0) {
        await this.options.fileOps.mkdir(this.options.trafficDir, {
          recursive: true,
        })
        const trafficPath = `${this.options.trafficDir}/integration-tests-traffic.json`
        await this.options.fileOps.writeFile(
          trafficPath,
          JSON.stringify(this.traffic, null, 2)
        )
        console.log(
          `📊 Traffic data written: ${trafficPath} (${this.traffic.length} requests)`
        )
      }

      // Generate audit report
      const report = await this.generateAuditReport()
      await this.options.fileOps.mkdir(this.getDir(this.options.reportPath), {
        recursive: true,
      })
      await this.options.fileOps.writeFile(this.options.reportPath, report)

      console.log(
        `✅ OpenAPI audit report generated: ${this.options.reportPath}`
      )
    } catch (error) {
      console.error('❌ Failed to generate audit report:', error)
    }

    console.log('🏁 Global teardown completed')
  }

  /**
   * Utility to get traffic data for manual writing in tests
   */
  getTraffic(): TrafficRecord[] {
    return [...this.traffic]
  }

  /**
   * Writes current traffic to a named file - called from test afterAll
   */
  async writeTraffic(testSuiteName: string): Promise<void> {
    try {
      if (this.traffic.length === 0) {
        console.log(`No traffic to write for ${testSuiteName}`)
        return
      }

      // Ensure traffic directory exists
      const mkdirResult = this.options.fileOps.mkdir(this.options.trafficDir, {
        recursive: true,
      })
      // Handle both sync and async mkdir
      if (mkdirResult instanceof Promise) {
        await mkdirResult
      }

      // Write traffic to named file
      const trafficPath = `${this.options.trafficDir}/${testSuiteName}.json`
      const writeResult = this.options.fileOps.writeFile(
        trafficPath,
        JSON.stringify(this.traffic, null, 2)
      )
      // Handle both sync and async writeFile
      if (writeResult instanceof Promise) {
        await writeResult
      }

      console.log(
        `📊 Traffic written: ${trafficPath} (${this.traffic.length} requests)`
      )

      // Clear traffic for next test suite
      this.traffic = []
    } catch (error) {
      console.error(`Failed to write traffic for ${testSuiteName}:`, error)
    }
  }

  /**
   * Clears the generated directory to ensure clean state
   */
  private async clearGeneratedDirectory(): Promise<void> {
    try {
      // Get the directory containing the generated files
      const generatedDir = this.getDir(this.options.schemaPath)

      // Try to get list of files in the directories we care about
      const schemaFiles = await this.safeGlob(`${generatedDir}/*.json`)
      const trafficFiles = await this.safeGlob(
        `${this.options.trafficDir}/*.json`
      )
      const reportFiles = await this.safeGlob(`${generatedDir}/*.md`)

      const allFiles = [...schemaFiles, ...trafficFiles, ...reportFiles]

      if (allFiles.length > 0) {
        console.log(
          `🧹 Clearing ${allFiles.length} files from generated directories`
        )

        // Remove files if removeFile operation is available
        if (this.options.fileOps.removeFile) {
          for (const file of allFiles) {
            const removeResult = this.options.fileOps.removeFile(file)
            if (removeResult instanceof Promise) {
              await removeResult
            }
          }
        }
      }
    } catch (error) {
      // Silently ignore errors - directory might not exist yet
    }
  }

  /**
   * Safe wrapper around glob that handles both sync and async results
   */
  private async safeGlob(pattern: string): Promise<string[]> {
    try {
      const result = this.options.fileOps.glob(pattern)
      if (result instanceof Promise) {
        return await result
      }
      return result
    } catch {
      return []
    }
  }

  private async generateAuditReport(): Promise<string> {
    // Load OpenAPI schema
    const schemaContent = await this.options.fileOps.readFile(
      this.options.schemaPath
    )
    const schema = JSON.parse(schemaContent)

    // Load all traffic files
    const trafficFiles = await this.options.fileOps.glob(
      `${this.options.trafficDir}/*.json`
    )
    const allTraffic: TrafficRecord[] = []

    for (const file of trafficFiles) {
      const content = await this.options.fileOps.readFile(file)
      const traffic = JSON.parse(content) as TrafficRecord[]
      allTraffic.push(...traffic)
    }

    if (allTraffic.length === 0) {
      return this.generateEmptyReport()
    }

    return this.generateReport(schema, allTraffic)
  }

  private generateReport(schema: any, traffic: TrafficRecord[]): string {
    const paths = schema.paths || {}
    const testedPaths = new Set<string>()
    const testedMethodsWithStatus = new Map<string, Map<string, Set<number>>>() // path -> method -> status codes
    const undocumentedEndpoints = new Map<string, Set<number>>() // path -> status codes

    // Analyze traffic
    for (const record of traffic) {
      const normalizedPath = this.normalizePathForSchema(record.url, paths)
      if (normalizedPath) {
        // Documented endpoint
        testedPaths.add(normalizedPath)

        if (!testedMethodsWithStatus.has(normalizedPath)) {
          testedMethodsWithStatus.set(normalizedPath, new Map())
        }
        const methodMap = testedMethodsWithStatus.get(normalizedPath)
        if (!methodMap) {
          throw new Error(`No method map found for path: ${normalizedPath}`)
        }
        const method = record.method.toLowerCase()

        if (!methodMap.has(method)) {
          methodMap.set(method, new Set())
        }

        methodMap.get(method)?.add(record.status)
      } else {
        // Undocumented endpoint
        const pathKey = `${record.method.toUpperCase()} ${record.url}`
        if (!undocumentedEndpoints.has(pathKey)) {
          undocumentedEndpoints.set(pathKey, new Set())
        }
        const statuses = undocumentedEndpoints.get(pathKey)
        if (!statuses) {
          throw new Error(`No statuses found for path: ${pathKey}`)
        }
        statuses.add(record.status)
      }
    }

    // Calculate totals for documented endpoints
    const totalPaths = Object.keys(paths).length
    let totalMethodStatusCombos = 0
    let testedMethodStatusCombos = 0

    for (const [pathKey, pathObj] of Object.entries<any>(paths)) {
      const methods = Object.keys(pathObj).filter((key) => key !== 'parameters')
      for (const method of methods) {
        const responses = pathObj[method]?.responses || {}
        const statusCodes = Object.keys(responses)
        totalMethodStatusCombos += statusCodes.length

        // Count tested combinations
        const testedStatuses =
          testedMethodsWithStatus.get(pathKey)?.get(method) || new Set()
        for (const status of statusCodes) {
          if (testedStatuses.has(Number(status))) {
            testedMethodStatusCombos++
          }
        }
      }
    }

    // Generate report
    let report = '# OpenAPI Traffic Audit Report\n\n'
    report += `**Generated:** ${new Date().toISOString()}\n\n`
    report += '## Coverage Summary\n\n'
    report += `- **Paths Tested:** ${testedPaths.size}/${totalPaths} (${Math.round((testedPaths.size / totalPaths) * 100)}%)\n`
    report += `- **Method/Status Combinations Tested:** ${testedMethodStatusCombos}/${totalMethodStatusCombos} (${Math.round((testedMethodStatusCombos / totalMethodStatusCombos) * 100)}%)\n`
    report += `- **Total Requests:** ${traffic.length}\n`
    if (undocumentedEndpoints.size > 0) {
      report += `- **Undocumented Endpoints Found:** ${undocumentedEndpoints.size}\n`
    }
    report += '\n'

    // Undocumented endpoints section
    if (undocumentedEndpoints.size > 0) {
      report += '## 🚨 Undocumented Endpoints\n\n'
      report +=
        '*These endpoints were found in traffic but are not documented in the OpenAPI schema:*\n\n'
      for (const [pathKey, statusCodes] of undocumentedEndpoints) {
        report += `### \`${pathKey}\`\n`
        const sortedStatuses = Array.from(statusCodes).sort()
        report += `- Status codes: ${sortedStatuses.join(', ')}\n\n`
      }
    }

    // Tested endpoints with status breakdown
    report += '## ✅ Tested Endpoints\n\n'
    for (const [path, methodMap] of testedMethodsWithStatus) {
      report += `### \`${path}\`\n`
      for (const [method, statusCodes] of methodMap) {
        const sortedStatuses = Array.from(statusCodes).sort()
        report += `- **${method.toUpperCase()}**: ${sortedStatuses.join(', ')}\n`
      }
      report += '\n'
    }

    // Untested endpoints with status breakdown
    const untestedPaths = Object.keys(paths).filter(
      (path) => !testedPaths.has(path)
    )
    const partiallyTestedPaths: string[] = []

    // Check for partially tested paths (some method/status combos missing)
    for (const [pathKey, pathObj] of Object.entries<any>(paths)) {
      if (testedPaths.has(pathKey)) {
        const methods = Object.keys(pathObj).filter(
          (key) => key !== 'parameters'
        )
        let hasUntestedCombos = false

        for (const method of methods) {
          const responses = pathObj[method]?.responses || {}
          const expectedStatuses = Object.keys(responses).map(Number)
          const testedStatuses =
            testedMethodsWithStatus.get(pathKey)?.get(method) || new Set()

          if (expectedStatuses.some((status) => !testedStatuses.has(status))) {
            hasUntestedCombos = true
            break
          }
        }

        if (hasUntestedCombos) {
          partiallyTestedPaths.push(pathKey)
        }
      }
    }

    if (untestedPaths.length > 0 || partiallyTestedPaths.length > 0) {
      report += '## ❌ Missing Coverage\n\n'

      // Completely untested paths
      if (untestedPaths.length > 0) {
        report += '### Completely Untested Endpoints\n\n'
        for (const path of untestedPaths) {
          report += `#### \`${path}\`\n`
          const methods = Object.keys(paths[path]).filter(
            (key) => key !== 'parameters'
          )
          for (const method of methods) {
            const responses = paths[path][method]?.responses || {}
            const statusCodes = Object.keys(responses).join(', ')
            report += `- **${method.toUpperCase()}**: ${statusCodes}\n`
          }
          report += '\n'
        }
      }

      // Partially tested paths
      if (partiallyTestedPaths.length > 0) {
        report += '### Missing Status Code Coverage\n\n'
        for (const path of partiallyTestedPaths) {
          report += `#### \`${path}\`\n`
          const methods = Object.keys(paths[path]).filter(
            (key) => key !== 'parameters'
          )
          for (const method of methods) {
            const responses = paths[path][method]?.responses || {}
            const expectedStatuses = Object.keys(responses).map(Number)
            const testedStatuses =
              testedMethodsWithStatus.get(path)?.get(method) || new Set()
            const missingStatuses = expectedStatuses.filter(
              (status) => !testedStatuses.has(status)
            )

            if (missingStatuses.length > 0) {
              report += `- **${method.toUpperCase()}**: Missing ${missingStatuses.join(', ')}\n`
            }
          }
          report += '\n'
        }
      }
    }

    return report
  }

  private generateEmptyReport(): string {
    return `# OpenAPI Traffic Audit Report\n\n**Generated:** ${new Date().toISOString()}\n\n⚠️ No traffic data found. Make sure integration tests are running with traffic recording enabled.\n`
  }

  private normalizePathForSchema(
    url: string,
    schemaPaths: Record<string, any>
  ): string | null {
    // Remove query parameters
    const cleanUrl = url.split('?')[0]

    // Try exact match first
    if (schemaPaths[cleanUrl]) return cleanUrl

    // Try to match parameterized paths
    for (const schemaPath of Object.keys(schemaPaths)) {
      const pattern = schemaPath.replace(/\{[^}]+\}/g, '[^/]+')
      const regex = new RegExp(`^${pattern}$`)
      if (regex.test(cleanUrl)) {
        return schemaPath
      }
    }

    return null
  }

  private parseResponsePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload)
      } catch {
        return payload
      }
    }
    return payload
  }

  private getDir(filePath: string): string {
    return filePath.split('/').slice(0, -1).join('/')
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    traffic: TrafficRecord[]
  }
}
