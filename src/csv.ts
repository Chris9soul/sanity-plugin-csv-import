import type { CsvData } from './types'

/**
 * Minimal but correct CSV parser: handles quoted fields, escaped quotes (""),
 * commas/newlines inside quotes, CRLF line endings and auto-detects the
 * delimiter (comma, semicolon or tab) from the first line.
 */

function detectDelimiter(text: string): string {
	const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length)
	const candidates = [',', ';', '\t']
	let best = ','
	let bestCount = -1
	for (const candidate of candidates) {
		const count = firstLine.split(candidate).length
		if (count > bestCount) {
			bestCount = count
			best = candidate
		}
	}
	return best
}

/** Splits raw CSV text into a grid of string cells. */
export function parseGrid(text: string, delimiter = detectDelimiter(text)): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let cell = ''
	let inQuotes = false
	let i = 0

	while (i < text.length) {
		const char = text[i]

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					cell += '"'
					i += 2
					continue
				}
				inQuotes = false
				i++
				continue
			}
			cell += char
			i++
			continue
		}

		if (char === '"' && cell === '') {
			inQuotes = true
			i++
			continue
		}
		if (char === delimiter) {
			row.push(cell)
			cell = ''
			i++
			continue
		}
		if (char === '\r') {
			i++
			continue
		}
		if (char === '\n') {
			row.push(cell)
			rows.push(row)
			row = []
			cell = ''
			i++
			continue
		}
		cell += char
		i++
	}

	// Flush the final cell/row (file may not end with a newline)
	if (cell !== '' || row.length > 0) {
		row.push(cell)
		rows.push(row)
	}

	return rows
}

/**
 * Parses CSV text into columns + row objects. The first non-empty row is the
 * header. Duplicate header names get a numeric suffix. Fully empty rows are
 * skipped. Extra cells are ignored, missing cells become empty strings.
 */
export function parseCsv(text: string): CsvData {
	const grid = parseGrid(text).filter((cells) => cells.some((c) => c.trim() !== ''))
	if (grid.length === 0) return { columns: [], rows: [] }

	const seen = new Map<string, number>()
	const columns = grid[0].map((raw, index) => {
		const base = raw.trim() || `column_${index + 1}`
		const count = seen.get(base) ?? 0
		seen.set(base, count + 1)
		return count === 0 ? base : `${base}_${count + 1}`
	})

	const rows = grid.slice(1).map((cells) => {
		const record: Record<string, string> = {}
		columns.forEach((column, index) => {
			record[column] = cells[index] ?? ''
		})
		return record
	})

	return { columns, rows }
}
