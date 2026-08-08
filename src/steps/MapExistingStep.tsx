import { useMemo, useState } from 'react'
import { Button, Card, Flex, Select, Stack, Text } from '@sanity/ui'
import { useSchema } from 'sanity'
import { listImportableFields } from '../schemaIntrospection'
import type { SchemaFieldInfo } from '../schemaIntrospection'
import { defaultTransformFor } from '../transforms'
import { toFieldName } from '../schemaCodegen'
import type { CsvData, FieldMapping, TransformId } from '../types'

/**
 * Step 3 (existing type): map CSV columns to fields of the chosen document
 * type, with an optional transform per field. Column names that match a
 * field name are pre-selected.
 */
export function MapExistingStep(props: {
	csv: CsvData
	typeName: string
	initialMapping: FieldMapping[] | null
	onBack: () => void
	onNext: (mapping: FieldMapping[]) => void
}) {
	const schema = useSchema()
	const fields = useMemo(
		() => listImportableFields(schema, props.typeName),
		[schema, props.typeName]
	)

	const [mapping, setMapping] = useState<FieldMapping[]>(
		() =>
			props.initialMapping ??
			props.csv.columns.map((column) => {
				const guessed = guessField(column, fields)
				return {
					column,
					field: guessed?.name ?? '',
					fieldType: guessed?.fieldType ?? 'string',
					transform: guessed ? defaultTransformFor(guessed.fieldType) : 'none'
				}
			})
	)

	const update = (column: string, patch: Partial<FieldMapping>) =>
		setMapping((prev) => prev.map((m) => (m.column === column ? { ...m, ...patch } : m)))

	const mappedCount = mapping.filter((m) => m.field).length

	return (
		<Stack gap={4}>
			<Text size={1} muted>
				Map CSV columns to fields on <strong>{props.typeName}</strong>. Unmapped columns are
				skipped. {mappedCount} of {mapping.length} columns mapped.
			</Text>

			<Card border radius={2} style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
					<thead>
						<tr style={{ textAlign: 'left' }}>
							<Th>CSV column</Th>
							<Th>Sample</Th>
							<Th>Field</Th>
							<Th>Transform</Th>
						</tr>
					</thead>
					<tbody>
						{mapping.map((m) => (
							<tr key={m.column} style={{ borderTop: '1px solid var(--card-border-color)' }}>
								<Td>
									<Text size={1} weight="medium">
										{m.column}
									</Text>
								</Td>
								<Td>
									<Text size={1} muted>
										{truncate(sampleValue(props.csv, m.column))}
									</Text>
								</Td>
								<Td>
									<Select
										fontSize={1}
										value={m.field}
										onChange={(e) => {
											const field = fields.find((f) => f.name === e.currentTarget.value)
											update(m.column, {
												field: field?.name ?? '',
												fieldType: field?.fieldType ?? 'string',
												transform: field ? defaultTransformFor(field.fieldType) : 'none'
											})
										}}
									>
										<option value="">Skip</option>
										{fields.map((f) => (
											<option key={f.name} value={f.name}>
												{f.title} ({f.fieldType})
											</option>
										))}
									</Select>
								</Td>
								<Td>
									<TransformSelect
										value={m.transform}
										disabled={!m.field}
										onChange={(transform) => update(m.column, { transform })}
									/>
								</Td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>

			<Flex gap={2} justify="flex-end">
				<Button text="Back" mode="ghost" onClick={props.onBack} />
				<Button
					text="Continue"
					tone="primary"
					disabled={mappedCount === 0}
					onClick={() => props.onNext(mapping)}
				/>
			</Flex>
		</Stack>
	)
}

export function TransformSelect(props: {
	value: TransformId
	disabled?: boolean
	onChange: (value: TransformId) => void
}) {
	return (
		<Select
			fontSize={1}
			value={props.value}
			disabled={props.disabled}
			onChange={(e) => props.onChange(e.currentTarget.value as TransformId)}
		>
			<option value="none">None</option>
			<option value="trim">Trim whitespace</option>
			<option value="lowercase">lowercase</option>
			<option value="uppercase">UPPERCASE</option>
			<option value="slugify">Slugify</option>
			<option value="number">To number</option>
			<option value="boolean">To boolean</option>
			<option value="date">Parse date → datetime</option>
			<option value="split">Split (comma) → array</option>
		</Select>
	)
}

function guessField(column: string, fields: SchemaFieldInfo[]): SchemaFieldInfo | undefined {
	const normalized = toFieldName(column).toLowerCase()
	return fields.find(
		(f) =>
			f.name.toLowerCase() === normalized || f.title.toLowerCase() === column.trim().toLowerCase()
	)
}

function sampleValue(csv: CsvData, column: string): string {
	for (const row of csv.rows) {
		const value = row[column]
		if (value) return value
	}
	return ''
}

function truncate(value: string, max = 40): string {
	return value.length > max ? `${value.slice(0, max)}…` : value
}

function Th(props: { children: React.ReactNode }) {
	return (
		<th style={{ padding: '8px 10px' }}>
			<Text size={0} weight="semibold" muted>
				{props.children}
			</Text>
		</th>
	)
}

function Td(props: { children: React.ReactNode }) {
	return <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>{props.children}</td>
}
