import { applyTransform, coerceForFieldType, TRUTHY } from './transforms'
import type { FieldMapping, PublishStatus } from './types'

/**
 * Builds a Sanity document from one CSV row using the field mapping.
 * Shared by the import endpoint (server) and the studio tool (preview) so
 * what the user previews is exactly what gets written.
 *
 * Publish status: when `statusColumn` is set, the cell's truthiness decides
 * per row; `statusTruthyMeans` picks whether truthy ("published", "true",
 * "1", "yes"…) means published (default) or draft (inverted, e.g. Webflow's
 * "Draft"/"Archived" columns). Otherwise `defaultStatus` decides. Drafts get
 * an explicit `drafts.` id; published documents let Sanity generate the id.
 */
export function buildDocument(options: {
	type: string
	mapping: FieldMapping[]
	row: Record<string, string>
	statusColumn: string | null
	statusTruthyMeans?: 'published' | 'draft'
	defaultStatus: PublishStatus
}): { doc: Record<string, unknown>; isPublished: boolean } {
	const {
		type,
		mapping,
		row,
		statusColumn,
		statusTruthyMeans = 'published',
		defaultStatus
	} = options

	const doc: Record<string, unknown> = { _type: type }
	for (const { column, field, fieldType, transform } of mapping) {
		if (!field) continue
		const raw = row[column]
		if (raw === undefined || raw === '') continue
		const transformed = applyTransform(transform, raw)
		const value = coerceForFieldType(fieldType, transformed)
		if (value !== undefined) doc[field] = value
	}

	const isPublished = statusColumn
		? TRUTHY.test(row[statusColumn] ?? '') === (statusTruthyMeans === 'published')
		: defaultStatus !== 'draft'

	if (!isPublished) doc._id = `drafts.${crypto.randomUUID()}`
	return { doc, isPublished }
}
