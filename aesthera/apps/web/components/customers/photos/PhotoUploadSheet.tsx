'use client'

import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react'
import axios from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { PHOTO_TAG_COLOR } from '@/lib/status-colors'
import {
  useRequestPhotoUploadUrls,
  useCreatePhotos,
  usePhotoBodyRegions,
} from '@/lib/hooks/use-customer-photos'
import type { PhotoCategory } from '@/lib/hooks/use-customer-photos'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_FILES = 5

interface SelectedFile {
  id: string
  file: File
  category: PhotoCategory
  bodyRegion: string
  notes: string
  takenAt: string
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  errorMessage?: string
}

interface PhotoUploadSheetProps {
  customerId: string
  open: boolean
  onClose: () => void
}

export function PhotoUploadSheet({ customerId, open, onClose }: PhotoUploadSheetProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: bodyRegions } = usePhotoBodyRegions()
  const { mutateAsync: requestUploadUrls } = useRequestPhotoUploadUrls(customerId)
  const { mutateAsync: createPhotos } = useCreatePhotos(customerId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const totalAfterAdd = selectedFiles.length + files.length

    if (totalAfterAdd > MAX_FILES) {
      toast.error(`Máximo de ${MAX_FILES} arquivos por envio.`)
    }

    const toAdd = files.slice(0, MAX_FILES - selectedFiles.length)
    const validated: SelectedFile[] = []
    const rejected: string[] = []

    for (const file of toAdd) {
      if (file.size > MAX_SIZE_BYTES) {
        rejected.push(`${file.name} — arquivo excede o limite de 20 MB`)
        continue
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        rejected.push(`${file.name} — tipo de arquivo não suportado`)
        continue
      }
      validated.push({
        id: crypto.randomUUID(),
        file,
        category: 'GALLERY_PHOTO',
        bodyRegion: '',
        notes: '',
        takenAt: new Date().toISOString().slice(0, 10),
        progress: 0,
        status: 'idle',
      })
    }

    if (rejected.length > 0) {
      toast.error(rejected.join('\n'))
    }

    setSelectedFiles((prev) => [...prev, ...validated])
    // Reset input so the same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateFile = (id: string, patch: Partial<SelectedFile>) => {
    setSelectedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return
    setIsSubmitting(true)

    try {
      // 1. Solicitar URLs pré-assinadas
      const response = await requestUploadUrls(
        selectedFiles.map((f) => ({ mimeType: f.file.type, size: f.file.size })),
      )

      const urlMap = new Map(response.urls.map((u) => [u.storageKey, u.uploadUrl]))

      // 2. Fazer upload direto para R2
      const uploadResults: Array<{ fileEntry: SelectedFile; storageKey: string; success: boolean }> = []

      await Promise.all(
        response.urls.map(async ({ storageKey, uploadUrl }, idx) => {
          const fileEntry = selectedFiles[idx]
          updateFile(fileEntry.id, { status: 'uploading', progress: 0 })
          try {
            await axios.put(uploadUrl, fileEntry.file, {
              headers: { 'Content-Type': fileEntry.file.type },
              onUploadProgress: (evt) => {
                const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0
                updateFile(fileEntry.id, { progress: pct })
              },
            })
            updateFile(fileEntry.id, { status: 'done', progress: 100 })
            uploadResults.push({ fileEntry, storageKey, success: true })
          } catch {
            updateFile(fileEntry.id, {
              status: 'error',
              errorMessage: `Falha ao enviar ${fileEntry.file.name}`,
            })
            uploadResults.push({ fileEntry, storageKey, success: false })
          }
        }),
      )

      const successfulUploads = uploadResults.filter((r) => r.success)
      const failedUploads = uploadResults.filter((r) => !r.success)

      if (successfulUploads.length === 0) {
        toast.error('Nenhuma foto foi enviada com sucesso.')
        setIsSubmitting(false)
        return
      }

      // 3. Confirmar no backend
      await createPhotos(
        successfulUploads.map(({ fileEntry, storageKey }) => ({
          storageKey,
          category: fileEntry.category,
          takenAt: fileEntry.takenAt ? new Date(fileEntry.takenAt).toISOString() : undefined,
          bodyRegion: fileEntry.bodyRegion || undefined,
          notes: fileEntry.notes || undefined,
        })),
      )

      if (failedUploads.length > 0) {
        toast.warning(
          `${successfulUploads.length} foto(s) salva(s). Falha em: ${failedUploads.map((r) => r.fileEntry.file.name).join(', ')}`,
        )
        // Remove arquivos com sucesso, mantém os com falha
        setSelectedFiles((prev) =>
          prev.filter((f) => failedUploads.some((r) => r.fileEntry.id === f.id)),
        )
      } else {
        toast.success(
          successfulUploads.length === 1 ? 'Foto adicionada.' : `${successfulUploads.length} fotos adicionadas.`,
        )
        setSelectedFiles([])
        onClose()
      }
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Erro ao salvar as fotos.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v && !isSubmitting) {
      setSelectedFiles([])
      onClose()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Adicionar fotos</SheetTitle>
          <SheetDescription>
            Selecione até {MAX_FILES} imagens (JPEG, PNG ou WebP, máx. 20 MB cada).
          </SheetDescription>
        </SheetHeader>

        {/* Área de seleção */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={selectedFiles.length >= MAX_FILES || isSubmitting}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={selectedFiles.length >= MAX_FILES || isSubmitting}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Selecionar imagens ({selectedFiles.length}/{MAX_FILES})
          </Button>
        </div>

        {/* Lista de arquivos selecionados */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-4">
            {selectedFiles.map((sf) => (
              <div key={sf.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="max-w-[200px] truncate text-sm font-medium">
                    {sf.file.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Remover"
                    onClick={() => removeFile(sf.id)}
                    disabled={isSubmitting}
                    className="ml-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {sf.status === 'uploading' && (
                  <Progress value={sf.progress} className="mb-2 h-1.5" />
                )}

                {sf.status === 'error' && (
                  <div className="mb-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {sf.errorMessage}
                  </div>
                )}

                {sf.status === 'done' && (
                  <div className="mb-2 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Enviado
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {/* Classificação */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Classificação</Label>
                    <Select
                      value={sf.category}
                      disabled={isSubmitting}
                      onValueChange={(v) => updateFile(sf.id, { category: v as PhotoCategory })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PHOTO_TAG_COLOR).map(([key, cfg]) => (
                          <SelectItem key={key} value={key} className="text-xs">
                            {cfg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data da foto */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Data da foto</Label>
                    <Input
                      type="date"
                      value={sf.takenAt}
                      max={new Date().toISOString().slice(0, 10)}
                      disabled={isSubmitting}
                      className="h-8 text-xs"
                      onChange={(e) => updateFile(sf.id, { takenAt: e.target.value })}
                    />
                  </div>

                  {/* Região do corpo */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <Label className="text-xs">Região do corpo</Label>
                    {bodyRegions && bodyRegions.length > 0 ? (
                      <Select
                        value={sf.bodyRegion}
                        disabled={isSubmitting}
                        onValueChange={(v) => updateFile(sf.id, { bodyRegion: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {bodyRegions.map((region) => (
                            <SelectItem key={region} value={region} className="text-xs">
                              {region}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={sf.bodyRegion}
                        disabled={isSubmitting}
                        placeholder="Ex.: Abdômen (opcional)"
                        className="h-8 text-xs"
                        onChange={(e) => updateFile(sf.id, { bodyRegion: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Observações */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={sf.notes}
                      disabled={isSubmitting}
                      placeholder="Opcional"
                      className="h-8 text-xs"
                      onChange={(e) => updateFile(sf.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={selectedFiles.length === 0 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              `Salvar ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
