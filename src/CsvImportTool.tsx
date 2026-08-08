import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Stack,
  Text,
} from '@sanity/ui'

import { UploadStep } from './steps/UploadStep'
import { TargetStep } from './steps/TargetStep'
import type { Target } from './steps/TargetStep'
import { MapExistingStep } from './steps/MapExistingStep'
import { NewSchemaStep } from './steps/NewSchemaStep'
import { ImportStep } from './steps/ImportStep'
import { defaultTransformFor } from './transforms'
import { toTypeName } from './schemaCodegen'
import type {
  CsvData,
  FieldMapping,
  NewField,
  SchemaFileWriter,
} from './types'

/**
 * CSV Import studio tool.
 *
 * Wizard: upload a CSV → choose an existing document type or generate a new
 * schema from the columns → map columns to fields (with transforms) →
 * preview and import via the Studio's authenticated Sanity client.
 */

type Step = 'upload' | 'target' | 'map' | 'newSchema' | 'import'

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'target', label: 'Target' },
  { id: 'map', label: 'Map fields' },
  { id: 'import', label: 'Import' },
]

/**
 * Wizard state is persisted to sessionStorage so it survives page reloads.
 * sessionStorage is per-tab and cleared when the tab closes.
 */
const STORAGE_KEY = 'csv-import-wizard'

type PersistedState = {
  step: Step
  csv: CsvData | null
  fileName: string
  target: Target | null
  mapping: FieldMapping[] | null
  newFields: NewField[] | null
  writtenPath: string | null
}

function loadPersisted(): PersistedState | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed?.csv?.columns?.length || !parsed.csv?.rows) return null
    const validSteps: Step[] = [
      'upload',
      'target',
      'map',
      'newSchema',
      'import',
    ]
    if (!validSteps.includes(parsed.step)) parsed.step = 'target'
    if (
      parsed.step !== 'upload' &&
      parsed.step !== 'target' &&
      !parsed.target
    ) {
      parsed.step = 'target'
    }
    return parsed
  } catch {
    return null
  }
}

export function CsvImportTool(props: { schemaFileWriter?: SchemaFileWriter } = {}) {
  const [persisted] = useState(loadPersisted)
  const [step, setStep] = useState<Step>(persisted?.step ?? 'upload')
  const [csv, setCsv] = useState<CsvData | null>(persisted?.csv ?? null)
  const [fileName, setFileName] = useState(persisted?.fileName ?? '')
  const [target, setTarget] = useState<Target | null>(persisted?.target ?? null)
  const [mapping, setMapping] = useState<FieldMapping[] | null>(
    persisted?.mapping ?? null,
  )
  const [newFields, setNewFields] = useState<NewField[] | null>(
    persisted?.newFields ?? null,
  )
  const [writtenPath, setWrittenPath] = useState<string | null>(
    persisted?.writtenPath ?? null,
  )

  useEffect(() => {
    try {
      if (!csv) {
        sessionStorage.removeItem(STORAGE_KEY)
        return
      }
      const state: PersistedState = {
        step,
        csv,
        fileName,
        target,
        mapping,
        newFields,
        writtenPath,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded on very large CSVs; skip persistence silently
    }
  }, [step, csv, fileName, target, mapping, newFields, writtenPath])

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
    setStep('upload')
    setCsv(null)
    setFileName('')
    setTarget(null)
    setMapping(null)
    setNewFields(null)
    setWrittenPath(null)
  }, [])

  const onParsed = useCallback((data: CsvData, name: string) => {
    setCsv(data)
    setFileName(name)
    setTarget(null)
    setMapping(null)
    setNewFields(null)
    setWrittenPath(null)
    setStep('target')
  }, [])

  const onTarget = useCallback(
    (next: Target) => {
      if (
        next.kind === 'existing' &&
        target?.kind === 'existing' &&
        target.typeName !== next.typeName
      ) {
        setMapping(null)
      }
      if (
        next.kind === 'new' &&
        target?.kind === 'new' &&
        target.typeTitle !== next.typeTitle
      ) {
        setNewFields(null)
        setWrittenPath(null)
      }
      setTarget(next)
      setStep(next.kind === 'existing' ? 'map' : 'newSchema')
    },
    [target],
  )

  const importInfo = useMemo(() => {
    if (!target) return null
    if (target.kind === 'existing') {
      if (!mapping) return null
      return { typeName: target.typeName, mapping }
    }
    if (!newFields) return null
    const included = newFields.filter((f) => f.include)
    return {
      typeName: toTypeName(target.typeTitle),
      mapping: included.map((f) => ({
        column: f.column,
        field: f.name,
        fieldType: f.type,
        transform: defaultTransformFor(f.type),
      })),
    }
  }, [target, mapping, newFields])

  const stepIndex =
    step === 'newSchema' ? 2 : STEPS.findIndex((s) => s.id === step)

  return (
    <Container width={3} padding={4} style={{ width: 'auto' }}>
      <Stack gap={5}>
        <Flex align="center" justify="space-between" gap={3}>
          <Stack gap={4}>
            <Heading size={2}>Import CSV</Heading>
            {csv && (
              <Text size={1} muted>
                {fileName} · step {stepIndex + 1} of {STEPS.length}:{' '}
                {step === 'newSchema' ? 'New schema' : STEPS[stepIndex]?.label}
              </Text>
            )}
          </Stack>
          {step !== 'upload' && (
            <Button
              text="Start over"
              mode="ghost"
              fontSize={1}
              onClick={reset}
            />
          )}
        </Flex>

        <Card>
          {step === 'upload' && <UploadStep onParsed={onParsed} />}

          {step === 'target' && csv && (
            <TargetStep csv={csv} onBack={reset} onNext={onTarget} />
          )}

          {step === 'map' && csv && target?.kind === 'existing' && (
            <MapExistingStep
              csv={csv}
              typeName={target.typeName}
              initialMapping={mapping}
              onBack={() => setStep('target')}
              onNext={(nextMapping) => {
                setMapping(nextMapping)
                setStep('import')
              }}
            />
          )}

          {step === 'newSchema' && csv && target?.kind === 'new' && (
            <NewSchemaStep
              csv={csv}
              typeTitle={target.typeTitle}
              fields={newFields}
              writtenPath={writtenPath}
              schemaFileWriter={props.schemaFileWriter}
              onWritten={setWrittenPath}
              onFieldsChange={setNewFields}
              onBack={() => setStep('target')}
              onNext={() => setStep('import')}
            />
          )}

          {step === 'import' && csv && importInfo && (
            <ImportStep
              csv={csv}
              typeName={importInfo.typeName}
              mapping={importInfo.mapping}
              onBack={() =>
                setStep(target?.kind === 'new' ? 'newSchema' : 'map')
              }
              onReset={reset}
            />
          )}
        </Card>

        <Box paddingBottom={4}>
          <Text size={1} muted>
            Documents are created directly through the Studio's Sanity client.
            Transforms are applied client-side so what you see in the preview is
            exactly what gets written.
          </Text>
        </Box>
      </Stack>
    </Container>
  )
}

export function createCsvImportTool(schemaFileWriter?: SchemaFileWriter) {
  return function ConfiguredCsvImportTool() {
    return <CsvImportTool schemaFileWriter={schemaFileWriter} />
  }
}
