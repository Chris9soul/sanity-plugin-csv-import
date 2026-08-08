import { useCallback, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Box, Card, Flex, Stack, Text } from '@sanity/ui'
import { UploadIcon } from '@sanity/icons'
import { parseCsv } from '../csv'
import type { CsvData } from '../types'

/**
 * Step 1: pick a CSV file. Parses immediately and hands columns + rows to
 * the parent wizard.
 */
export function UploadStep(props: { onParsed: (data: CsvData, fileName: string) => void }) {
	const [error, setError] = useState<string | null>(null)
	const [dragging, setDragging] = useState(false)

	const handleFile = useCallback(
		async (file: File | undefined) => {
			if (!file) return
			setError(null)
			try {
				const text = await file.text()
				const data = parseCsv(text)
				if (data.columns.length === 0) {
					setError('Could not find a header row in that file.')
					return
				}
				if (data.rows.length === 0) {
					setError('That file has a header row but no data rows to import.')
					return
				}
				props.onParsed(data, file.name)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to read the file')
			}
		},
		[props]
	)

	const onDrop = useCallback(
		(event: DragEvent) => {
			event.preventDefault()
			setDragging(false)
			handleFile(event.dataTransfer.files?.[0])
		},
		[handleFile]
	)

	const onPick = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0] ?? undefined),
		[handleFile]
	)

	return (
		<Stack gap={4}>
			<Card
				padding={5}
				radius={2}
				border
				tone={dragging ? 'primary' : 'default'}
				style={{ cursor: 'pointer', textAlign: 'center' }}
				onDragOver={(e) => {
					e.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				onClick={() => document.getElementById('csv-file-input')?.click()}
			>
				<Stack gap={4}>
					<Box style={{ margin: '0 auto' }}>
						<Text size={4}>
							<UploadIcon />
						</Text>
					</Box>
					<Text size={2} weight="medium">
						Drop a CSV file here, or click to browse
					</Text>
					<Text size={1} muted>
						The first row must contain column headers. You'll map them to fields in the next steps.
					</Text>
				</Stack>
			</Card>

			<input
				id="csv-file-input"
				type="file"
				accept=".csv,text/csv,text/plain"
				style={{ display: 'none' }}
				onChange={onPick}
			/>

			{error && (
				<Card padding={3} radius={2} tone="critical">
					<Flex align="center">
						<Text size={1}>{error}</Text>
					</Flex>
				</Card>
			)}
		</Stack>
	)
}
