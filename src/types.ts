/**
 * Shared types for the CSV Import studio tool, its server endpoints and the
 * pure helper modules (csv.ts, transforms.ts, schemaCodegen.ts).
 */

/** Parsed CSV: header row becomes `columns`, body rows keyed by column name. */
export type CsvData = {
	columns: string[]
	rows: Record<string, string>[]
}

/** Field types the tool can import into (existing schemas) or generate (new schemas). */
export type ImportableFieldType =
	| 'string'
	| 'text'
	| 'number'
	| 'boolean'
	| 'slug'
	| 'datetime'
	| 'date'
	| 'url'
	| 'email'
	| 'array'

/** One CSV column mapped to one document field, with an optional transform. */
export type FieldMapping = {
	column: string
	/** Target field name. Empty string = column is skipped. */
	field: string
	fieldType: ImportableFieldType
	transform: TransformId
}

export type TransformId =
	| 'none'
	| 'trim'
	| 'lowercase'
	| 'uppercase'
	| 'slugify'
	| 'number'
	| 'boolean'
	| 'date'
	| 'split'

/** Field definition for a column in the "new schema" flow. */
export type NewField = {
	column: string
	include: boolean
	/** Sanity field name (camelCase, sanitized from the column header). */
	name: string
	/** Human-readable field title. */
	title: string
	type: ImportableFieldType
	required: boolean
}

/** Generated schema source and metadata passed to a host project writer. */
export type GeneratedSchema = {
	/** e.g. "product" */
	typeName: string
	/** e.g. "productType" (export const name). */
	exportName: string
	/** e.g. "productType.ts" */
	fileName: string
	/** Import path used inside schema.ts */
	importPath: string
	code: string
}

/** Result returned after a host project writes the generated schema. */
export type SchemaFileWriteResult = {
	filePath?: string
	message?: string
}

/**
 * Host-provided adapter for writing a generated schema into a project.
 *
 * The adapter runs in the browser, so the host normally implements `write`
 * with a request to its own development endpoint.
 */
export type SchemaFileWriter = {
	isAvailable?: () => Promise<boolean>
	write: (schema: GeneratedSchema) => Promise<SchemaFileWriteResult | void>
}

export type CsvImportPluginOptions = {
	schemaFileWriter?: SchemaFileWriter
}

export type PublishStatus = 'published' | 'draft'

/** POST body for /api/import/run */
export type ImportRequestBody = {
	type: string
	rows: Record<string, string>[]
	mapping: FieldMapping[]
	/** CSV column whose value decides per-row status ("published", "true", "1", "yes" → published). */
	statusColumn: string | null
	/**
	 * What a truthy status-column cell means. 'draft' inverts the logic, which
	 * fits exports like Webflow's where boolean "Draft"/"Archived" columns
	 * mean draft when true. Defaults to 'published'.
	 */
	statusTruthyMeans?: 'published' | 'draft'
	defaultStatus: PublishStatus
	dryRun?: boolean
}

export type ImportResult = {
	total: number
	created: number
	published: number
	drafts: number
	errors: string[]
	dryRun?: boolean
	sample?: Record<string, unknown>[]
}
