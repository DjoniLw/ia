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
  type MeasurementSheetColumn,
  type MeasurementCategory,
} from '@/lib/hooks/use-measurement-sheets'
import {
  CATEGORY_LABELS,
  CATEGORY_BADGE_COLOR,
  MEASUREMENT_CATEGORIES_ORDER,
} from '@/lib/measurement-categories'
import {
  useMeasurementSessions,
  useCreateMeasurementSession,
  useUpdateMeasurementSession,
  useDeleteMeasurementSession,
  type MeasurementSession,
  type MeasurementSessionFile,
} from '@/lib/hooks/use-measurement-sessions'
import { useAppointments } from '@/lib/hooks/use-appointments'
import { NewCustomerSheetModal } from '@/components/measurement-sheets/NewCustomerSheetModal'

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
  textualValues: Record<string, string>      // fieldId → texto (campos isTextual)
  tabularValues: Record<string, Record<string, string>>  // fieldId → {"colId" | "colId::sub": value}
  checkValues: Record<string, boolean>       // fieldId → checked (M-04)
}
type FormState = Record<string, SheetFormState>  // sheetId → state

// ──── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES = 10
const MAX_SIZE = 10 * 1024 * 1024

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    if (Object.values(sheet.textualValues ?? {}).some((v) => v !== '')) return true
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
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 flex gap-3 items-start">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Consentimento LGPD não registrado
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
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
  selectable = false,
  selected = false,
  onSelectionChange,
}: {
  sheet: MeasurementSheet
  state: SheetFormState
  onStateChange: (updater: SheetFormState | ((prev: SheetFormState) => SheetFormState)) => void
  defaultOpen?: boolean
  selectable?: boolean
  selected?: boolean
  onSelectionChange?: (selected: boolean) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const activeFields = sheet.fields.filter((f) => f.active).sort((a, b) => a.order - b.order)

  const setSimple = (fieldId: string, val: string) => {
    onStateChange((prev) => ({
      ...prev,
      simpleValues: { ...prev.simpleValues, [fieldId]: val },
    }))
  }

  const setTextual = (fieldId: string, val: string) => {
    onStateChange((prev) => ({
      ...prev,
      textualValues: { ...(prev.textualValues ?? {}), [fieldId]: val },
    }))
  }

  // colKey: columnId para campos normais; "columnId::subColumn" para sub-colunas
  const setTabular = (fieldId: string, colKey: string, val: string) => {
    onStateChange((prev) => ({
      ...prev,
      tabularValues: {
        ...prev.tabularValues,
        [fieldId]: { ...(prev.tabularValues[fieldId] ?? {}), [colKey]: val },
      },
    }))
  }

  const setCheck = (fieldId: string, checked: boolean) => {
    onStateChange((prev) => ({
      ...prev,
      checkValues: { ...(prev.checkValues ?? {}), [fieldId]: checked },
    }))
  }

  const simpleFields = activeFields.filter((f) => f.inputType === 'INPUT')
  const checkFields = activeFields.filter((f) => f.inputType === 'CHECK')

  // Para fichas TABULAR, colunas são definidas na ficha
  const sheetColumns = sheet.type === 'TABULAR' ? [...sheet.columns].sort((a, b) => a.order - b.order) : []

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
      <div className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border-b hover:bg-primary/10 transition-colors">
        {selectable && (
          <input
            type="checkbox"
            aria-label={`Selecionar ficha ${sheet.name}`}
            checked={selected}
            onChange={(e) => {
              onSelectionChange?.(e.target.checked)
              if (e.target.checked) setOpen(true)
            }}
            onClick={(e) => e.stopPropagation()}
            className="mr-2 h-4 w-4 shrink-0 rounded border-input cursor-pointer"
          />
        )}
        <button
          type="button"
          className="flex-1 flex items-center justify-between text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{sheet.name}</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Campos de entrada numérica (fichas SIMPLES) */}
          {sheet.type === 'SIMPLE' && simpleFields.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {simpleFields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <Label className="text-xs">
                    {field.name}
                    {!field.isTextual && field.unit && <span className="text-muted-foreground"> ({field.unit})</span>}
                  </Label>
                  {field.isTextual ? (
                    <textarea
                      placeholder="—"
                      rows={2}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
                      value={(state.textualValues ?? {})[field.id] ?? ''}
                      onChange={(e) => {
                        e.target.style.height = 'auto'
                        e.target.style.height = `${e.target.scrollHeight}px`
                        setTextual(field.id, e.target.value)
                      }}
                    />
                  ) : (
                    <Input
                      type="number"
                      step="any"
                      placeholder="—"
                      value={state.simpleValues[field.id] ?? ''}
                      onChange={(e) => setSimple(field.id, e.target.value)}
                    />
                  )}
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

          {/* Ficha TABULAR: grade campo × coluna */}
          {sheet.type === 'TABULAR' && sheetColumns.length > 0 && activeFields.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border px-3 py-2 text-left font-medium text-muted-foreground">Campo</th>
                    {sheetColumns.map((col) => (
                      <th key={col.id} className="border px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {col.name}{!col.isTextual && col.unit && <span className="font-normal"> ({col.unit})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeFields.map((field) => (
                    <tr key={field.id}>
                      <td className="border px-3 py-2 font-medium whitespace-nowrap">{field.name}</td>
                      {sheetColumns.map((col) => {
                        const hasSubCols = field.subColumns && field.subColumns.length > 0
                        return (
                          <td key={col.id} className="border px-2 py-1.5">
                            {col.inputType === 'CHECK' && !hasSubCols ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={(state.tabularValues[field.id] ?? {})[col.id] === '1'}
                                onChange={(e) => setTabular(field.id, col.id, e.target.checked ? '1' : '0')}
                              />
                            ) : col.isTextual && !hasSubCols ? (
                              <textarea
                                placeholder={field.defaultValue ?? col.defaultValue ?? '—'}
                                rows={1}
                                className="w-full min-w-[140px] rounded-md border bg-background px-2 py-1.5 text-xs resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
                                value={(state.tabularValues[field.id] ?? {})[col.id] ?? (field.defaultValue ?? col.defaultValue ?? '')}
                                onChange={(e) => {
                                  e.target.style.height = 'auto'
                                  e.target.style.height = `${e.target.scrollHeight}px`
                                  setTabular(field.id, col.id, e.target.value)
                                }}
                              />
                            ) : hasSubCols ? (
                              <div className="flex gap-1">
                                {field.subColumns.map((sub) => {
                                  const colKey = `${col.id}::${sub}`
                                  return (
                                    <div key={sub} className="flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] text-muted-foreground">{sub}=</span>
                                      {col.inputType === 'CHECK' ? (
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-input"
                                          checked={(state.tabularValues[field.id] ?? {})[colKey] === '1'}
                                          onChange={(e) => setTabular(field.id, colKey, e.target.checked ? '1' : '0')}
                                        />
                                      ) : col.isTextual ? (
                                        <textarea
                                          placeholder={col.defaultValue ?? sub}
                                          rows={1}
                                          className="w-20 rounded-md border bg-background px-1.5 py-1 text-xs resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
                                          value={(state.tabularValues[field.id] ?? {})[colKey] ?? ''}
                                          onChange={(e) => {
                                            e.target.style.height = 'auto'
                                            e.target.style.height = `${e.target.scrollHeight}px`
                                            setTabular(field.id, colKey, e.target.value)
                                          }}
                                        />
                                      ) : (
                                        <Input
                                          type="number"
                                          step="any"
                                          placeholder="—"
                                          className="h-7 text-xs w-16"
                                          value={(state.tabularValues[field.id] ?? {})[colKey] ?? ''}
                                          onChange={(e) => setTabular(field.id, colKey, e.target.value)}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                step="any"
                                placeholder="—"
                                className="h-8 text-xs w-24"
                                value={(state.tabularValues[field.id] ?? {})[col.id] ?? ''}
                                onChange={(e) => setTabular(field.id, col.id, e.target.value)}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sheet.type === 'TABULAR' && sheetColumns.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma coluna configurada nesta ficha.</p>
          )}

          {/* Campos de marcação (fichas SIMPLES) */}
          {sheet.type === 'SIMPLE' && checkFields.length > 0 && (
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

          {activeFields.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum campo ativo nesta ficha.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ──── Modal de nova/editar avaliação ─────────────────────────────────────────

const sessionMetaSchema = z.object({
  recordedAt: z.string().min(1, 'Data obrigatória'),
  notes: z.string().optional(),
})
type SessionMetaForm = z.infer<typeof sessionMetaSchema>

/** Skeleton de carregamento para grupo de fichas */
function SheetGroupSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl border animate-pulse bg-muted/40" />
      ))}
    </div>
  )
}

function SessionFormModal({
  customer,
  sessionToEdit,
  onClose,
}: {
  customer: Customer
  sessionToEdit?: MeasurementSession
  onClose: () => void
}) {
  const createSession = useCreateMeasurementSession()
  const updateSession = useUpdateMeasurementSession()
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [existingFiles, setExistingFiles] = useState<MeasurementSessionFile[]>(
    sessionToEdit?.files ?? [],
  )
  const [existingFileUrls, setExistingFileUrls] = useState<Record<string, string>>({})

  // ── Buscar fichas ─────────────────────────────────────────────────────────
  const { data: systemSheets = [], isLoading: loadingSystem } = useMeasurementSheets({ scope: 'SYSTEM' })
  const { data: customerSheetsRaw = [], isLoading: loadingCustomer } = useMeasurementSheets({
    scope: 'CUSTOMER',
    customerId: customer.id,
  })

  const activeSystemSheets = systemSheets.filter((s) => s.active).sort((a, b) => a.order - b.order)
  const activeCustomerSheets = customerSheetsRaw.filter((s) => s.active).sort((a, b) => a.order - b.order)
  const allSheets = [...activeSystemSheets, ...activeCustomerSheets]
  const hasAnySheet = activeSystemSheets.length > 0 || activeCustomerSheets.length > 0
  const loadingSheets = loadingSystem || loadingCustomer

  // ── Seleção de fichas ─────────────────────────────────────────────────────
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(() => {
    if (sessionToEdit) return new Set(sessionToEdit.sheetRecords.map((sr) => sr.sheetId))
    return new Set()
  })

  const toggleSheetSelection = (sheetId: string, checked: boolean) => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(sheetId)
      else next.delete(sheetId)
      return next
    })
  }

  // ── Estado dos formulários — inicializado a partir da sessão em edição ────
  const buildInitialState = (): FormState => {
    if (!sessionToEdit) return {}
    const result: FormState = {}
    for (const sr of sessionToEdit.sheetRecords) {
      const simpleValues: Record<string, string> = {}
      const textualValues: Record<string, string> = {}
      const tabularValues: Record<string, Record<string, string>> = {}
      const checkValues: Record<string, boolean> = {}
      for (const v of sr.values) {
        if (v.field.inputType === 'CHECK') {
          if (Number(v.value) === 1) checkValues[v.fieldId] = true
        } else if (v.field.isTextual) {
          textualValues[v.fieldId] = v.textValue ?? ''
        } else {
          simpleValues[v.fieldId] = String(Number(v.value ?? 0))
        }
      }
      for (const v of sr.tabularValues) {
        if (!tabularValues[v.fieldId]) tabularValues[v.fieldId] = {}
        const colKey = v.subColumn ? `${v.sheetColumnId}::${v.subColumn}` : v.sheetColumnId
        tabularValues[v.fieldId][colKey] = v.sheetColumn.isTextual
          ? (v.textValue ?? '')
          : String(Number(v.value ?? 0))
      }
      result[sr.sheetId] = { simpleValues, textualValues, tabularValues, checkValues }
    }
    return result
  }

  const [formState, setFormState] = useState<FormState>(buildInitialState)

  // Cleanup object URLs
  useEffect(() => {
    return () => { pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega URLs das fotos já salvas
  useEffect(() => {
    if (existingFiles.length === 0) return
    let cancelled = false
    Promise.all(
      existingFiles.map(async (f) => {
        const { url } = await getUploadUrl(f.id)
        return [f.id, url] as [string, string]
      }),
    ).then((entries) => {
      if (!cancelled) setExistingFileUrls(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { register, handleSubmit, formState: { errors, isDirty: metaDirty } } = useForm<SessionMetaForm>({
    resolver: zodResolver(sessionMetaSchema),
    defaultValues: {
      recordedAt: sessionToEdit ? sessionToEdit.recordedAt.slice(0, 10) : localDateStr(),
      notes: sessionToEdit?.notes ?? '',
    },
  })

  const hasUnsaved = metaDirty || selectedSheetIds.size > 0 || pendingFiles.length > 0

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
    if (selectedSheetIds.size === 0) {
      toast.error('Selecione ao menos uma ficha.')
      return
    }

    const withoutCategory = pendingFiles.filter((f) => !f.category)
    if (withoutCategory.length > 0) {
      toast.error('Selecione a categoria de todos os arquivos antes de salvar.')
      return
    }

    setUploading(true)
    try {
      const newFileIds = await doUploadFiles()
      const fileIds = [...existingFiles.map((f) => f.id), ...newFileIds]

      const sheetRecords = [...selectedSheetIds]
        .map((sheetId) => {
          const state = formState[sheetId]
          if (!state) return null
          const sheetDef = allSheets.find((s: MeasurementSheet) => s.id === sheetId)
          const values = [
            ...Object.entries(state.simpleValues)
              .filter(([, v]) => v !== '' && !isNaN(Number(v)))
              .map(([fieldId, value]) => ({ fieldId, value: Number(value) })),
            ...Object.entries(state.textualValues ?? {})
              .filter(([, v]) => v !== '')
              .map(([fieldId, textValue]) => ({ fieldId, textValue })),
            ...Object.entries(state.checkValues ?? {})
              .filter(([, checked]) => checked)
              .map(([fieldId]) => ({ fieldId, value: 1 })),
          ]
          const tabularValues = Object.entries(state.tabularValues).flatMap(([fieldId, cols]) =>
            Object.entries(cols)
              .filter(([, v]) => v !== '' && v !== '0')
              .map(([colKey, rawVal]) => {
                const [columnId, subColumn = ''] = colKey.split('::')
                const colDef = sheetDef?.columns.find((c: MeasurementSheetColumn) => c.id === columnId)
                if (colDef?.isTextual) {
                  return { fieldId, columnId, subColumn, textValue: rawVal }
                }
                if (!isNaN(Number(rawVal))) {
                  return { fieldId, columnId, subColumn, value: Number(rawVal) }
                }
                return null
              })
              .filter(Boolean) as Array<{ fieldId: string; columnId: string; subColumn: string; value?: number; textValue?: string }>,
          )
          if (values.length === 0 && tabularValues.length === 0) return null
          return { sheetId, values, tabularValues }
        })
        .filter(Boolean) as Array<{
          sheetId: string
          values: Array<{ fieldId: string; value?: number; textValue?: string }>
          tabularValues: Array<{ fieldId: string; columnId: string; subColumn: string; value?: number; textValue?: string }>
        }>

      if (sheetRecords.length === 0) {
        toast.error('Preencha ao menos um valor nas fichas selecionadas.')
        setUploading(false)
        return
      }

      if (sessionToEdit) {
        await updateSession.mutateAsync({
          id: sessionToEdit.id,
          customerId: customer.id,
          recordedAt: meta.recordedAt,
          notes: meta.notes || undefined,
          sheetRecords,
          fileIds,
        })
        toast.success('Avaliação atualizada com sucesso')
      } else {
        await createSession.mutateAsync({
          customerId: customer.id,
          recordedAt: meta.recordedAt,
          notes: meta.notes || undefined,
          sheetRecords,
          fileIds,
        })
        toast.success('Avaliação registrada com sucesso')
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'EMPTY_SESSION') {
        toast.error('Preencha ao menos um valor antes de salvar.')
      } else {
        toast.error('Erro ao salvar avaliação')
      }
    } finally {
      setUploading(false)
    }
  })

  const isPending = uploading || createSession.isPending || updateSession.isPending
  const title = sessionToEdit ? 'Editar avaliação' : 'Nova avaliação'

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
            <Input id="session-date" type="date" max={localDateStr()} {...register('recordedAt')} />
            {errors.recordedAt && <p className="text-xs text-destructive">{errors.recordedAt.message}</p>}
          </div>

          {/* Empty state — sem fichas ativas */}
          {!loadingSheets && !hasAnySheet && (
            <div className="rounded-lg border bg-card py-8 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">
                Nenhuma ficha ativa. Configure fichas em{' '}
                <span className="font-medium">Configurações &gt; Fichas de Avaliação</span>.
              </p>
            </div>
          )}

          {/* Fichas da Clínica */}
          {(loadingSystem || activeSystemSheets.length > 0) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fichas da Clínica
              </p>
              {loadingSystem ? (
                <SheetGroupSkeleton />
              ) : (
                activeSystemSheets.map((sheet, index) => (
                  <SheetFormSection
                    key={sheet.id}
                    sheet={sheet}
                    state={formState[sheet.id] ?? { simpleValues: {}, tabularValues: {}, checkValues: {}, textualValues: {} }}
                    onStateChange={(updater) =>
                      setFormState((prev) => {
                        const current = prev[sheet.id] ?? { simpleValues: {}, tabularValues: {}, checkValues: {}, textualValues: {} }
                        const next = typeof updater === 'function' ? updater(current) : updater
                        return { ...prev, [sheet.id]: next }
                      })
                    }
                    defaultOpen={index === 0 && selectedSheetIds.size === 0}
                    selectable
                    selected={selectedSheetIds.has(sheet.id)}
                    onSelectionChange={(checked) => toggleSheetSelection(sheet.id, checked)}
                  />
                ))
              )}
            </div>
          )}

          {/* Fichas deste Cliente */}
          {(loadingCustomer || activeCustomerSheets.length > 0) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fichas deste Cliente
              </p>
              {loadingCustomer ? (
                <SheetGroupSkeleton />
              ) : (
                activeCustomerSheets.map((sheet) => (
                  <SheetFormSection
                    key={sheet.id}
                    sheet={sheet}
                    state={formState[sheet.id] ?? { simpleValues: {}, tabularValues: {}, checkValues: {}, textualValues: {} }}
                    onStateChange={(updater) =>
                      setFormState((prev) => {
                        const current = prev[sheet.id] ?? { simpleValues: {}, tabularValues: {}, checkValues: {}, textualValues: {} }
                        const next = typeof updater === 'function' ? updater(current) : updater
                        return { ...prev, [sheet.id]: next }
                      })
                    }
                    defaultOpen={false}
                    selectable
                    selected={selectedSheetIds.has(sheet.id)}
                    onSelectionChange={(checked) => toggleSheetSelection(sheet.id, checked)}
                  />
                ))
              )}
            </div>
          )}

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
            {existingFiles.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-muted-foreground">Fotos salvas</p>
                {existingFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg border p-2 bg-muted/20">
                    {existingFileUrls[f.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={existingFileUrls[f.id]} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{FILE_CATEGORY_LABELS[f.category as FileCategory] ?? f.category}</p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => setExistingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      aria-label="Remover foto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <UploadArea files={pendingFiles} onChange={setPendingFiles} consentAt={customer.bodyDataConsentAt} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2 rounded-b-xl">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || selectedSheetIds.size === 0}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {sessionToEdit ? 'Salvar alterações' : 'Salvar avaliação'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}


// ──── Modal de comparação ──────────────────────────────────────────────────────

function CompareModal({
  current,
  allSessions,
  sheets,
  onClose,
}: {
  current: MeasurementSession
  allSessions: MeasurementSession[]
  sheets: MeasurementSheet[]
  onClose: () => void
}) {
  // Para cada ficha do registro atual, busca o último registro ANTERIOR que contém essa ficha
  const currentIdx = allSessions.findIndex((s) => s.id === current.id)
  const prevSessionBySheetId = new Map<string, MeasurementSession>()
  if (currentIdx >= 0) {
    const olderSessions = allSessions.slice(currentIdx + 1)
    for (const sr of current.sheetRecords) {
      const prev = olderSessions.find((s) => s.sheetRecords.some((r) => r.sheetId === sr.sheetId))
      if (prev) prevSessionBySheetId.set(sr.sheetId, prev)
    }
  }
  // Apenas fichas que têm um registro anterior (independente da sessão)
  const comparableSheetIds = current.sheetRecords
    .filter((sr) => prevSessionBySheetId.has(sr.sheetId))
    .map((sr) => sr.sheetId)

  const hasAnyData = comparableSheetIds.length > 0

  const renderCompareRow = (
    prevVal: number | null,
    currVal: number | null,
    label: string,
    unit: string,
    keyStr: string,
    dashed = false,
  ) => {
    const trend: 'up' | 'down' | 'same' =
      prevVal !== null && currVal !== null
        ? currVal > prevVal ? 'up' : currVal < prevVal ? 'down' : 'same'
        : 'same'
    const currClass =
      trend === 'up' ? 'text-green-600 dark:text-green-400' :
      trend === 'down' ? 'text-red-600 dark:text-red-400' : ''

    return (
      <div key={keyStr} className={`grid grid-cols-[1fr_120px_1fr] items-center gap-2 rounded-lg border px-3 py-2 ${dashed ? 'bg-muted/20 border-dashed' : 'bg-muted/10'}`}>
        <div className="text-right">
          {prevVal !== null ? (
            <span className="text-sm font-medium">{prevVal.toLocaleString('pt-BR')}{unit && ` ${unit}`}</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {trend === 'up' && <span className="text-xs font-semibold text-green-600 dark:text-green-400">↑</span>}
          {trend === 'down' && <span className="text-xs font-semibold text-red-600 dark:text-red-400">↓</span>}
          {trend === 'same' && prevVal !== null && currVal !== null && <span className="text-xs text-muted-foreground">—</span>}
        </div>
        <div className="text-left">
          {currVal !== null ? (
            <span className={`text-sm font-medium ${currClass}`}>{currVal.toLocaleString('pt-BR')}{unit && ` ${unit}`}</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </div>
    )
  }

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
        {/* Cabeçalho — apenas data atual (anterior varia por ficha) */}
        <div className="rounded-lg bg-muted/30 px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Registro atual</p>
          <p className="text-sm font-medium mt-0.5">{formatDate(current.recordedAt)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Comparado com o último registro de cada ficha</p>
        </div>

        {!hasAnyData ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Nenhuma ficha possui registro anterior para comparar.
          </p>
        ) : (
          <div className="space-y-6">
            {comparableSheetIds.map((sheetId) => {
              const previous = prevSessionBySheetId.get(sheetId)!
              const sheetDef = sheets.find((s) => s.id === sheetId)
              const currSR = current.sheetRecords.find((sr) => sr.sheetId === sheetId)
              const prevSR = previous.sheetRecords.find((sr) => sr.sheetId === sheetId)
              const sheetName = sheetDef?.name ?? currSR?.sheet.name ?? prevSR?.sheet.name ?? sheetId
              const isTabular =
                sheetDef?.type === 'TABULAR' ||
                (currSR?.tabularValues.length ?? 0) > 0 ||
                (prevSR?.tabularValues.length ?? 0) > 0

              if (isTabular) {
                // Colunas e campos da definição; fallback: extrair dos valores gravados
                const allTabVals = [...(currSR?.tabularValues ?? []), ...(prevSR?.tabularValues ?? [])]
                type _TabCol = { id: string; name: string; unit: string; order: number; isTextual?: boolean }
                type _TabField = { id: string; name: string; subColumns?: string[] }
                const colFallbackMap = new Map<string, _TabCol>()
                const fieldFallbackMap = new Map<string, _TabField>()
                for (const tv of allTabVals) {
                  colFallbackMap.set(tv.sheetColumnId, tv.sheetColumn)
                  fieldFallbackMap.set(tv.fieldId, tv.field)
                }
                const columns = sheetDef
                  ? [...sheetDef.columns].sort((a, b) => a.order - b.order)
                  : [...colFallbackMap.values()].sort((a, b) => a.order - b.order)
                const fields = sheetDef
                  ? sheetDef.fields.filter((f) => f.active).sort((a, b) => a.order - b.order)
                  : [...fieldFallbackMap.values()]

                type _TabCellVal = { num: number | null; text: string | null }
                const prevMap = (prevSR?.tabularValues ?? []).reduce<Record<string, Record<string, _TabCellVal>>>
                  ((acc, v) => {
                    if (!acc[v.fieldId]) acc[v.fieldId] = {}
                    const key = v.subColumn ? `${v.sheetColumnId}::${v.subColumn}` : v.sheetColumnId
                    acc[v.fieldId][key] = { num: v.value !== null ? Number(v.value) : null, text: v.textValue ?? null }
                    return acc
                  }, {})
                const currMap = (currSR?.tabularValues ?? []).reduce<Record<string, Record<string, _TabCellVal>>>
                  ((acc, v) => {
                    if (!acc[v.fieldId]) acc[v.fieldId] = {}
                    const key = v.subColumn ? `${v.sheetColumnId}::${v.subColumn}` : v.sheetColumnId
                    acc[v.fieldId][key] = { num: v.value !== null ? Number(v.value) : null, text: v.textValue ?? null }
                    return acc
                  }, {})

                if (columns.length === 0 || fields.length === 0) return null

                // Renderiza uma tabela para um dataMap (anterior ou atual)
                type _CellMap = Record<string, Record<string, _TabCellVal>>
                const renderTabularTable = (dataMap: _CellMap, compareMap: _CellMap | null) => (
                  <div className="overflow-x-auto rounded-b-lg border border-t-0">
                    <table className="text-xs w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="border-b px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Campo</th>
                          {columns.map((col) => (
                            <th key={col.id} className="border-b px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {col.name}{col.unit ? ` (${col.unit})` : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr key={field.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{field.name}</td>
                            {columns.map((col) => {
                              const colDef = sheetDef?.columns.find((c) => c.id === col.id) ?? col
                              const isTextualCol = (colDef as { isTextual?: boolean }).isTextual ?? false
                              const isCheck = (colDef as { inputType?: string }).inputType === 'CHECK'
                              const subCols = (field as { subColumns?: string[] }).subColumns ?? []
                              if (subCols.length) {
                                return (
                                  <td key={col.id} className="px-3 py-2">
                                    <div className="flex gap-2 flex-wrap">
                                      {subCols.map((sub) => {
                                        const key = `${col.id}::${sub}`
                                        const cell = dataMap[field.id]?.[key]
                                        const cmpCell = compareMap?.[field.id]?.[key]
                                        const trend = !isTextualCol && !isCheck && compareMap && cell?.num !== null && cmpCell?.num !== null && cell?.num !== undefined && cmpCell?.num !== undefined
                                          ? (cell.num > cmpCell.num ? 'up' : cell.num < cmpCell.num ? 'down' : 'same')
                                          : 'same'
                                        const cls = trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : ''
                                        return (
                                          <span key={sub} className="whitespace-nowrap">
                                            <span className="text-[10px] text-muted-foreground">{sub}=</span>
                                            {isCheck
                                              ? (cell?.num === 1
                                                ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
                                                : <span className="text-muted-foreground">—</span>)
                                              : <span className={`font-semibold ${cls}`}>
                                                  {isTextualCol ? (cell?.text ?? '—') : (cell?.num !== null && cell?.num !== undefined ? cell.num.toLocaleString('pt-BR') : '—')}
                                                </span>
                                            }
                                            {trend === 'up' && <span className="text-[10px] text-green-600 dark:text-green-400 ml-0.5">↑</span>}
                                            {trend === 'down' && <span className="text-[10px] text-red-600 dark:text-red-400 ml-0.5">↓</span>}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </td>
                                )
                              }
                              const cell = dataMap[field.id]?.[col.id]
                              const cmpCell = compareMap?.[field.id]?.[col.id]
                              if (isTextualCol) {
                                return (
                                  <td key={col.id} className="px-3 py-2 text-sm">
                                    <span className="whitespace-pre-wrap break-words">{cell?.text ?? '—'}</span>
                                  </td>
                                )
                              }
                              if (isCheck) {
                                return (
                                  <td key={col.id} className="px-3 py-2">
                                    {cell?.num === 1
                                      ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
                                      : <span className="text-muted-foreground">—</span>
                                    }
                                  </td>
                                )
                              }
                              const trend = compareMap && cell?.num !== null && cmpCell?.num !== null && cell?.num !== undefined && cmpCell?.num !== undefined
                                ? (cell.num > cmpCell.num ? 'up' : cell.num < cmpCell.num ? 'down' : 'same')
                                : 'same'
                              const cls = trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : ''
                              return (
                                <td key={col.id} className="px-3 py-2">
                                  <span className={`font-semibold ${cls}`}>
                                    {cell?.num !== null && cell?.num !== undefined ? cell.num.toLocaleString('pt-BR') : '—'}
                                  </span>
                                  {trend === 'up' && <span className="text-green-600 dark:text-green-400 ml-0.5 text-[11px]">↑</span>}
                                  {trend === 'down' && <span className="text-red-600 dark:text-red-400 ml-0.5 text-[11px]">↓</span>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )

                return (
                  <div key={sheetId} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sheetName}</p>
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Tabular</span>
                    </div>

                    {/* Anterior */}
                    <div>
                      <div className="rounded-t-lg bg-muted/30 px-3 py-1.5 flex items-center gap-2 border border-b-0">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Anterior</span>
                        <span className="text-xs font-medium">{formatDate(previous.recordedAt)}</span>
                      </div>
                      {renderTabularTable(prevMap, null)}
                    </div>

                    {/* Atual */}
                    <div>
                      <div className="rounded-t-lg bg-primary/5 border border-primary/20 border-b-0 px-3 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-primary/70">Atual</span>
                        <span className="text-xs font-medium">{formatDate(current.recordedAt)}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">↑ maior ↓ menor que anterior</span>
                      </div>
                      {renderTabularTable(currMap, prevMap)}
                    </div>
                  </div>
                )
              } else {
                // Ficha SIMPLES
                type _SimpleEntry = { name: string; unit: string; value: number; isTextual?: boolean; text?: string }
                const prevSimpleMap = new Map<string, _SimpleEntry>()
                const currSimpleMap = new Map<string, _SimpleEntry>()
                for (const v of prevSR?.values ?? []) {
                  if (v.field.inputType !== 'INPUT') continue
                  if (v.field.isTextual) {
                    prevSimpleMap.set(v.fieldId, { name: v.field.name, unit: '', value: 0, isTextual: true, text: v.textValue ?? undefined })
                  } else {
                    prevSimpleMap.set(v.fieldId, { name: v.field.name, unit: v.field.unit ?? '', value: Number(v.value) })
                  }
                }
                for (const v of currSR?.values ?? []) {
                  if (v.field.inputType !== 'INPUT') continue
                  if (v.field.isTextual) {
                    currSimpleMap.set(v.fieldId, { name: v.field.name, unit: '', value: 0, isTextual: true, text: v.textValue ?? undefined })
                  } else {
                    currSimpleMap.set(v.fieldId, { name: v.field.name, unit: v.field.unit ?? '', value: Number(v.value) })
                  }
                }
                const fieldIds = [...new Set([...prevSimpleMap.keys(), ...currSimpleMap.keys()])]
                if (fieldIds.length === 0) return null

                const prevBMI = (() => {
                  const w = [...prevSimpleMap.values()].find((v) => v.name.toLowerCase().includes('peso'))
                  const h = [...prevSimpleMap.values()].find((v) => v.name.toLowerCase().includes('altura'))
                  return w && h ? calcBMI(w.value, h.value) : null
                })()
                const currBMI = (() => {
                  const w = [...currSimpleMap.values()].find((v) => v.name.toLowerCase().includes('peso'))
                  const h = [...currSimpleMap.values()].find((v) => v.name.toLowerCase().includes('altura'))
                  return w && h ? calcBMI(w.value, h.value) : null
                })()

                return (
                  <div key={sheetId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sheetName}</p>
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">Simples</span>
                    </div>
                    {/* Cabeçalho de datas por ficha */}
                    <div className="grid grid-cols-[1fr_120px_1fr] gap-2 mb-1">
                      <div className="text-center text-[10px] text-muted-foreground">{formatDate(previous.recordedAt)}</div>
                      <div />
                      <div className="text-center text-[10px] text-muted-foreground font-medium">{formatDate(current.recordedAt)}</div>
                    </div>
                    {fieldIds.map((fieldId) => {
                      const meta = currSimpleMap.get(fieldId) ?? prevSimpleMap.get(fieldId) ?? { name: fieldId, unit: '', value: 0 }
                      if (meta.isTextual) {
                        const prevText = prevSimpleMap.get(fieldId)?.text ?? null
                        const currText = currSimpleMap.get(fieldId)?.text ?? null
                        return (
                          <div key={`${sheetId}::${fieldId}`} className="grid grid-cols-[1fr_120px_1fr] items-center gap-2 rounded-lg border px-3 py-2 bg-muted/10">
                            <div className="text-right text-sm text-muted-foreground">{prevText ?? '—'}</div>
                            <div className="text-center text-xs text-muted-foreground truncate">{meta.name}</div>
                            <div className="text-left text-sm font-medium">{currText ?? '—'}</div>
                          </div>
                        )
                      }
                      const prevVal = prevSimpleMap.get(fieldId)?.value ?? null
                      const currVal = currSimpleMap.get(fieldId)?.value ?? null
                      return renderCompareRow(prevVal, currVal, meta.name, meta.unit, `${sheetId}::${fieldId}`)
                    })}
                    {(prevBMI !== null || currBMI !== null) && renderCompareRow(
                      prevBMI !== null ? Number(prevBMI) : null,
                      currBMI !== null ? Number(currBMI) : null,
                      'IMC (calculado)', 'kg/m²', `__bmi__${sheetId}`, true,
                    )}
                  </div>
                )
              }
            })}
          </div>
        )}

        {current.notes && (
          <div className="rounded-lg bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Observações (atual)</p>
            <p className="text-sm">{current.notes}</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ──── Card de sessão ───────────────────────────────────────────────────────────

function SessionCard({
  session,
  allSessions,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
  sheets,
}: {
  session: MeasurementSession
  allSessions: MeasurementSession[]
  canEdit: boolean
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  sheets: MeasurementSheet[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const currentIdx = allSessions.findIndex((s) => s.id === session.id)
  const hasAnyComparableSheet = currentIdx >= 0 && session.sheetRecords.some((sr) =>
    allSessions.slice(currentIdx + 1).some((s) => s.sheetRecords.some((r) => r.sheetId === sr.sheetId)),
  )
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [lightboxFile, setLightboxFile] = useState<string | null>(null)

  // Carrega URLs das fotos sempre que o card estiver expandido e houver arquivos sem URL
  useEffect(() => {
    if (!expanded || session.files.length === 0) return
    const unloaded = session.files.filter((f) => !fileUrls[f.id])
    if (unloaded.length === 0) return
    let cancelled = false
    setLoadingUrls(true)
    Promise.all(
      unloaded.map(async (f) => {
        const { url } = await getUploadUrl(f.id)
        return [f.id, url] as [string, string]
      }),
    )
      .then((entries) => {
        if (!cancelled) setFileUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      })
      .finally(() => {
        if (!cancelled) setLoadingUrls(false)
      })
    return () => { cancelled = true }
    // fileUrls excluído das deps intencionalmente — inclui-lo causaria re-fetch em loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.files, expanded])

  const totalSimpleValues = session.sheetRecords.reduce(
    (sum, sr) => sum + sr.values.length,
    0,
  )
  const totalTabularValues = session.sheetRecords.reduce(
    (sum, sr) => sum + sr.tabularValues.length,
    0,
  )

  // Categorias únicas presentes nesta sessão (derivadas das fichas dos registros)
  const sessionCategories = [
    ...new Set(
      session.sheetRecords.map((sr) => sr.sheet.category as MeasurementCategory),
    ),
  ]

  const handleExpand = () => {
    setExpanded((v) => !v)
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
            {/* Badges de categoria */}
            {sessionCategories.map((cat) => (
              <span
                key={cat}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE_COLOR[cat] ?? 'bg-muted text-muted-foreground'}`}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
            ))}
            {totalSimpleValues > 0 && (
              <span className="text-xs text-muted-foreground">· {totalSimpleValues} campo{totalSimpleValues !== 1 ? 's' : ''}</span>
            )}
            {totalTabularValues > 0 && (
              <span className="text-xs text-muted-foreground">· {totalTabularValues} entrada{totalTabularValues !== 1 ? 's' : ''} tabular{totalTabularValues !== 1 ? 'es' : ''}</span>
            )}
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
            const sheetDef = sheets.find((s) => s.id === sr.sheetId)
            const isTabular = sheetDef?.type === 'TABULAR' || sr.tabularValues.length > 0
            const simpleVals = sr.values.filter((v) => v.field.inputType === 'INPUT')
            const checkVals = sr.values.filter((v) => v.field.inputType === 'CHECK')

            // Para fichas TABULAR: somente linhas e colunas com ao menos um valor preenchido
            const tabularColumnsAll = isTabular && sheetDef
              ? [...sheetDef.columns].sort((a, b) => a.order - b.order)
              : isTabular
                ? [...new Map(sr.tabularValues.map((v) => [v.sheetColumnId, v.sheetColumn])).values()].sort((a, b) => a.order - b.order)
                : []
            const tabularRowsAll = isTabular && sheetDef
              ? sheetDef.fields.filter((f) => f.active).sort((a, b) => a.order - b.order)
              : isTabular
                ? [...new Map(sr.tabularValues.map((v) => [v.fieldId, v.field])).values()]
                : []
            // Mapa de valores: fieldId → "columnId" ou "columnId::subColumn" → displayValue
            const tabularMap = sr.tabularValues.reduce<Record<string, Record<string, string>>>((acc, v) => {
              if (!acc[v.fieldId]) acc[v.fieldId] = {}
              const colKey = v.subColumn ? `${v.sheetColumnId}::${v.subColumn}` : v.sheetColumnId
              acc[v.fieldId][colKey] = v.sheetColumn.isTextual
                ? (v.textValue ?? '')
                : (v.value ?? '')
              return acc
            }, {})

            // Filtra: só mostra linhas e colunas que têm pelo menos um valor preenchido
            const hasVal = (fieldId: string, colId: string, subCols?: string[]) => {
              if (subCols?.length) return subCols.some((s) => tabularMap[fieldId]?.[`${colId}::${s}`] !== undefined)
              return tabularMap[fieldId]?.[colId] !== undefined
            }
            const tabularRows = tabularRowsAll.filter((f) =>
              tabularColumnsAll.some((c) => hasVal(f.id, c.id, (f as { subColumns?: string[] }).subColumns ?? []))
            )
            const tabularColumns = tabularColumnsAll.filter((c) =>
              tabularRowsAll.some((f) => hasVal(f.id, c.id, (f as { subColumns?: string[] }).subColumns ?? []))
            )

            return (
              <div key={sr.id} className="pt-3">
                {/* Cabeçalho da ficha com badge de tipo */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sr.sheet.name}</p>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${isTabular ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                    {isTabular ? 'Tabular' : 'Simples'}
                  </span>
                </div>

                {/* Ficha SIMPLES: grade de cards campo/valor */}
                {!isTabular && simpleVals.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {simpleVals.map((v) => (
                      <div key={v.id} className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-xs text-muted-foreground">{v.field.name}</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {v.field.isTextual
                            ? (v.textValue || '—')
                            : (
                              <>
                                {Number(v.value).toLocaleString('pt-BR')}
                                {v.field.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{v.field.unit}</span>}
                              </>
                            )
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ficha TABULAR: grade linha (campo) × coluna — tabela completa mesmo sem respostas */}
                {isTabular && tabularColumns.length > 0 && tabularRows.length > 0 && (
                  <div className="overflow-x-auto mb-3 rounded-lg border">
                    <table className="text-xs w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="border-b px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Campo</th>
                          {tabularColumns.map((col) => (
                            <th key={col.id} className="border-b px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {col.name}{col.unit ? ` (${col.unit})` : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tabularRows.map((field) => (
                          <tr key={field.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{field.name}</td>
                            {tabularColumns.map((col) => {
                              const colDef = sheetDef?.columns.find((c) => c.id === col.id) ?? col
                              const isCheck = (colDef as { inputType?: string }).inputType === 'CHECK'
                              const isTextualCol = (colDef as { isTextual?: boolean }).isTextual ?? false
                              const hasSubCols = (field as { subColumns?: string[] }).subColumns?.length
                              return (
                                <td key={col.id} className="px-3 py-2 text-sm">
                                  {hasSubCols ? (
                                    <div className="flex gap-2">
                                      {(field as { subColumns: string[] }).subColumns.map((sub) => {
                                        const subKey = `${col.id}::${sub}`
                                        const subVal = tabularMap[field.id]?.[subKey]
                                        return (
                                          <span key={sub} className="whitespace-nowrap">
                                            <span className="text-[10px] text-muted-foreground">{sub}=</span>
                                            {isCheck
                                              ? (subVal === '1'
                                                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                                                : <span className="text-muted-foreground">—</span>)
                                              : <span className="font-semibold">
                                                  {isTextualCol
                                                    ? (subVal || '—')
                                                    : subVal !== undefined ? Number(subVal).toLocaleString('pt-BR') : '—'
                                                  }
                                                </span>
                                            }
                                          </span>
                                        )
                                      })}
                                    </div>
                                  ) : isCheck ? (
                                    tabularMap[field.id]?.[col.id] === '1'
                                      ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                                      : <span className="text-muted-foreground">—</span>
                                  ) : isTextualCol ? (
                                    tabularMap[field.id]?.[col.id]
                                      ? <span className="font-semibold">{tabularMap[field.id][col.id]}</span>
                                      : <span className="text-muted-foreground">—</span>
                                  ) : (
                                    tabularMap[field.id]?.[col.id] !== undefined
                                      ? <><span className="font-semibold">{Number(tabularMap[field.id][col.id]).toLocaleString('pt-BR')}</span>{col.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{col.unit}</span>}</>
                                      : <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* M-04: Campos CHECK (fichas SIMPLES) */}
                {!isTabular && checkVals.length > 0 && (
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
              {hasAnyComparableSheet && (
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

      {compareOpen && hasAnyComparableSheet && (
        <CompareModal current={session} allSessions={allSessions} sheets={sheets} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  )
}

// ──── EvolutionTab (principal) ─────────────────────────────────────────────────

export function EvolutionTab({ customer }: { customer: Customer }) {
  const role = useRole()
  const isAdmin = role === 'admin'
  const isStaff = role === 'staff'
  const isProfessional = role === 'professional'
  const currentUserId = getCurrentUserId()

  const { data: sessionsPage, isLoading: loadingSessions, error, refetch } = useMeasurementSessions(
    customer.id,
    { limit: 50 },
  )
  const deleteSession = useDeleteMeasurementSession()

  // Fichas CUSTOMER deste cliente — para checar o limite de 10
  const { data: customerSheets = [] } = useMeasurementSheets({
    scope: 'CUSTOMER',
    customerId: customer.id,
  })
  const isAtCustomLimit = customerSheets.filter((s) => s.active).length >= 10

  // Agendamentos confirmados com este cliente — para autorizar profissional criar ficha personalizada
  const { data: confirmedAppts } = useAppointments({
    customerId: customer.id,
    status: 'confirmed,in_progress,completed',
    limit: '1',
  })
  const hasConfirmedAppointment = (confirmedAppts?.total ?? 0) > 0 || (confirmedAppts?.items.length ?? 0) > 0
  const isProfessionalWithoutAppointment = isProfessional && !hasConfirmedAppointment

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<MeasurementSession | undefined>()
  const [customSheetOpen, setCustomSheetOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<MeasurementCategory | 'all'>('all')

  const sessions = sessionsPage?.items ?? []
  const isLoading = loadingSessions

  const filteredSessions = categoryFilter === 'all'
    ? sessions
    : sessions.filter((s) =>
        s.sheetRecords.some((sr) => sr.sheet.category === categoryFilter),
      )

  const handleDelete = async (session: MeasurementSession) => {
    try {
      await deleteSession.mutateAsync({ id: session.id, customerId: customer.id })
      toast.success('Avaliação excluída com sucesso')
    } catch {
      toast.error('Erro ao excluir avaliação')
    }
  }

  if (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para visualizar as avaliações deste cliente.
          </p>
        </div>
      )
    }
    return (
      <div className="py-6 text-center text-sm text-muted-foreground space-y-3">
        <p>Erro ao carregar avaliações.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header com botões */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {/* Botão nova avaliação */}
          <Button
            size="sm"
            onClick={() => { setEditingSession(undefined); setModalOpen(true) }}
            disabled={isLoading}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nova avaliação
          </Button>

          {/* Botão nova ficha deste cliente */}
          <Button
            variant="outline"
            size="sm"
            disabled={isProfessionalWithoutAppointment || isAtCustomLimit}
            title={
              isProfessionalWithoutAppointment
                ? 'Você não tem agendamento confirmado com este cliente'
                : isAtCustomLimit
                ? 'Limite de 10 fichas personalizadas atingido'
                : undefined
            }
            onClick={() => setCustomSheetOpen(true)}
          >
            Nova ficha deste cliente
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma avaliação registrada.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { setEditingSession(undefined); setModalOpen(true) }}
          >
            Nova avaliação
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pills de filtro por categoria */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...MEASUREMENT_CATEGORIES_ORDER] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  categoryFilter === cat
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent',
                ].join(' ')}
              >
                {cat === 'all' ? 'Todas' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Lista de sessões filtradas */}
          {filteredSessions.length === 0 ? (
            <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
              <p className="text-sm">Nenhuma avaliação nesta categoria.</p>
              <button
                type="button"
                className="mt-2 text-xs text-primary underline"
                onClick={() => setCategoryFilter('all')}
              >
                Ver todas
              </button>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const canEdit = isAdmin || isStaff || session.createdById === currentUserId
              return (
                <SessionCard
                  key={session.id}
                  session={session}
                  allSessions={sessions}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  onEdit={() => { setEditingSession(session); setModalOpen(true) }}
                  onDelete={() => void handleDelete(session)}
                  sheets={[]}
                />
              )
            })
          )}

          {sessions.length >= 50 && (
            <p className="text-center text-xs text-muted-foreground pt-1">
              Exibindo os 50 registros mais recentes.
            </p>
          )}
        </div>
      )}

      {/* Modal de nova/editar avaliação */}
      {modalOpen && (
        <SessionFormModal
          customer={customer}
          sessionToEdit={editingSession}
          onClose={() => { setModalOpen(false); setEditingSession(undefined) }}
        />
      )}

      {/* Modal de nova ficha personalizada */}
      {customSheetOpen && (
        <NewCustomerSheetModal
          customerId={customer.id}
          onClose={() => setCustomSheetOpen(false)}
        />
      )}
    </div>
  )
}

