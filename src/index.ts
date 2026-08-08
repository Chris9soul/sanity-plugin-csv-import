import { definePlugin } from 'sanity'
import { UploadIcon } from '@sanity/icons'

import { createCsvImportTool } from './CsvImportTool'
import type { CsvImportPluginOptions } from './types'

export { parseCsv } from './csv'
export { applyTransform, coerceForFieldType, slugify, TRANSFORMS } from './transforms'
export { buildDocument } from './buildDocument'
export { generateSchemaFile, toFieldName, toTitle, toTypeName } from './schemaCodegen'
export { listDocumentTypes, listImportableFields } from './schemaIntrospection'
export type * from './types'

export const csvImportPlugin = definePlugin<CsvImportPluginOptions | void>(
  (options) => ({
    name: 'sanity-plugin-csv-import',
    tools: [
      {
        name: 'csv-import',
        title: 'Import CSV',
        icon: UploadIcon,
        component: createCsvImportTool(options?.schemaFileWriter),
      },
    ],
  }),
)
