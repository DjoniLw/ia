'use client'

import { useRef, useState, useEffect } from 'react'
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRole } from '@/lib/hooks/use-role'
import { getAccessToken, decodeJwtPayload } from '@/lib/auth'
import {
  presignUpload,
  confirmUpload,
  getUploadUrl,
  FILE_CATEGORY_LABELS,
  type FileCategory,
} from '@/lib/hooks/use-body-measurements'
import {
  useMeasurementSheets,
  type MeasurementSheet,
  type MeasurementField,
} from '@/lib/hooks/use-measurement-sheets'
import {
  useMeasurementSessions,
  useCreateMeasurementSession,
  useUpdateMeasurementSession,
  useDeleteMeasurementSession,
  type MeasurementSession,
} from '@/lib/hooks/use-measurement-sessions'

// ──── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  bodyDataConsentAt?: string | null
  metadata?: Record<string, unknown> | null
}

interface PendingFile {
  file: File
  preview: string
  category: FileCategory | ''
  progress: number
  error?: string
  confirmedId?: string
}

type SheetFormState = {
  simpleValues: Record<string, string>       // fieldId → value
  tabularValues: Record<string, Record<string, string>>  // fieldId → {columnId: value}
  checkValues: Record<string, boolean>       // fieldId → checked (M-04)
}
type FormState = Record<string, SheetFormState>  // sheetId → state

// ──── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES = 10
const MAX_SIZE = 10 * 1024 * 1024

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function calcBMI(weight: number, height: number): string | null {
  if (!weight || !height || height <= 0) return null
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  return bmi.toFixed(1)
}

function getCurrentUserId(): string | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload<{ sub?: string }>(token)
  return payload?.sub ?? null
}

function hasAnyValue(state: FormState): boolean {
  for (const sheet of Object.values(state)) {
    if (Object.values(sheet.simpleValues).some((v) => v !== '')) return true
    for (const cols of Object.values(sheet.tabularValues)) {
      if (Object.values(cols).some((v) => v !== '')) return true
    }
    if (Object.values(sheet.checkValues ?? {}).some((v) => v)) return true
  }
  return false
}

// ──── Upload area ──────────────────────────────────────────────────────────────

function UploadArea({
  files,
  onChange,
  consentAt,
}: {
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
  consentAt: string | null | undefined
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (selected: File[]) => {
    const valid = selected.filter((f) => ALLOWED_MIME.includes(f.type) && f.size <= MAX_SIZE)
    const remaining = MAX_FILES - files.length
    const toAdd: PendingFile[] = valid.slice(0, remaining).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      category: '',
      progress: 0,
    }))
    onChange([...files, ...toAdd])
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (idx: number) => {
    const next = [...files]
    URL.revokeObjectURL(next[idx].preview)
    next.splice(idx, 1)
    onChange(next)
  }

  const setCategory = (idx: number, category: FileCategory) => {
    const next = [...files]
    next[idx] = { ...next[idx], category }
    onChange(next)
  }

  if (!consentAt) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800 p-4 flex gap-3 items-start">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Consentimento LGPD não registrado
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
            Este cliente ainda não forneceu consentimento para registro de dados corporais. O
            upload de fotos está desabilitado. Para registrar o consentimento, acesse a aba
            &ldquo;Contratos &amp; LGPD&rdquo; do perfil do cliente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleSelect}
        />
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste imagens ou <span className="text-primary underline">clique para selecionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Máx. {MAX_FILES} arquivos · JPEG, PNG, WebP · até 10 MB cada
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((pf, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg border p-2 bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pf.preview} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-medium truncate">{pf.file.name}</p>
                <Select value={pf.category} onValueChange={(v) => setCategory(idx, v as FileCategory)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Selecionar categoria *" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FILE_CATEGORY_LABELS) as FileCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>{FILE_CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pf.progress > 0 && pf.progress < 100 && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pf.progress}%` }} />
                  </div>
                )}
                {pf.error && <p className="text-xs text-destructive">{pf.error}</p>}
              </div>
              <button type="button" onClick={() => removeFile(idx)} className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──── Sheet accordion section no formulário ────────────────────────────────────

function SheetFormSection({
  sheet,
  state,
  onStateChange,
  defaultOpen = false,
}: {
  sheet: MeasurementSheet
  state: SheetFormState
  onStateChange: (next: SheetFormState) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const activeFields = sheet.fields.filter((f) => f.active).sort((a, b) => a.order - b.order)

  const setSimple = (fieldId: string, val: string) => {
    onStateChange({
      ...state,
      simpleValues: { ...state.simpleValues, [fieldId]: val },
    })
  }

  const setTabular = (fieldId: string, columnId: string, val: string) => {
    onStateChange({
      ...state,
      tabularValues: {
        ...state.tabularValues,
        [fieldId]: { ...(state.tabularValues[fieldId] ?? {}), [columnId]: val },
      },
    })
  }

  const setCheck = (fieldId: string, checked: boolean) => {
    onStateChange({
      ...state,
      checkValues: { ...(state.checkValues ?? {}), [fieldId]: checked },
    })
  }

  const simpleFields = activeFields.filter((f) => f.type === 'SIMPLE')
  const tabularFields = activeFields.filter((f) => f.type === 'TABULAR')
  const checkFields = activeFields.filter((f) => f.type === 'CHECK')

  // IMC calculado
  const weightField = simpleFields.find((f) => f.name.toLowerCase().includes('peso'))
  const heightField = simpleFields.find((f) => f.name.toLowerCase().includes('altura'))
  const bmi =
    weightField && heightField
      ? calcBMI(
          Number(state.simpleValues[weightField.id]),
          Number(state.simpleValues[heightField.id]),
        )
      : null

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border-b hover:bg-primary/10 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold">{sheet.name}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Campos simples */}
          {simpleFields.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {simpleFields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <Label className="text-xs">
                    {field.name}
                    {field.unit && <span className="text-muted-foreground"> ({field.unit})</span>}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="—"
                    value={state.simpleValues[field.id] ?? ''}
                    onChange={(e) => setSimple(field.id, e.target.value)}
                  />
                </div>
              ))}
              {bmi && (
                <div className="space-y-1">
                  <Label className="text-xs">IMC <span className="text-muted-foreground">(kg/m²)</span></Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                    {bmi}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">calculado</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Campos tabulares */}
          {tabularFields.map((field) => (
            <div key={field.id}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{field.name}</p>
              {field.columns.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma sub-coluna configurada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-muted/50">
                      <tr>
                        {field.columns.map((col) => (
                          <th key={col.id} className="border px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {col.name} <span className="font-normal">({col.unit})</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {field.columns.map((col) => (
                          <td key={col.id} className="border px-3 py-2">
                            <Input
                              type="number"
                              step="any"
                              placeholder="—"
                              className="h-8 text-xs w-24"
                              value={(state.tabularValues[field.id] ?? {})[col.id] ?? ''}
                              onChange={(e) => setTabular(field.id, col.id, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* M-04: Campos de marcação (CHECK) */}
          {checkFields.length > 0 && (
            <div className="space-y-2">
              {checkFields.map((field) => (
                <label key={field.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={(state.checkValues ?? {})[field.id] ?? false}
                    onChange={(e) => setCheck(field.id, e.target.checked)}
                  />
                  <span className="text-sm">{field.name}</span>
                </label>
              ))}
            </div>
          )}

          {simpleFields.length === 0 && tabularFields.length === 0 && checkFields.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum campo ativo nesta ficha.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ──── Modal de nova/editar evolução ───────────────────────────────────────────

const sessionMetaSchema = z.object({
  recordedAt: z.string().min(1, 'Data obrigatória'),
  notes: z.string().optional(),
})
type SessionMetaForm = z.infer<typeof sessionMetaSchema>

function SessionFormModal({
  customer,
  sheets,
  sessionToEdit,
  onClose,
}: {
  customer: Customer
  sheets: MeasurementSheet[]
  sessionToEdit?: MeasurementSession
  onClose: () => void
}) {
  const createSession = useCreateMeasurementSession()
  const updateSession = useUpdateMeasurementSession()
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)

  // Pre-populate state for editing
  const buildInitialState = (): FormState => {
    const result: FormState = {}
    for (const sheet of sheets) {
      const simpleValues: Record<string, string> = {}
      const tabularValues: Record<string, Record<string, string>> = {}
      const checkValues: Record<string, boolean> = {}
      if (sessionToEdit) {
        const sheetRecord = sessionToEdit.sheetRecords.find((sr) => sr.sheetId === sheet.id)
        if (sheetRecord) {
          for (const v of sheetRecord.values) {
            if (v.field.type === 'CHECK') {
              checkValues[v.fieldId] = Number(v.value) === 1
            } else {
              simpleValues[v.fieldId] = String(Number(v.value))
            }
          }
          for (const v of sheetRecord.tabularValues) {
            if (!tabularValues[v.fieldId]) tabularValues[v.fieldId] = {}
            tabularValues[v.fieldId][v.columnId] = String(Number(v.value))
          }
        }
      }
      result[sheet.id] = { simpleValues, tabularValues, checkValues }
    }
    return result
  }

  const [formState, setFormState] = useState<FormState>(buildInitialState)

  // Cleanup object URLs when modal closes
  useEffect(() => {
    return () => { pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { register, handleSubmit, formState: { errors, isDirty: metaDirty } } = useForm<SessionMetaForm>({
    resolver: zodResolver(sessionMetaSchema),
    defaultValues: {
      recordedAt: sessionToEdit ? sessionToEdit.recordedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: sessionToEdit?.notes ?? '',
    },
  })

  const hasUnsaved = metaDirty || hasAnyValue(formState) || pendingFiles.length > 0

  const doUploadFiles = async (): Promise<string[]> => {
    const confirmedIds: string[] = []
    const updated = [...pendingFiles]
    for (let i = 0; i < updated.length; i++) {
      const pf = updated[i]
      if (!pf.category) continue
      try {
        const { presignedUrl, id: pendingId } = await presignUpload({
          fileName: pf.file.name,
          mimeType: pf.file.type,
          size: pf.file.size,
          customerId: customer.id,
          category: pf.category as FileCategory,
        })
        updated[i] = { ...updated[i], progress: 30 }
        setPendingFiles([...updated])
        await new Promise<void>((resolve, reject) => {
          const x = new XMLHttpRequest()
          x.open('PUT', presignedUrl)
          x.setRequestHeader('Content-Type', pf.file.type)
          x.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              updated[i] = { ...updated[i], progress: Math.round((ev.loaded / ev.total) * 70) + 30 }
              setPendingFiles([...updated])
            }
          }
          x.onload = () => (x.status < 300 ? resolve() : reject(new Error(`HTTP ${x.status}`)))
          x.onerror = () => reject(new Error('Falha no upload'))
          x.send(pf.file)
        })
        const confirmed = await confirmUpload({ id: pendingId })
        updated[i] = { ...updated[i], progress: 100, confirmedId: confirmed.id }
        setPendingFiles([...updated])
        confirmedIds.push(confirmed.id)
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
        updated[i] = {
          ...updated[i],
          error: code === 'MIME_TYPE_MISMATCH'
            ? 'Arquivo inválido. Apenas JPEG, PNG ou WebP são aceitos.'
            : 'Erro no upload. Tente novamente.',
        }
        setPendingFiles([...updated])
      }
    }
    return confirmedIds
  }

  const onSubmit = handleSubmit(async (meta) => {
    if (!hasAnyValue(formState)) {
      toast.error('Preencha ao menos um valor antes de salvar.')
      return
    }

    const withoutCategory = pendingFiles.filter((f) => !f.category)
    if (withoutCategory.length > 0) {
      toast.error('Selecione a categoria de todos os arquivos antes de salvar.')
      return
    }

    setUploading(true)
    try {
      const fileIds = await doUploadFiles()

      const sheetRecords = Object.entries(formState)
        .map(([sheetId, state]) => {
          const values = [
            ...Object.entries(state.simpleValues)
              .filter(([, v]) => v !== '' && !isNaN(Number(v)))
              .map(([fieldId, value]) => ({ fieldId, value: Number(value) })),
            // M-04: CHECK fields stored as 1/0
            ...Object.entries(state.checkValues ?? {})
              .map(([fieldId, checked]) => ({ fieldId, value: checked ? 1 : 0 })),
          ]
          const tabularValues = Object.entries(state.tabularValues).flatMap(([fieldId, cols]) =>
            Object.entries(cols)
              .filter(([, v]) => v !== '' && !isNaN(Number(v)))
              .map(([columnId, value]) => ({ fieldId, columnId, value: Number(value) })),
          )
          if (values.length === 0 && tabularValues.length === 0) return null
          return { sheetId, values, tabularValues }
        })
        .filter(Boolean) as Array<{ sheetId: string; values: { fieldId: string; value: number }[]; tabularValues: { fieldId: string; columnId: string; value: number }[] }>

      if (sessionToEdit) {
        await updateSession.mutateAsync({
          id: sessionToEdit.id,
          customerId: customer.id,
          recordedAt: meta.recordedAt,
          notes: meta.notes || undefined,
          sheetRecords,
          fileIds,
        })
        toast.success('Registros de evolução atualizados')
      } else {
        await createSession.mutateAsync({
          customerId: customer.id,
          recordedAt: meta.recordedAt,
          notes: meta.notes || undefined,
          sheetRecords,
          fileIds,
        })
        toast.success('Registro de evolução salvo com sucesso')
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'EMPTY_SESSION') {
        toast.error('Preencha ao menos um valor antes de salvar.')
      } else {
        toast.error('Erro ao salvar registro')
      }
    } finally {
      setUploading(false)
    }
  })

  const isPending = uploading || createSession.isPending || updateSession.isPending
  const title = sessionToEdit ? 'Editar registro de evolução' : 'Novo registro de evolução'

  return (
    <Dialog open onClose={onClose} isDirty={hasUnsaved} className="p-0 max-w-2xl">
      <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
        <DialogTitle className="mb-0">{title}</DialogTitle>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar modal">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          {/* Data */}
          <div className="space-y-1.5">
            <Label htmlFor="session-date">Data da avaliação</Label>
            <Input id="session-date" type="date" max={new Date().toISOString().slice(0, 10)} {...register('recordedAt')} />
            {errors.recordedAt && <p className="text-xs text-destructive">{errors.recordedAt.message}</p>}
          </div>

          {/* Fitas por ficha */}
          {sheets
            .filter((s) => s.active)
            .sort((a, b) => a.order - b.order)
            .map((sheet, index) => (
              <SheetFormSection
                key={sheet.id}
                sheet={sheet}
                state={formState[sheet.id] ?? { simpleValues: {}, tabularValues: {}, checkValues: {} }}
                onStateChange={(next) => setFormState((prev) => ({ ...prev, [sheet.id]: next }))}
                defaultOpen={index === 0}
              />
            ))}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="session-notes">Observações gerais</Label>
            <textarea
              id="session-notes"
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Anotações sobre esta avaliação..."
              {...register('notes')}
            />
          </div>

          {/* Upload de fotos */}
          <div>
            <p className="text-sm font-medium mb-3">Fotos</p>
            <UploadArea files={pendingFiles} onChange={setPendingFiles} consentAt={customer.bodyDataConsentAt} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2 rounded-b-xl">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {sessionToEdit ? 'Salvar alterações' : 'Salvar registro'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Modal de comparação ──────────────────────────────────────────────────────

function CompareModal({
  current,
  previous,
  onClose,
}: {
  current: MeasurementSession
  previous: MeasurementSession
  onClose: () => void
}) {
  // Coleta todos os valores simples de uma sessão em um único mapa
  const flattenSimple = (session: MeasurementSession) => {
    const map = new Map<string, { name: string; unit: string; value: number }>()
    for (const sr of session.sheetRecords) {
      for (const v of sr.values) {
        if (v.field.type !== 'SIMPLE') continue
        map.set(v.fieldId, { name: v.field.name, unit: v.field.unit ?? '', value: Number(v.value) })
      }
    }
    return map
  }

  const prevMap = flattenSimple(previous)
  const currMap = flattenSimple(current)
  const allFieldIds = [...new Set([...prevMap.keys(), ...currMap.keys()])]

  const getLabelForField = (id: string) =>
    currMap.get(id) ?? prevMap.get(id) ?? { name: id, unit: '' }

  const prevBMI = (() => {
    const w = [...prevMap.values()].find((v) => v.name.toLowerCase().includes('peso'))
    const h = [...prevMap.values()].find((v) => v.name.toLowerCase().includes('altura'))
    return w && h ? calcBMI(w.value, h.value) : null
  })()
  const currBMI = (() => {
    const w = [...currMap.values()].find((v) => v.name.toLowerCase().includes('peso'))
    const h = [...currMap.values()].find((v) => v.name.toLowerCase().includes('altura'))
    return w && h ? calcBMI(w.value, h.value) : null
  })()

  return (
    <Dialog open onClose={onClose} className="max-w-3xl p-0">
      {/* X button fora do sticky header — posicionado absolutamente */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 text-muted-foreground hover:text-foreground bg-card rounded-full p-1"
        aria-label="Fechar comparação"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="sticky top-0 bg-card border-b px-6 py-4 rounded-t-xl z-10">
        <DialogTitle className="mb-0">Comparação de registros</DialogTitle>
      </div>

      <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
        {/* Cabeçalho das colunas */}
        <div className="grid grid-cols-[1fr_120px_1fr] gap-2">
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Anterior</p>
            <p className="text-sm font-medium mt-0.5">{formatDate(previous.recordedAt)}</p>
          </div>
          <div />
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atual</p>
            <p className="text-sm font-medium mt-0.5">{formatDate(current.recordedAt)}</p>
          </div>
        </div>

        {allFieldIds.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Nenhuma medida simples registrada em ambos os registros.
          </p>
        ) : (
          <div className="space-y-2">
            {allFieldIds.map((fieldId) => {
              const meta = getLabelForField(fieldId)
              const prevVal = prevMap.get(fieldId)?.value ?? null
              const currVal = currMap.get(fieldId)?.value ?? null
              const trend: 'up' | 'down' | 'same' =
                prevVal !== null && currVal !== null
                  ? currVal > prevVal ? 'up' : currVal < prevVal ? 'down' : 'same'
                  : 'same'
              const currClass =
                trend === 'up' ? 'text-green-600 dark:text-green-400' :
                trend === 'down' ? 'text-red-600 dark:text-red-400' : ''

              return (
                <div key={fieldId} className="grid grid-cols-[1fr_120px_1fr] items-center gap-2 rounded-lg bg-muted/10 border px-3 py-2">
                  <div className="text-right">
                    {prevVal !== null ? (
                      <span className="text-sm font-medium">{prevVal.toLocaleString('pt-BR')} {meta.unit}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground truncate">{meta.name}</p>
                    {trend === 'up' && <span className="text-xs font-semibold text-green-600 dark:text-green-400">↑</span>}
                    {trend === 'down' && <span className="text-xs font-semibold text-red-600 dark:text-red-400">↓</span>}
                  </div>
                  <div className="text-left">
                    {currVal !== null ? (
                      <span className={`text-sm font-medium ${currClass}`}>{currVal.toLocaleString('pt-BR')} {meta.unit}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </div>
              )
            })}

            {(prevBMI !== null || currBMI !== null) && (
              <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-2 rounded-lg bg-muted/20 border border-dashed px-3 py-2">
                <div className="text-right">
                  {prevBMI ? <span className="text-sm font-medium">{prevBMI} kg/m²</span> : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">IMC</p>
                  <p className="text-[10px] text-muted-foreground">calculado</p>
                </div>
                <div className="text-left">
                  {currBMI ? (
                    <span className={`text-sm font-medium ${prevBMI && Number(currBMI) > Number(prevBMI) ? 'text-green-600 dark:text-green-400' : prevBMI && Number(currBMI) < Number(prevBMI) ? 'text-red-600 dark:text-red-400' : ''}`}>{currBMI} kg/m²</span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {(previous.notes || current.notes) && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Observações (anterior)</p>
              <p className="text-sm">{previous.notes ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Observações (atual)</p>
              <p className="text-sm">{current.notes ?? '—'}</p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ──── Card de sessão ───────────────────────────────────────────────────────────

function SessionCard({
  session,
  previousSession,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
}: {
  session: MeasurementSession
  previousSession?: MeasurementSession
  canEdit: boolean
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [lightboxFile, setLightboxFile] = useState<string | null>(null)

  const totalValues = session.sheetRecords.reduce(
    (sum, sr) => sum + sr.values.length + sr.tabularValues.length,
    0,
  )
  const sheetBadges = session.sheetRecords.map((sr) => sr.sheet.name)

  const loadFileUrls = async () => {
    if (session.files.length === 0) return
    setLoadingUrls(true)
    try {
      const urls: Record<string, string> = {}
      await Promise.all(session.files.map(async (f) => {
        const { url } = await getUploadUrl(f.id)
        urls[f.id] = url
      }))
      setFileUrls(urls)
    } finally {
      setLoadingUrls(false)
    }
  }

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && session.files.length > 0 && Object.keys(fileUrls).length === 0) {
      void loadFileUrls()
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-medium">{formatDate(session.recordedAt)}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {sheetBadges.map((name) => (
              <span key={name} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {name}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">· {totalValues} medida{totalValues !== 1 ? 's' : ''}</span>
            {session.files.length > 0 && (
              <span className="text-xs text-muted-foreground">· {session.files.length} foto{session.files.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Valores por ficha */}
          {session.sheetRecords.map((sr) => {
            const simpleVals = sr.values.filter((v) => v.field.type === 'SIMPLE')
            const checkVals = sr.values.filter((v) => v.field.type === 'CHECK')
            const tabularFields = sr.tabularValues.reduce<Record<string, { name: string; cols: typeof sr.tabularValues }>>(
              (acc, v) => {
                if (!acc[v.fieldId]) acc[v.fieldId] = { name: v.field.name, cols: [] }
                acc[v.fieldId].cols.push(v)
                return acc
              },
              {},
            )

            return (
              <div key={sr.id} className="pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{sr.sheet.name}</p>

                {simpleVals.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {simpleVals.map((v) => (
                      <div key={v.id} className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground">{v.field.name}</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {Number(v.value).toLocaleString('pt-BR')}
                          {v.field.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{v.field.unit}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {Object.values(tabularFields).map((tf) => (
                  <div key={tf.name} className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">{tf.name}</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr>
                            {tf.cols.map((v) => (
                              <th key={v.columnId} className="text-left font-medium pr-3 pb-1 whitespace-nowrap text-muted-foreground">
                                {v.column.name} ({v.column.unit})
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {tf.cols.map((v) => (
                              <td key={v.columnId} className="pr-3 text-sm font-medium">
                                {Number(v.value).toLocaleString('pt-BR')}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* M-04: Campos CHECK */}
                {checkVals.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {checkVals.map((v) => (
                      <div key={v.id} className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground">{v.field.name}</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {Number(v.value) === 1 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">✓ Sim</span>
                          ) : (
                            <span className="text-muted-foreground">— Não</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Observações */}
          {session.notes && (
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{session.notes}</p>
            </div>
          )}

          {/* Fotos */}
          {session.files.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Fotos</p>
              {loadingUrls ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {session.files.map((f) => (
                    <div key={f.id} className="relative">
                      {fileUrls[f.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fileUrls[f.id]}
                          alt={f.name}
                          className="h-20 w-20 rounded-lg object-cover cursor-pointer hover:opacity-90"
                          onClick={() => setLightboxFile(fileUrls[f.id])}
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] bg-black/60 text-white rounded px-1 truncate">
                        {FILE_CATEGORY_LABELS[f.category as FileCategory] ?? f.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <div className="flex gap-1">
              {previousSession && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setCompareOpen(true)}>
                  <ArrowLeftRight className="mr-1 h-3 w-3" />
                  Comparar com anterior
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              {canEdit && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
              )}
              {isAdmin && (
                showDeleteConfirm ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-xs text-destructive">Esta ação é irreversível.</p>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onDelete}>Excluir</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    Excluir
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <Dialog open onClose={() => setLightboxFile(null)} className="p-0 bg-transparent border-0 shadow-none max-w-5xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxFile} alt="Foto ampliada" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
          <button type="button" className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/40 rounded-full p-1" aria-label="Fechar imagem" onClick={() => setLightboxFile(null)}>
            <X className="h-5 w-5" />
          </button>
        </Dialog>
      )}

      {compareOpen && previousSession && (
        <CompareModal current={session} previous={previousSession} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  )
}

// ──── EvolutionTab (principal) ─────────────────────────────────────────────────

export function EvolutionTab({ customer }: { customer: Customer }) {
  const role = useRole()
  const isAdmin = role === 'admin'
  const isStaff = role === 'staff'
  const currentUserId = getCurrentUserId()

  const { data: sheetsData = [], isLoading: loadingSheets } = useMeasurementSheets()
  const { data: sessionsPage, isLoading: loadingSessions, error, refetch } = useMeasurementSessions(
    customer.id,
    { limit: 50 },
  )
  const deleteSession = useDeleteMeasurementSession()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<MeasurementSession | undefined>()

  const activeSheets = sheetsData.filter((s) => s.active).sort((a, b) => a.order - b.order)
  const sessions = sessionsPage?.items ?? []
  const isLoading = loadingSheets || loadingSessions
  const canCreate = isAdmin || isStaff

  const handleDelete = async (session: MeasurementSession) => {
    try {
      await deleteSession.mutateAsync({ id: session.id, customerId: customer.id })
      toast.success('Registro excluído com sucesso')
    } catch {
      toast.error('Erro ao excluir registro')
    }
  }

  if (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para visualizar os dados de evolução deste cliente.
          </p>
        </div>
      )
    }
    return (
      <div className="py-6 text-center text-sm text-muted-foreground space-y-3">
        <p>Erro ao carregar registros de evolução.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Evolução corporal</p>
        {canCreate && (
          <Button size="sm" onClick={() => { setEditingSession(undefined); setModalOpen(true) }} disabled={isLoading}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Novo registro
          </Button>
        )}
      </div>

      {/* Estados */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activeSheets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Configure as fichas de avaliação em{' '}
            <span className="font-medium">Configurações → Medidas Corporais</span> para começar a registrar.
          </p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-2">Nenhum registro de evolução.</p>
          {canCreate && (
            <Button size="sm" onClick={() => { setEditingSession(undefined); setModalOpen(true) }}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo registro
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => {
            const canEdit = isAdmin || isStaff || session.createdById === currentUserId
            return (
              <SessionCard
                key={session.id}
                session={session}
                previousSession={sessions[i + 1]}
                canEdit={canEdit}
                isAdmin={isAdmin}
                onEdit={() => { setEditingSession(session); setModalOpen(true) }}
                onDelete={() => void handleDelete(session)}
              />
            )
          })}
          {sessions.length >= 50 && (
            <p className="text-center text-xs text-muted-foreground pt-1">
              Exibindo os 50 registros mais recentes.
            </p>
          )}
        </div>
      )}

      {/* Modal de formulário */}
      {modalOpen && (
        <SessionFormModal
          customer={customer}
          sheets={activeSheets}
          sessionToEdit={editingSession}
          onClose={() => { setModalOpen(false); setEditingSession(undefined) }}
        />
      )}
    </div>
  )
}

