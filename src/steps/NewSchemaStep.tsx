import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Flex,
  Label,
  Select,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui'
import { ClipboardIcon, DownloadIcon, PublishIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { generateSchemaFile, toFieldName, toTitle } from '../schemaCodegen'
import type {
  CsvData,
  ImportableFieldType,
  NewField,
  SchemaFileWriter,
} from '../types'

const FIELD_TYPES: { value: ImportableFieldType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'slug', label: 'Slug' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'array', label: 'Array of strings' },
]

/**
 * Step 3 (new schema): turn each CSV column into a field definition, tweak
 * names/types/options, then copy, download, or write the generated schema
 * file through an optional host-provided writer.
 */
export function NewSchemaStep(props: {
  csv: CsvData
  typeTitle: string
  fields: NewField[] | null
  writtenPath: string | null
  schemaFileWriter?: SchemaFileWriter
  onWritten: (path: string) => void
  onBack: () => void
  onFieldsChange: (fields: NewField[]) => void
  onNext: () => void
}) {
  const toast = useToast()
  const [fields, setFields] = useState<NewField[]>(
    () =>
      props.fields ??
      props.csv.columns.map((column) => ({
        column,
        include: true,
        name: uniqueName(toFieldName(column), []),
        title: toTitle(column),
        type: guessType(props.csv, column),
        required: false,
      })),
  )

  useEffect(() => {
    props.onFieldsChange(fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  const generated = useMemo(
    () => generateSchemaFile(props.typeTitle, fields),
    [props.typeTitle, fields],
  )

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of fields.filter((f) => f.include)) {
      counts.set(f.name, (counts.get(f.name) ?? 0) + 1)
    }
    return new Set(
      [...counts].filter(([, count]) => count > 1).map(([name]) => name),
    )
  }, [fields])

  const includedCount = fields.filter((f) => f.include).length
  const valid = includedCount > 0 && duplicateNames.size === 0

  const [busy, setBusy] = useState<string | null>(null)
  const [writerEnabled, setWriterEnabled] = useState(false)

  useEffect(() => {
    const writer = props.schemaFileWriter
    if (!writer) {
      setWriterEnabled(false)
      return
    }

    let cancelled = false
    Promise.resolve()
      .then(() => (writer.isAvailable ? writer.isAvailable() : true))
      .then((available) => {
        if (!cancelled) setWriterEnabled(available)
      })
      .catch(() => {
        if (!cancelled) setWriterEnabled(false)
      })

    return () => {
      cancelled = true
    }
  }, [props.schemaFileWriter])

  const written = props.writtenPath

  const update = (column: string, patch: Partial<NewField>) =>
    setFields((prev) =>
      prev.map((f) => (f.column === column ? { ...f, ...patch } : f)),
    )

  const copy = async () => {
    setBusy('copy')
    try {
      await navigator.clipboard.writeText(generated.code)
      toast.push({
        status: 'success',
        title: 'Schema code copied to clipboard',
      })
    } catch {
      toast.push({
        status: 'error',
        title: 'Copy failed. Select the code manually',
      })
    } finally {
      setBusy(null)
    }
  }

  const download = () => {
    const blob = new Blob([generated.code], { type: 'text/typescript' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = generated.fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const writeToProject = async () => {
    const writer = props.schemaFileWriter
    if (!writer) return

    setBusy('write')
    try {
      const result = await writer.write(generated)
      const filePath = result?.filePath ?? generated.fileName
      props.onWritten(filePath)
      toast.push({
        status: 'success',
        title: 'Schema written',
        description: result?.message ?? `Written to ${filePath}`,
      })
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Could not write schema',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Stack gap={4}>
      <Flex align="center" gap={2}>
        <Text size={1} muted>
          New document type
        </Text>
        <Badge tone="primary">{generated.typeName}</Badge>
        <Text size={1} muted>
          · {includedCount} of {fields.length} columns included
        </Text>
      </Flex>

      <Card border radius={2} style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <Th>Use</Th>
              <Th>CSV column</Th>
              <Th>Field name</Th>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Required</Th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr
                key={f.column}
                style={{ borderTop: '1px solid var(--card-border-color)' }}
              >
                <Td>
                  <Checkbox
                    checked={f.include}
                    onChange={(e) =>
                      update(f.column, { include: e.currentTarget.checked })
                    }
                  />
                </Td>
                <Td>
                  <Text size={1} muted>
                    {f.column}
                  </Text>
                </Td>
                <Td>
                  <TextInput
                    fontSize={1}
                    value={f.name}
                    disabled={!f.include}
                    customValidity={
                      f.include && duplicateNames.has(f.name) ? 'Duplicate' : ''
                    }
                    onChange={(e) => {
                      const raw = e.currentTarget.value
                      update(f.column, { name: raw ? toFieldName(raw) : '' })
                    }}
                  />
                </Td>
                <Td>
                  <TextInput
                    fontSize={1}
                    value={f.title}
                    disabled={!f.include}
                    onChange={(e) =>
                      update(f.column, { title: e.currentTarget.value })
                    }
                  />
                </Td>
                <Td>
                  <Select
                    fontSize={1}
                    value={f.type}
                    disabled={!f.include}
                    onChange={(e) =>
                      update(f.column, {
                        type: e.currentTarget.value as ImportableFieldType,
                      })
                    }
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Checkbox
                    checked={f.required}
                    disabled={!f.include}
                    onChange={(e) =>
                      update(f.column, { required: e.currentTarget.checked })
                    }
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {duplicateNames.size > 0 && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>
            Field names must be unique: {[...duplicateNames].join(', ')}
          </Text>
        </Card>
      )}

      <Card padding={3} radius={2} border>
        <Stack gap={3}>
          <Flex align="center" justify="space-between" gap={2} wrap="wrap">
            <Label size={1}>Generated schema: {generated.fileName}</Label>
            <Flex gap={2} wrap="wrap">
              <Button
                text="Copy"
                icon={ClipboardIcon}
                mode="ghost"
                fontSize={1}
                padding={2}
                disabled={!valid || busy !== null}
                onClick={copy}
              />
              <Button
                text={`Download ${generated.fileName}`}
                icon={DownloadIcon}
                mode="ghost"
                fontSize={1}
                padding={2}
                disabled={!valid}
                onClick={download}
              />
              {writerEnabled && (
                <Button
                  text="Write to project"
                  icon={PublishIcon}
                  tone="primary"
                  fontSize={1}
                  padding={2}
                  disabled={!valid || busy !== null}
                  onClick={writeToProject}
                />
              )}
            </Flex>
          </Flex>
          {written ? (
            <Card padding={2} radius={1} tone="positive">
              <Text size={1}>
                Written to {written}. Your Studio should reload with the new
                type. You can continue to import right away.
              </Text>
            </Card>
          ) : writerEnabled ? (
            <Text size={1} muted>
              Write the generated file through your Studio host, then import
              the data using the new type.
            </Text>
          ) : (
            <Text size={1} muted>
              Add {generated.fileName} to your Studio&apos;s schema types, then
              register it in your schema registry. After that, import the data
              using the generated type.
            </Text>
          )}
          <Box style={{ maxHeight: 320, overflow: 'auto' }}>
            <Code language="typescript">{generated.code}</Code>
          </Box>
        </Stack>
      </Card>

      <Flex gap={2} justify="flex-end">
        <Button text="Back" mode="ghost" onClick={props.onBack} />
        <Button
          text="Continue to import"
          tone="primary"
          disabled={!valid}
          onClick={props.onNext}
        />
      </Flex>
    </Stack>
  )
}

function guessType(csv: CsvData, column: string): ImportableFieldType {
  const samples = csv.rows
    .map((row) => row[column]?.trim())
    .filter(Boolean)
    .slice(0, 20)
  if (samples.length === 0) return 'string'

  if (samples.every((v) => /^(true|false|yes|no|0|1)$/i.test(v)))
    return 'boolean'
  if (samples.every((v) => !Number.isNaN(Number(v.replace(/,/g, '')))))
    return 'number'
  if (samples.every((v) => !Number.isNaN(Date.parse(v)) && /[-/:]/.test(v)))
    return 'datetime'
  if (samples.every((v) => /^https?:\/\/\S+$/.test(v))) return 'url'
  if (samples.every((v) => /^\S+@\S+\.\S+$/.test(v))) return 'email'
  if (samples.some((v) => v.includes(','))) return 'array'
  if (samples.some((v) => v.length > 120)) return 'text'
  return 'string'
}

function uniqueName(base: string, taken: string[]): string {
  let name = base
  let i = 2
  while (taken.includes(name)) name = `${base}${i++}`
  return name
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
