import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Flex,
  Label,
  Select,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui'
import { PlayIcon, SearchIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useClient } from 'sanity'
import { buildDocument } from '../buildDocument'
import type {
  CsvData,
  FieldMapping,
  ImportResult,
  PublishStatus,
} from '../types'

type StatusChoice = 'published' | 'draft' | `column:${string}`

const CHUNK_SIZE = 50

/**
 * Final step: preview the documents that will be created (transforms
 * applied), choose how publish status is decided, then dry-run or import.
 * Imports run directly through the Studio's authenticated Sanity client.
 * No server endpoint needed.
 */
export function ImportStep(props: {
  csv: CsvData
  typeName: string
  mapping: FieldMapping[]
  onBack: () => void
  onReset: () => void
}) {
  const toast = useToast()
  const sanityClient = useClient({ apiVersion: '2025-01-01' })
  const [statusChoice, setStatusChoice] = useState<StatusChoice>('published')
  const [truthyMeans, setTruthyMeans] = useState<'published' | 'draft'>(
    'published',
  )
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const activeMapping = useMemo(
    () => props.mapping.filter((m) => m.field),
    [props.mapping],
  )
  const mappedFields = activeMapping.map((m) => m.field)

  const statusColumn = statusChoice.startsWith('column:')
    ? statusChoice.slice('column:'.length)
    : null
  const defaultStatus: PublishStatus =
    statusChoice === 'draft' ? 'draft' : 'published'

  const preview = useMemo(
    () =>
      props.csv.rows.slice(0, 5).map((row) =>
        buildDocument({
          type: props.typeName,
          mapping: activeMapping,
          row,
          statusColumn,
          statusTruthyMeans: truthyMeans,
          defaultStatus,
        }),
      ),
    [
      props.csv.rows,
      props.typeName,
      activeMapping,
      statusColumn,
      truthyMeans,
      defaultStatus,
    ],
  )

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setResult(null)

    const built = props.csv.rows.map((row) =>
      buildDocument({
        type: props.typeName,
        mapping: activeMapping,
        row,
        statusColumn,
        statusTruthyMeans: truthyMeans,
        defaultStatus,
      }),
    )

    if (dryRun) {
      setResult({
        total: props.csv.rows.length,
        created: 0,
        published: built.filter((b) => b.isPublished).length,
        drafts: built.filter((b) => !b.isPublished).length,
        errors: [],
        dryRun: true,
        sample: built.slice(0, 5).map((b) => b.doc),
      })
      setBusy(false)
      toast.push({
        status: 'info',
        title: 'Dry run complete. Nothing was written',
      })
      return
    }

    let created = 0
    let published = 0
    let drafts = 0
    const errors: string[] = []

    for (let start = 0; start < built.length; start += CHUNK_SIZE) {
      const chunk = built.slice(start, start + CHUNK_SIZE)
      const tx = sanityClient.transaction()
      for (const { doc } of chunk) tx.create(doc as never)
      try {
        await tx.commit()
        created += chunk.length
        published += chunk.filter((b) => b.isPublished).length
        drafts += chunk.filter((b) => !b.isPublished).length
      } catch (error) {
        errors.push(
          `Rows ${start + 1}–${start + chunk.length}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    setResult({
      total: props.csv.rows.length,
      created,
      published,
      drafts,
      errors,
    })
    setBusy(false)

    if (created > 0 && errors.length === 0) {
      toast.push({
        status: 'success',
        title: `Imported ${created} document${created === 1 ? '' : 's'}`,
        description: `${published} published, ${drafts} drafts`,
      })
    } else if (errors.length > 0 && created === 0) {
      toast.push({
        status: 'error',
        title: 'Import failed',
        description: errors[0],
      })
    }
  }

  return (
    <Stack gap={4}>
      <Flex align="center" gap={2} wrap="wrap">
        <Text size={1} muted>
          Importing {props.csv.rows.length} rows into
        </Text>
        <Badge tone="primary">{props.typeName}</Badge>
        <Text size={1} muted>
          with {activeMapping.length} mapped field
          {activeMapping.length === 1 ? '' : 's'}
        </Text>
      </Flex>

      <Card border radius={2} style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <Th>Status</Th>
              {mappedFields.map((field) => (
                <Th key={field}>{field}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map(({ doc, isPublished }, index) => (
              <tr
                key={index}
                style={{ borderTop: '1px solid var(--card-border-color)' }}
              >
                <Td>
                  <Badge tone={isPublished ? 'positive' : 'caution'}>
                    {isPublished ? 'published' : 'draft'}
                  </Badge>
                </Td>
                {mappedFields.map((field) => (
                  <Td key={field}>
                    <Text size={1} muted={doc[field] === undefined}>
                      {doc[field] === undefined
                        ? '–'
                        : truncate(formatValue(doc[field]))}
                    </Text>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Text size={1} muted>
        Preview of the first {preview.length} rows, exactly as they will be
        written.
      </Text>

      <Card padding={3} radius={2} border>
        <Stack gap={3}>
          <Flex align="center" gap={3} wrap="wrap">
            <Label size={1}>Publish status</Label>
            <Box style={{ flex: 1, maxWidth: 320, minWidth: 200 }}>
              <Select
                fontSize={2}
                value={statusChoice}
                onChange={(e) =>
                  setStatusChoice(e.currentTarget.value as StatusChoice)
                }
              >
                <option value="published">Publish all documents</option>
                <option value="draft">Create all as drafts</option>
                <optgroup label="Decide per row from a column">
                  {props.csv.columns.map((column) => (
                    <option key={column} value={`column:${column}`}>
                      Column: {column}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Box>
          </Flex>
          {statusColumn && (
            <Flex align="center" gap={3} wrap="wrap">
              <Label size={1}>When “{statusColumn}” is truthy</Label>
              <Box style={{ flex: 1, maxWidth: 320, minWidth: 200 }}>
                <Select
                  fontSize={2}
                  value={truthyMeans}
                  onChange={(e) =>
                    setTruthyMeans(
                      e.currentTarget.value as 'published' | 'draft',
                    )
                  }
                >
                  <option value="published">Mark the row as published</option>
                  <option value="draft">Mark the row as draft</option>
                </Select>
              </Box>
              <Box style={{ flex: 2, minWidth: 220 }}>
                <Text size={1} muted>
                  {truthyMeans === 'published'
                    ? 'Cells like “published”, “true”, “1”, “yes” publish the row; anything else becomes a draft.'
                    : 'Cells like “true”, “1”, “yes” make the row a draft; anything else is published. Fits Webflow’s “Draft” and “Archived” columns.'}
                </Text>
              </Box>
            </Flex>
          )}
        </Stack>
      </Card>

      {result && (
        <Card
          padding={3}
          radius={2}
          tone={result.errors.length ? 'caution' : 'positive'}
        >
          <Stack gap={3}>
            <Text size={1} weight="medium">
              {result.dryRun
                ? `Dry run OK: ${result.published} would be published, ${result.drafts} would be drafts.`
                : `Created ${result.created} of ${result.total} documents (${result.published} published, ${result.drafts} drafts).`}
            </Text>
            {result.errors.length > 0 && (
              <Stack gap={2}>
                {result.errors.map((error, i) => (
                  <Text key={i} size={1}>
                    {error}
                  </Text>
                ))}
              </Stack>
            )}
            {result.sample && (
              <Box style={{ maxHeight: 240, overflow: 'auto' }}>
                <Code language="json">
                  {JSON.stringify(result.sample, null, 2)}
                </Code>
              </Box>
            )}
          </Stack>
        </Card>
      )}

      <Flex gap={2} justify="space-between" wrap="wrap">
        <Flex gap={2}>
          <Button
            text="Back"
            mode="ghost"
            disabled={busy}
            onClick={props.onBack}
          />
          <Button
            text="Start over"
            mode="ghost"
            tone="critical"
            disabled={busy}
            onClick={props.onReset}
          />
        </Flex>
        <Flex gap={2} align="center">
          {busy && <Spinner />}
          <Button
            text="Dry run"
            icon={SearchIcon}
            mode="ghost"
            disabled={busy}
            onClick={() => run(true)}
          />
          <Button
            text={`Import ${props.csv.rows.length} documents`}
            icon={PlayIcon}
            tone="primary"
            disabled={busy}
            onClick={() => run(false)}
          />
        </Flex>
      </Flex>
    </Stack>
  )
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function truncate(value: string, max = 60): string {
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
  return (
    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
      {props.children}
    </td>
  )
}
