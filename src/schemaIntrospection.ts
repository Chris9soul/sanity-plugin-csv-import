import type { Schema } from 'sanity'
import type { ImportableFieldType } from './types'

/**
 * Reads document types and their importable fields from the Studio's compiled
 * schema registry (via useSchema()), so the mapping UI always matches the
 * schema the Studio actually loaded.
 */

export type DocumentTypeInfo = {
  name: string
  title: string
}

export type SchemaFieldInfo = {
  name: string
  title: string
  fieldType: ImportableFieldType
}

const DIRECT_TYPES = new Set<ImportableFieldType>([
  'string',
  'text',
  'number',
  'boolean',
  'slug',
  'datetime',
  'date',
  'url',
  'email',
])

type CompiledField = {
  name: string
  type?: { name?: string; title?: string; of?: { name?: string }[] }
}

export function listDocumentTypes(schema: Schema): DocumentTypeInfo[] {
  return schema
    .getTypeNames()
    .map((name) => schema.get(name))
    .filter(
      (t): t is NonNullable<typeof t> =>
        !!t &&
        t.type?.name === 'document' &&
        !t.name.startsWith('sanity.') &&
        !t.name.startsWith('media.'),
    )
    .map((t) => ({ name: t.name, title: t.title ?? t.name }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** Fields of a document type that a CSV column can reasonably feed. */
export function listImportableFields(
  schema: Schema,
  typeName: string,
): SchemaFieldInfo[] {
  const schemaType = schema.get(typeName) as
    | { fields?: CompiledField[] }
    | undefined
  if (!schemaType?.fields) return []

  const result: SchemaFieldInfo[] = []
  for (const field of schemaType.fields) {
    const typeName = field.type?.name
    if (!typeName) continue

    if (DIRECT_TYPES.has(typeName as ImportableFieldType)) {
      result.push({
        name: field.name,
        title: field.type?.title ?? field.name,
        fieldType: typeName as ImportableFieldType,
      })
      continue
    }

    // array of plain strings (e.g. tags) is importable via the split transform
    if (
      typeName === 'array' &&
      field.type?.of?.every((member) => member.name === 'string')
    ) {
      result.push({
        name: field.name,
        title: field.type?.title ?? field.name,
        fieldType: 'array',
      })
    }
  }
  return result
}
