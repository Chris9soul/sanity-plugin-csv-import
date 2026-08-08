import type { GeneratedSchema, NewField } from './types'

/**
 * Generates a document schema file matching this template's conventions
 * (see src/lib/sanity/schemaTypes/documents/postType.ts): defineType +
 * defineField, tabs, single quotes, no semicolons.
 */

/** "Product Name" / "product_name" → "productName". Falls back to "field". */
export function toFieldName(raw: string): string {
	const words = raw
		.trim()
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.split(' ')
		.filter(Boolean)
	if (words.length === 0) return 'field'
	const camel = words
		.map((w, i) => {
			const lower = w.toLowerCase()
			return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
		})
		.join('')
	// Field names cannot start with a digit
	return /^[0-9]/.test(camel) ? `field${camel.charAt(0).toUpperCase()}${camel.slice(1)}` : camel
}

/** "productName" / "product_name" → "Product Name" */
export function toTitle(raw: string): string {
	const spaced = raw
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.trim()
	if (!spaced) return 'Field'
	return spaced
		.split(' ')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ')
}

/** "My Products!" → "myProducts" (valid Sanity type name). */
export function toTypeName(raw: string): string {
	const name = toFieldName(raw).toLowerCase()
	return /^[a-z]/.test(name) ? name : `type${name}`
}

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

function fieldCode(field: NewField, slugSource: string | null): string {
	const props: string[] = [`name: '${escape(field.name)}'`, `title: '${escape(field.title)}'`]

	if (field.type === 'array') {
		props.push(`type: 'array'`, `of: [{ type: 'string' }]`)
	} else if (field.type === 'slug') {
		props.push(`type: 'slug'`)
		const source = slugSource && slugSource !== field.name ? slugSource : null
		if (source) props.push(`options: { source: '${escape(source)}', maxLength: 96 }`)
	} else {
		props.push(`type: '${field.type}'`)
	}

	if (field.required) props.push(`validation: (Rule) => Rule.required()`)

	const body = props.map((prop) => `\t\t\t${prop}`).join(',\n')
	return `\t\tdefineField({\n${body}\n\t\t})`
}

export function generateSchemaFile(typeTitle: string, fields: NewField[]): GeneratedSchema {
	const typeName = toTypeName(typeTitle)
	const exportName = `${typeName}Type`
	const fileName = `${exportName}.ts`
	const included = fields.filter((f) => f.include)

	const firstTextField =
		included.find((f) => f.type === 'string') ?? included.find((f) => f.type === 'text')
	const slugSource = firstTextField ? firstTextField.name : null

	const fieldBlocks = included.map((f) => fieldCode(f, slugSource)).join(',\n')

	const preview = firstTextField
		? `\n\tpreview: {\n\t\tselect: { title: '${escape(firstTextField.name)}' }\n\t}`
		: ''

	const code = `import { defineField, defineType } from 'sanity'

export const ${exportName} = defineType({
\tname: '${typeName}',
\ttitle: '${escape(toTitle(typeTitle))}',
\ttype: 'document',
\tfields: [
${fieldBlocks}
\t],${preview}
})
`

	return {
		typeName,
		exportName,
		fileName,
		importPath: `./schemaTypes/documents/${exportName}`,
		code
	}
}
