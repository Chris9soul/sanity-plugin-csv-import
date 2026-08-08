import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Label,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui'
import { useSchema } from 'sanity'
import { listDocumentTypes } from '../schemaIntrospection'
import { toTypeName } from '../schemaCodegen'
import type { CsvData } from '../types'

export type Target =
  | { kind: 'existing'; typeName: string }
  | { kind: 'new'; typeTitle: string }

/**
 * Step 2: choose where the CSV goes: an existing document type, or a brand
 * new schema generated from the CSV columns.
 */
export function TargetStep(props: {
  csv: CsvData
  onBack: () => void
  onNext: (target: Target) => void
}) {
  const schema = useSchema()
  const documentTypes = useMemo(() => listDocumentTypes(schema), [schema])

  const [kind, setKind] = useState<'existing' | 'new'>('existing')
  const [typeName, setTypeName] = useState(documentTypes[0]?.name ?? '')
  const [typeTitle, setTypeTitle] = useState('')

  const newTypeName = useMemo(
    () => (typeTitle ? toTypeName(typeTitle) : ''),
    [typeTitle],
  )
  const nameClash = useMemo(
    () => documentTypes.some((t) => t.name === newTypeName),
    [documentTypes, newTypeName],
  )

  const canContinue =
    kind === 'existing'
      ? !!typeName
      : !!typeTitle && !!newTypeName && !nameClash

  return (
    <Stack gap={4}>
      <Text size={1} muted>
        {props.csv.rows.length} rows × {props.csv.columns.length} columns
      </Text>

      <Card
        padding={3}
        radius={2}
        border
        style={{ cursor: 'pointer' }}
        tone={kind === 'existing' ? 'primary' : 'default'}
        onClick={() => setKind('existing')}
      >
        <Flex align="center" gap={3}>
          <Radio checked={kind === 'existing'} readOnly />
          <Stack gap={2} flex={1}>
            <Label size={1}>Import into an existing document type</Label>
            <Text size={1} muted>
              Map each CSV column to a field on a type that already exists in
              your schema.
            </Text>
          </Stack>
        </Flex>
        {kind === 'existing' && (
          <Box marginTop={3} onClick={(e) => e.stopPropagation()}>
            <Select
              fontSize={2}
              value={typeName}
              onChange={(e) => setTypeName(e.currentTarget.value)}
            >
              {documentTypes.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.title} ({t.name})
                </option>
              ))}
            </Select>
          </Box>
        )}
      </Card>

      <Card
        padding={3}
        radius={2}
        border
        style={{ cursor: 'pointer' }}
        tone={kind === 'new' ? 'primary' : 'default'}
        onClick={() => setKind('new')}
      >
        <Flex align="center" gap={3}>
          <Radio checked={kind === 'new'} readOnly />
          <Stack gap={2} flex={1}>
            <Label size={1}>Create a new schema from these columns</Label>
            <Text size={1} muted>
              Generate a document type where each CSV column becomes a field.
              Copy the code, download it, or write it straight into your project
              (dev mode).
            </Text>
          </Stack>
        </Flex>
        {kind === 'new' && (
          <Box marginTop={3} onClick={(e) => e.stopPropagation()}>
            <Stack gap={2}>
              <Label size={1} muted>
                Schema name
              </Label>
              <TextInput
                fontSize={2}
                placeholder="e.g. Product"
                value={typeTitle}
                onChange={(e) => setTypeTitle(e.currentTarget.value)}
              />
              {typeTitle && (
                <Flex align="center" gap={2}>
                  <Text size={1} muted>
                    Type name: <code>{newTypeName}</code>
                  </Text>
                  {nameClash && (
                    <Badge tone="critical" fontSize={0}>
                      already exists
                    </Badge>
                  )}
                </Flex>
              )}
            </Stack>
          </Box>
        )}
      </Card>

      <Flex gap={2} justify="flex-end">
        <Button text="Back" mode="ghost" onClick={props.onBack} />
        <Button
          text="Continue"
          tone="primary"
          disabled={!canContinue}
          onClick={() =>
            props.onNext(
              kind === 'existing' ? { kind, typeName } : { kind, typeTitle },
            )
          }
        />
      </Flex>
    </Stack>
  )
}
