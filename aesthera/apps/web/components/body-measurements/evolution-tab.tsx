'use client'

import { useRef, useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  ImageIcon,
  AlertCircle,
  BarChart2,
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
import {
  useBodyMeasurementFields,
  useBodyMeasurementRecords,
  useCreateBodyMeasurementRecord,
  useDeleteBodyMeasurementRecord,
  presignUpload,
  confirmUpload,
  getUploadUrl,
  FILE_CATEGORY_LABELS,
  type BodyMeasurementRecord,
  type BodyMeasurementField,
  type FileCategory,
} from '@/lib/hooks/use-body-measurements'
import { useRole } from '@/lib/hooks/use-role'

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

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    addFiles(selected)
    e.target.value = ''
  }

  const addFiles = (selected: File[]) => {
    const valid = selected.filter(
      (f) => ALLOWED_MIME.includes(f.type) && f.size <= MAX_SIZE,
    )
    const remaining = MAX_FILES - files.length
    const toAdd: PendingFile[] = valid.slice(0, remaining).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      category: '',
      progress: 0,
    }))
    onChange([...files, ...toAdd])
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
            Consentimento LGPD não fornecido
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
            Este cliente ainda não forneceu consentimento para registro de dados corporais. O
            upload de fotos está desabilitado. Para registrar o consentimento, acesse o perfil
            do cliente.
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
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg border p-2 bg-muted/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pf.preview}
                alt=""
                className="h-12 w-12 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-medium truncate">{pf.file.name}</p>
                <Select
                  value={pf.category}
                  onValueChange={(v) => setCategory(idx, v as FileCategory)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Selecionar categoria *" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FILE_CATEGORY_LABELS) as FileCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {FILE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pf.progress > 0 && pf.progress < 100 && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pf.progress}%` }}
                    />
                  </div>
                )}
                {pf.error && (
                  <p className="text-xs text-destructive">{pf.error}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──── Record card ──────────────────────────────────────────────────────────────

function RecordCard({
  record,
  isAdmin,
  onDelete,
}: {
  record: BodyMeasurementRecord
  isAdmin: boolean
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [lightboxFile, setLightboxFile] = useState<string | null>(null)

  const loadFileUrls = async () => {
    if (record.files.length === 0) return
    setLoadingUrls(true)
    try {
      const urls: Record<string, string> = {}
      await Promise.all(
        record.files.map(async (f) => {
          const { url } = await getUploadUrl(f.id)
          urls[f.id] = url
        }),
      )
      setFileUrls(urls)
    } finally {
      setLoadingUrls(false)
    }
  }

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && record.files.length > 0 && Object.keys(fileUrls).length === 0) {
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
          <p className="text-sm font-medium">{formatDate(record.recordedAt)}</p>
          <p className="text-xs text-muted-foreground">
            {record.values.length} medidas · {record.files.length} foto
            {record.files.length !== 1 ? 's' : ''}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Values grid */}
          {record.values.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
              {record.values.map((v) => (
                <div key={v.id} className="rounded-lg bg-muted/30 p-2.5">
                  <p className="text-xs text-muted-foreground">{v.field.name}</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {Number(v.value).toLocaleString('pt-BR')} {v.field.unit}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="rounded-lg bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{record.notes}</p>
            </div>
          )}

          {/* Photos */}
          {record.files.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Fotos</p>
              {loadingUrls ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {record.files.map((f) => (
                    <div key={f.id} className="relative group">
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
                        {FILE_CATEGORY_LABELS[f.category]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {isAdmin && (
            <div className="flex justify-end pt-1">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs text-destructive">
                    Esta ação é irreversível. Deseja excluir este registro?
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onDelete}
                  >
                    Excluir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Excluir registro
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <Dialog open onClose={() => setLightboxFile(null)} className="p-0 bg-transparent border-0 shadow-none max-w-5xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxFile}
            alt="Foto ampliada"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <button
            type="button"
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/40 rounded-full p-1"
            aria-label="Fechar imagem"
            onClick={() => setLightboxFile(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </Dialog>
      )}
    </div>
  )
}

// ──── New record modal ─────────────────────────────────────────────────────────

const recordSchema = z.object({
  recordedAt: z.string().min(1, 'Data obrigatória'),
  notes: z.string().optional(),
})
type RecordForm = z.infer<typeof recordSchema>

function NewRecordModal({
  customer,
  fields,
  onClose,
}: {
  customer: Customer
  fields: BodyMeasurementField[]
  onClose: () => void
}) {
  const createRecord = useCreateBodyMeasurementRecord()
  const [values, setValues] = useState<Record<string, string>>({})
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)

  // Cleanup object URLs quando o modal fecha — evita memory leak
  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { register, handleSubmit, formState: { errors, isDirty: formDirty } } = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      recordedAt: new Date().toISOString().slice(0, 10),
    },
  })

  const hasUnsavedData =
    formDirty ||
    Object.values(values).some((v) => v !== '') ||
    pendingFiles.length > 0

  // IMC calculation (weight/height fields — não persiste no banco)
  const activeFields = fields.filter((f) => f.active)
  const weightField = activeFields.find((f) =>
    f.name.toLowerCase().includes('peso'),
  )
  const heightField = activeFields.find((f) =>
    f.name.toLowerCase().includes('altura'),
  )
  const weightVal = weightField ? Number(values[weightField.id]) : 0
  const heightVal = heightField ? Number(values[heightField.id]) : 0
  const bmi = calcBMI(weightVal, heightVal)

  const handleValueChange = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }))
  }

  const doUploadFiles = async (): Promise<string[]> => {
    const confirmedIds: string[] = []
    const updated = [...pendingFiles]

    for (let i = 0; i < updated.length; i++) {
      const pf = updated[i]
      if (!pf.category) continue // skip sem categoria
      try {
        // 1. Presign
        const { presignedUrl, storageKey } = await presignUpload({
          fileName: pf.file.name,
          mimeType: pf.file.type,
          size: pf.file.size,
          customerId: customer.id,
          category: pf.category as FileCategory,
        })

        // 2. PUT direto ao R2
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

        // 3. Confirm
        const confirmed = await confirmUpload({
          storageKey,
          customerId: customer.id,
          name: pf.file.name,
          mimeType: pf.file.type,
          size: pf.file.size,
          category: pf.category as FileCategory,
        })

        updated[i] = { ...updated[i], progress: 100, confirmedId: confirmed.id }
        setPendingFiles([...updated])
        confirmedIds.push(confirmed.id)
      } catch (err: any) {
        const isInvalid = err?.response?.data?.code === 'MIME_TYPE_MISMATCH'
        updated[i] = {
          ...updated[i],
          error: isInvalid
            ? 'Arquivo inválido. Apenas imagens JPEG, PNG ou WebP são aceitos.'
            : 'Erro no upload. Tente novamente.',
        }
        setPendingFiles([...updated])
        // Arquivo com erro não bloqueia o submit
      }
    }

    return confirmedIds
  }

  const onSubmit = handleSubmit(async (data) => {
    // P-06: validar que todos os arquivos têm categoria antes de prosseguir
    const withoutCategory = pendingFiles.filter((f) => !f.category)
    if (withoutCategory.length > 0) {
      toast.error('Selecione a categoria de todos os arquivos antes de salvar.')
      return
    }

    setUploading(true)
    try {
      const fileIds = await doUploadFiles()

      const rawValues = Object.entries(values)
        .filter(([, v]) => v !== '' && !isNaN(Number(v)))
        .map(([fieldId, value]) => ({ fieldId, value: Number(value) }))

      await createRecord.mutateAsync({
        customerId: customer.id,
        recordedAt: data.recordedAt,
        notes: data.notes || undefined,
        values: rawValues,
        fileIds,
      })

      toast.success('Registro salvo com sucesso')
      onClose()
    } catch {
      toast.error('Erro ao salvar registro')
    } finally {
      setUploading(false)
    }
  })

  const isPending = uploading || createRecord.isPending

  return (
    <Dialog open onClose={onClose} isDirty={hasUnsavedData} className="p-0 max-w-2xl">
      <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
        <DialogTitle className="mb-0">Novo registro de evolução</DialogTitle>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar modal">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="p-6 space-y-6">
          {/* Data */}
          <div className="space-y-1.5">
            <Label htmlFor="record-date">Data do registro</Label>
            <Input id="record-date" type="date" max={new Date().toISOString().slice(0, 10)} {...register('recordedAt')} />
            {errors.recordedAt && <p className="text-xs text-destructive">{errors.recordedAt.message}</p>}
          </div>

          {/* Campos de medição — grade 2-3 colunas */}
          {activeFields.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Medidas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">
                      {field.name} <span className="text-muted-foreground">({field.unit})</span>
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="—"
                      value={values[field.id] ?? ''}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                    />
                  </div>
                ))}
                {/* IMC calculado — apenas exibido, nunca enviado */}
                {bmi && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      IMC <span className="text-muted-foreground">(kg/m²)</span>
                    </Label>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                      {bmi}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">calculado</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="record-notes">Observações</Label>
            <textarea
              id="record-notes"
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Anotações sobre o registro..."
              {...register('notes')}
            />
          </div>

          {/* Upload de fotos */}
          <div>
            <p className="text-sm font-medium mb-3">Fotos</p>
            <UploadArea
              files={pendingFiles}
              onChange={setPendingFiles}
              consentAt={customer.bodyDataConsentAt}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2 rounded-b-xl">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Salvar registro
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Main EvolutionTab ────────────────────────────────────────────────────────

export function EvolutionTab({ customer }: { customer: Customer }) {
  const role = useRole()
  const isAdmin = role === 'admin'

  const { data: fieldsData = [], isLoading: loadingFields } = useBodyMeasurementFields()
  const { data: recordsPage, isLoading: loadingRecords, error, refetch } = useBodyMeasurementRecords(
    customer.id,
  )
  const deleteRecord = useDeleteBodyMeasurementRecord()

  const [modalOpen, setModalOpen] = useState(false)

  const activeFields = fieldsData.filter((f) => f.active)

  const handleDelete = async (record: BodyMeasurementRecord) => {
    try {
      await deleteRecord.mutateAsync({ id: record.id, customerId: customer.id })
      toast.success('Registro excluído com sucesso')
    } catch {
      toast.error('Erro ao excluir registro')
    }
  }

  // Professional sem vínculo: erro 403 retornado pela API
  if (error) {
    const status = (error as any)?.response?.status
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
        <p>Erro ao carregar registros.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  const isLoading = loadingFields || loadingRecords
  const records = recordsPage?.items ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Evolução corporal</p>
        {(isAdmin || role === 'staff') && (
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            disabled={isLoading}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Novo registro
          </Button>
        )}
      </div>

      {/* States */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activeFields.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Configure os campos de medição em{' '}
            <span className="font-medium">Configurações → Medidas Corporais</span> para começar a
            registrar.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-2">
            Nenhum registro de evolução.
          </p>
          {(isAdmin || role === 'staff') && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo registro
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              isAdmin={isAdmin}
              onDelete={() => void handleDelete(record)}
            />
          ))}
          {records.length >= 50 && (
            <p className="text-center text-xs text-muted-foreground pt-1">
              Exibindo os 50 registros mais recentes.
            </p>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <NewRecordModal
          customer={customer}
          fields={activeFields}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
