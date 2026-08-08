import type { ImportableFieldType, TransformId } from './types'

/**
 * Cell transforms. Pure functions shared by the studio tool (preview) and the
 * import endpoint (server) so previewed values match imported values exactly.
 *
 * A transform returns `null` when the value cannot be converted. The field is
 * then skipped on that document instead of writing garbage.
 */

export const TRANSFORMS: { id: TransformId; label: string }[] = [
	{ id: 'none', label: 'None' },
	{ id: 'trim', label: 'Trim whitespace' },
	{ id: 'lowercase', label: 'lowercase' },
	{ id: 'uppercase', label: 'UPPERCASE' },
	{ id: 'slugify', label: 'Slugify' },
	{ id: 'number', label: 'To number' },
	{ id: 'boolean', label: 'To boolean' },
	{ id: 'date', label: 'Parse date → datetime' },
	{ id: 'split', label: 'Split (comma) → array' }
]

export const TRUTHY = /^(true|1|yes|y|published|live)$/i

export function slugify(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '') // strip combining diacritical marks
		.toLowerCase()
		.trim()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function applyTransform(id: TransformId, raw: string): unknown {
	const value = raw.trim()
	switch (id) {
		case 'none':
			return value
		case 'trim':
			return value.trim()
		case 'lowercase':
			return value.toLowerCase()
		case 'uppercase':
			return value.toUpperCase()
		case 'slugify':
			return slugify(value) || null
		case 'number': {
			const n = Number(value.replace(/,/g, ''))
			return value !== '' && Number.isFinite(n) ? n : null
		}
		case 'boolean':
			return TRUTHY.test(value)
		case 'date': {
			if (!value) return null
			const d = new Date(value)
			return Number.isNaN(d.getTime()) ? null : d.toISOString()
		}
		case 'split':
			return value
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean)
	}
}

/**
 * Coerces a transformed value to the shape a Sanity field expects.
 * Returns `undefined` when the field should be omitted from the document.
 */
export function coerceForFieldType(fieldType: ImportableFieldType, value: unknown): unknown {
	if (value === null || value === undefined || value === '') return undefined

	switch (fieldType) {
		case 'slug': {
			const current = slugify(String(value))
			return current ? { _type: 'slug', current } : undefined
		}
		case 'number': {
			const n = Number(value)
			return Number.isFinite(n) ? n : undefined
		}
		case 'boolean':
			return typeof value === 'boolean' ? value : TRUTHY.test(String(value))
		case 'datetime':
		case 'date': {
			if (value instanceof Date) return value.toISOString()
			const d = new Date(String(value))
			return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
		}
		case 'array':
			if (Array.isArray(value)) {
				const items = value.map((v) => String(v).trim()).filter(Boolean)
				return items.length ? items : undefined
			}
			return [String(value)]
		case 'string':
		case 'text':
		case 'url':
		case 'email':
			return Array.isArray(value) ? value.join(', ') : String(value)
		default:
			return undefined
	}
}

/** Sensible default transform for a target field type. */
export function defaultTransformFor(fieldType: ImportableFieldType): TransformId {
	switch (fieldType) {
		case 'number':
			return 'number'
		case 'boolean':
			return 'boolean'
		case 'slug':
			return 'slugify'
		case 'datetime':
		case 'date':
			return 'date'
		case 'array':
			return 'split'
		default:
			return 'trim'
	}
}
