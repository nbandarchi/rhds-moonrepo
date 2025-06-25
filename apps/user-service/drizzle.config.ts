import { createDrizzleConfig } from '@rhds/api'

export default createDrizzleConfig({
  schemaPath: './src/routes/**/*.schema.ts',
})
